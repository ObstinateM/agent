import { z } from 'zod';
import { Tool } from '../../src/types/plugin.js';
import { IdfmPrimApiClient } from './api-client.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Wrap a tool execute function with error logging and raw error response.
 */
function wrapExecute<T>(
  toolName: string,
  fn: (params: T) => Promise<string>
): (params: unknown) => Promise<string> {
  return async (params: unknown): Promise<string> => {
    try {
      return await fn(params as T);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool ${toolName} failed:`, error);
      return `Error: ${errorMessage}`;
    }
  };
}

/**
 * Create IDFM PRIM plugin tools.
 */
export function createTools(client: IdfmPrimApiClient): Tool[] {
  return [
    {
      definition: {
        name: 'idfm_search_places',
        description:
          'Search for places (stations, stops, addresses, POIs) in Île-de-France. Use this to find station IDs for other IDFM tools.',
        parameters: z.object({
          query: z.string().describe('Search query (station name, address, or POI)'),
          type: z
            .array(z.enum(['stop_area', 'stop_point', 'address', 'poi', 'administrative_region']))
            .optional()
            .describe('Filter by place types'),
          count: z.number().optional().describe('Maximum number of results (default: 10)'),
        }),
      },
      execute: wrapExecute('idfm_search_places', async (params: { query: string; type?: string[]; count?: number }) => {
        const { query, type, count } = params;

        const places = await client.searchPlaces(query, { type, count });

        if (places.length === 0) {
          return `No places found for "${query}"`;
        }

        const results = places
          .map((p) => {
            const coords = p.coord ? ` (${p.coord.lat.toFixed(4)}, ${p.coord.lon.toFixed(4)})` : '';
            return `- ${p.label} [${p.type}] ID: ${p.id}${coords}`;
          })
          .join('\n');

        return `Found ${places.length} place(s):\n${results}`;
      }),
    },

    {
      definition: {
        name: 'idfm_next_departures',
        description:
          'Get next departures/trains at a station in Île-de-France. Provide a station name (will be resolved) or a station ID.',
        parameters: z.object({
          station: z
            .string()
            .describe('Station name (e.g., "Gare de Lyon") or station ID (e.g., "stop_area:IDFM:...")'),
          count: z.number().optional().describe('Number of departures to return (default: 10)'),
          data_freshness: z
            .enum(['realtime', 'base_schedule'])
            .optional()
            .describe('Data freshness: realtime (default) or base_schedule'),
        }),
      },
      execute: wrapExecute('idfm_next_departures', async (params: { station: string; count?: number; data_freshness?: 'realtime' | 'base_schedule' }) => {
        const { station, count, data_freshness } = params;

        const departures = await client.getNextDepartures(station, {
          count,
          data_freshness,
        });

        if (departures.length === 0) {
          return `No upcoming departures found at "${station}"`;
        }

        const results = departures
          .map((d) => {
            const time = formatDateTime(d.departureDateTime);
            const status = d.status && d.status !== 'unknown' ? ` [${d.status}]` : '';
            const platform = d.platform ? ` - Platform ${d.platform}` : '';
            return `- ${time}: ${d.line} → ${d.direction}${status}${platform}`;
          })
          .join('\n');

        return `Next departures at ${station}:\n${results}`;
      }),
    },

    {
      definition: {
        name: 'idfm_plan_itinerary',
        description:
          'Plan a journey between two locations in Île-de-France. Provide station names or IDs. If neither departure nor arrival time is specified, uses current time as departure.',
        parameters: z.object({
          from: z.string().describe('Origin: station name, address, or ID'),
          to: z.string().describe('Destination: station name, address, or ID'),
          departure_time: z
            .string()
            .optional()
            .describe('Departure time in ISO format (e.g., "2024-01-15T08:30:00"). If set, finds journeys departing at/after this time.'),
          arrival_time: z
            .string()
            .optional()
            .describe('Arrival time in ISO format. If set (and departure_time is not), finds journeys arriving before this time.'),
          max_nb_transfers: z.number().optional().describe('Maximum number of transfers'),
          wheelchair: z.boolean().optional().describe('Require wheelchair accessibility'),
          first_section_mode: z
            .array(z.enum(['walking', 'bike', 'bss', 'car']))
            .optional()
            .describe('Modes for first section (walking, bike, bss, car)'),
          last_section_mode: z
            .array(z.enum(['walking', 'bike', 'bss', 'car']))
            .optional()
            .describe('Modes for last section'),
          max_nb_journeys: z.number().optional().describe('Maximum number of journey alternatives'),
        }),
      },
      execute: wrapExecute('idfm_plan_itinerary', async (params: {
        from: string;
        to: string;
        departure_time?: string;
        arrival_time?: string;
        max_nb_transfers?: number;
        wheelchair?: boolean;
        first_section_mode?: string[];
        last_section_mode?: string[];
        max_nb_journeys?: number;
      }) => {
        const {
          from,
          to,
          departure_time,
          arrival_time,
          max_nb_transfers,
          wheelchair,
          first_section_mode,
          last_section_mode,
          max_nb_journeys,
        } = params;

        const result = await client.planItinerary(from, to, {
          departureTime: departure_time,
          arrivalTime: arrival_time,
          max_nb_transfers,
          wheelchair,
          first_section_mode,
          last_section_mode,
          max_nb_journeys,
        });

        const journey = result.chosenJourney;
        const status = journey.status === 'disrupted' ? ' ⚠️ DISRUPTED' : '';

        let output = `Journey from ${from} to ${to}${status}\n`;
        output += `Departure: ${formatDateTime(journey.departure)}\n`;
        output += `Arrival: ${formatDateTime(journey.arrival)}\n`;
        output += `Duration: ${formatDuration(journey.durationSeconds)}\n`;
        output += `Transfers: ${journey.nbTransfers}\n\n`;
        output += `Sections:\n`;

        for (const section of result.sections) {
          if (section.mode === 'waiting') continue;

          const time = `${formatTime(section.departure)} - ${formatTime(section.arrival)}`;
          let desc = `${section.from} → ${section.to}`;

          if (section.mode === 'public_transport' && section.line) {
            desc = `${section.line}: ${desc}`;
          } else if (section.mode === 'walking') {
            const dist = section.walkingDistance ? ` (${section.walkingDistance}m)` : '';
            desc = `Walk${dist}: ${desc}`;
          } else if (section.mode === 'transfer') {
            desc = `Transfer: ${desc}`;
          }

          output += `- ${time} | ${desc} (${formatDuration(section.durationSeconds)})\n`;
        }

        if (result.alternatives && result.alternatives.length > 0) {
          output += `\nAlternatives:\n`;
          for (const alt of result.alternatives) {
            const altObj = alt as { departure: string; arrival: string; durationSeconds: number; nbTransfers: number };
            output += `- Depart ${formatTime(altObj.departure)}, arrive ${formatTime(altObj.arrival)} (${formatDuration(altObj.durationSeconds)}, ${altObj.nbTransfers} transfers)\n`;
          }
        }

        // Check for disruptions on lines used in this journey
        const linesUsed = new Set<string>();
        for (const section of result.sections) {
          if (section.mode === 'public_transport' && section.line) {
            linesUsed.add(section.line);
          }
        }

        if (linesUsed.size > 0) {
          const allDisruptions = [];
          for (const lineName of linesUsed) {
            try {
              const disruptions = await client.getDisruptions('line', lineName);
              if (disruptions.length > 0) {
                allDisruptions.push({ line: lineName, disruptions });
              }
            } catch (error) {
              // Silently fail disruption checks - don't break itinerary display
              logger.warn(`Failed to check disruptions for line ${lineName}:`, error);
            }
          }

          if (allDisruptions.length > 0) {
            output += `\n⚠️ Disruptions on your route:\n`;
            for (const { line, disruptions } of allDisruptions) {
              output += `\n${line}:\n`;
              for (const d of disruptions) {
                output += `  • [${d.severity || 'unknown'}] ${d.title || 'Disruption'}`;
                if (d.message) {
                  output += `: ${d.message}`;
                }
                output += '\n';
              }
            }
          }
        }

        return output;
      }),
    },

    {
      definition: {
        name: 'idfm_disruptions',
        description:
          'Get current disruptions/problems on public transport in Île-de-France. Can get all disruptions or filter by line.',
        parameters: z.object({
          scope: z
            .enum(['all', 'line', 'vehicle_journey'])
            .describe('Scope: "all" for all disruptions, "line" for a specific line, "vehicle_journey" for a specific trip'),
          id_or_name: z
            .string()
            .optional()
            .describe('Line name/code (e.g., "A", "14", "T3a") or ID when scope is "line" or "vehicle_journey"'),
          language: z.string().optional().describe('Language for messages (e.g., "fr", "en")'),
        }),
      },
      execute: wrapExecute('idfm_disruptions', async (params: { scope: 'all' | 'line' | 'vehicle_journey'; id_or_name?: string; language?: string }) => {
        const { scope, id_or_name, language } = params;

        const disruptions = await client.getDisruptions(scope, id_or_name, { language });

        if (disruptions.length === 0) {
          const scopeDesc = scope === 'all' ? 'in Île-de-France' : `for ${id_or_name}`;
          return `No current disruptions ${scopeDesc}`;
        }

        const results = disruptions
          .map((d) => {
            let entry = `- [${d.severity || 'unknown'}] ${d.title || 'Disruption'}`;
            if (d.message) {
              entry += `\n  ${d.message}`;
            }
            if (d.applicationPeriods && d.applicationPeriods.length > 0) {
              const period = d.applicationPeriods[0];
              entry += `\n  Period: ${formatDateTime(period.begin)} - ${formatDateTime(period.end)}`;
            }
            if (d.impactedObjects && d.impactedObjects.length > 0) {
              const objects = d.impactedObjects.map((o) => o.name).join(', ');
              entry += `\n  Affects: ${objects}`;
            }
            return entry;
          })
          .join('\n\n');

        const scopeDesc = scope === 'all' ? 'Île-de-France' : id_or_name;
        return `Disruptions for ${scopeDesc} (${disruptions.length}):\n\n${results}`;
      }),
    },

    {
      definition: {
        name: 'idfm_isochrone',
        description:
          'Compute isochrone zones (areas reachable within certain durations) from or to a location in Île-de-France.',
        parameters: z.object({
          from: z.string().optional().describe('Origin: station name, address, or ID'),
          to: z.string().optional().describe('Destination: station name, address, or ID (use either from or to)'),
          datetime: z.string().optional().describe('Date/time in ISO format'),
          datetime_represents: z
            .enum(['departure', 'arrival'])
            .optional()
            .describe('Whether datetime is departure or arrival'),
          boundary_duration: z
            .array(z.number())
            .optional()
            .describe('Durations in seconds for isochrone boundaries (e.g., [600, 1200, 1800] for 10, 20, 30 min)'),
          wheelchair: z.boolean().optional().describe('Require wheelchair accessibility'),
        }),
      },
      execute: wrapExecute('idfm_isochrone', async (params: {
        from?: string;
        to?: string;
        datetime?: string;
        datetime_represents?: 'departure' | 'arrival';
        boundary_duration?: number[];
        wheelchair?: boolean;
      }) => {
        const { from, to, datetime, datetime_represents, boundary_duration, wheelchair } = params;

        if (!from && !to) {
          return 'Error: Either "from" or "to" must be specified';
        }

        const result = await client.computeIsochrone(from, to, {
          datetime,
          datetime_represents,
          boundary_duration,
          wheelchair,
        });

        if (result.zones.length === 0) {
          return 'No isochrone zones computed';
        }

        const location = from || to;
        const direction = from ? 'from' : 'to';

        const zones = result.zones
          .map((z) => `- ${formatDuration(z.durationSeconds)} zone${z.geojson ? ' (geojson available)' : ''}`)
          .join('\n');

        return `Isochrone ${direction} ${location}:\n${zones}`;
      }),
    },
  ];
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  // Navitia format: YYYYMMDDTHHmmss
  if (dateStr.length === 15 && dateStr.includes('T')) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const hour = dateStr.slice(9, 11);
    const min = dateStr.slice(11, 13);
    return `${year}-${month}-${day} ${hour}:${min}`;
  }
  return dateStr;
}

function formatTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  if (dateStr.length === 15 && dateStr.includes('T')) {
    const hour = dateStr.slice(9, 11);
    const min = dateStr.slice(11, 13);
    return `${hour}:${min}`;
  }
  return dateStr;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}
