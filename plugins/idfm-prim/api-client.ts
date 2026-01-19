import {
  NavitiaPlacesResponse,
  NavitiaDeparturesResponse,
  NavitiaJourneysResponse,
  NavitiaDisruptionsResponse,
  NavitiaTrafficReportsResponse,
  NavitiaLinesResponse,
  NavitiaIsochroneResponse,
  Place,
  Departure,
  ItineraryResult,
  Disruption,
  IsochroneResult,
  NavitiaPlace,
  NavitiaDeparture,
  NavitiaJourney,
  NavitiaDisruption,
  NavitiaSection,
} from './types.js';
import { logger } from '../../src/utils/logger.js';

const NAVITIA_BASE_URL = 'https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia';
const ISOCHRONES_BASE_URL = 'https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/isochrones';

export interface SearchPlacesOptions {
  type?: string[];
  count?: number;
  depth?: number;
  disable_geojson?: boolean;
  from?: string;
  shape?: string;
  admin_uri?: string[];
}

export interface GetDeparturesOptions {
  filter?: string;
  from_datetime?: string;
  until_datetime?: string;
  duration?: number;
  count?: number;
  data_freshness?: 'realtime' | 'base_schedule';
  show_codes?: boolean;
}

export interface PlanItineraryOptions {
  datetime?: string;
  datetime_represents?: 'departure' | 'arrival';
  max_nb_transfers?: number;
  min_nb_transfers?: number;
  first_section_mode?: string[];
  last_section_mode?: string[];
  wheelchair?: boolean;
  data_freshness?: 'realtime' | 'base_schedule';
  max_nb_journeys?: number;
  timeframe_duration?: number;
  language?: string;
}

export interface GetDisruptionsOptions {
  language?: string;
  filter?: string;
  original_id?: string;
}

export interface ComputeIsochroneOptions {
  datetime?: string;
  datetime_represents?: 'departure' | 'arrival';
  max_nb_transfers?: number;
  data_freshness?: 'realtime' | 'base_schedule';
  wheelchair?: boolean;
  boundary_duration?: number[];
}

export class IdfmPrimApiClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(url: string): Promise<T> {
    logger.debug(`IDFM API request: ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          apikey: this.apiKey,
          Accept: 'application/json',
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`IDFM API network error: ${errMsg}`, { url });
      throw new Error(`IDFM API network error: ${errMsg}`);
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // Ignore if we can't read body
      }
      logger.error(`IDFM API error: ${response.status} ${response.statusText}`, {
        url,
        status: response.status,
        body: errorBody,
      });
      throw new Error(`IDFM API error ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
    }

    return response.json();
  }

  private buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          searchParams.append(key, String(v));
        }
      } else {
        searchParams.append(key, String(value));
      }
    }
    return searchParams.toString();
  }

  // ============================================================================
  // Raw API Methods
  // ============================================================================

  async fetchPlaces(query: string, options?: SearchPlacesOptions): Promise<NavitiaPlacesResponse> {
    const params = { q: query, ...options };
    const qs = this.buildQueryString(params);
    return this.fetch<NavitiaPlacesResponse>(`${NAVITIA_BASE_URL}/places?${qs}`);
  }

  async fetchDepartures(stopId: string, options?: GetDeparturesOptions): Promise<NavitiaDeparturesResponse> {
    const qs = this.buildQueryString(options || {});
    const url = `${NAVITIA_BASE_URL}/stop_areas/${encodeURIComponent(stopId)}/departures?${qs}`;
    return this.fetch<NavitiaDeparturesResponse>(url);
  }

  async fetchJourneys(from: string, to: string, options?: PlanItineraryOptions): Promise<NavitiaJourneysResponse> {
    const params = { from, to, ...options };
    const qs = this.buildQueryString(params);
    return this.fetch<NavitiaJourneysResponse>(`${NAVITIA_BASE_URL}/journeys?${qs}`);
  }

  async fetchDisruptions(options?: GetDisruptionsOptions): Promise<NavitiaDisruptionsResponse> {
    const qs = this.buildQueryString(options || {});
    return this.fetch<NavitiaDisruptionsResponse>(`${NAVITIA_BASE_URL}/disruptions?${qs}`);
  }

  async fetchTrafficReports(options?: GetDisruptionsOptions): Promise<NavitiaTrafficReportsResponse> {
    const qs = this.buildQueryString(options || {});
    return this.fetch<NavitiaTrafficReportsResponse>(`${NAVITIA_BASE_URL}/traffic_reports?${qs}`);
  }

  async fetchLines(filter?: string): Promise<NavitiaLinesResponse> {
    const params = filter ? { filter } : {};
    const qs = this.buildQueryString(params);
    const url = qs ? `${NAVITIA_BASE_URL}/lines?${qs}` : `${NAVITIA_BASE_URL}/lines`;
    return this.fetch<NavitiaLinesResponse>(url);
  }

  async fetchIsochrones(
    from?: string,
    to?: string,
    options?: ComputeIsochroneOptions
  ): Promise<NavitiaIsochroneResponse> {
    const params: Record<string, unknown> = { ...options };
    if (from) params.from = from;
    if (to) params.to = to;
    const qs = this.buildQueryString(params);
    return this.fetch<NavitiaIsochroneResponse>(`${ISOCHRONES_BASE_URL}?${qs}`);
  }

  // ============================================================================
  // Normalization Helpers
  // ============================================================================

  private normalizePlace(place: NavitiaPlace): Place {
    const embedded = place[place.embedded_type as keyof NavitiaPlace];
    const data = (typeof embedded === 'object' && embedded !== null) ? embedded as { id?: string; name?: string; label?: string; coord?: { lat: string; lon: string } } : place;

    return {
      id: data.id || place.id,
      name: data.name || place.name,
      label: data.label || place.label || data.name || place.name,
      coord: (data.coord || place.coord) ? {
        lat: parseFloat(String((data.coord || place.coord)?.lat)),
        lon: parseFloat(String((data.coord || place.coord)?.lon)),
      } : undefined,
      type: place.embedded_type as Place['type'],
    };
  }

  private normalizeDeparture(departure: NavitiaDeparture): Departure {
    const stopDateTime = departure.stop_date_time;
    const baseDeparture = stopDateTime.base_departure_date_time;
    const actualDeparture = stopDateTime.departure_date_time;

    let status: Departure['status'] = 'unknown';
    if (stopDateTime.data_freshness === 'realtime') {
      if (baseDeparture && actualDeparture > baseDeparture) {
        status = 'delayed';
      } else {
        status = 'on_time';
      }
    }

    const codes = departure.stop_point.codes;
    const platform = codes?.find(c => c.type === 'platform')?.value;

    return {
      line: departure.display_informations.name,
      lineCode: departure.display_informations.code,
      direction: departure.display_informations.direction,
      destination: departure.route.direction.name,
      departureDateTime: actualDeparture,
      arrivalDateTime: stopDateTime.arrival_date_time,
      status,
      platform,
    };
  }

  private normalizeJourney(journey: NavitiaJourney): ItineraryResult {
    const sections = (journey.sections || []).map((section: NavitiaSection) => this.normalizeSection(section));

    return {
      chosenJourney: {
        departure: journey.departure_date_time,
        arrival: journey.arrival_date_time,
        durationSeconds: journey.duration,
        nbTransfers: journey.nb_transfers,
        status: journey.status === 'SIGNIFICANT_DELAYS' ? 'disrupted' : 'normal',
      },
      sections,
    };
  }

  private normalizeSection(section: NavitiaSection): ItineraryResult['sections'][0] {
    const getLocationName = (loc?: NavitiaSection['from']): string => {
      if (!loc) return 'Unknown';
      if (loc.stop_point?.name) return loc.stop_point.name;
      if (loc.address?.name) return loc.address.name;
      if (loc.poi?.name) return loc.poi.name;
      return loc.name;
    };

    let mode: ItineraryResult['sections'][0]['mode'] = 'walking';
    if (section.type === 'public_transport') {
      mode = 'public_transport';
    } else if (section.type === 'waiting') {
      mode = 'waiting';
    } else if (section.type === 'transfer') {
      mode = 'transfer';
    } else if (section.type === 'crow_fly') {
      mode = 'crow_fly';
    } else if (section.mode === 'walking' || section.type === 'street_network') {
      mode = 'walking';
    }

    const walkingDistance = section.geojson?.properties?.[0]?.length;

    return {
      mode,
      from: getLocationName(section.from),
      to: getLocationName(section.to),
      departure: section.departure_date_time || '',
      arrival: section.arrival_date_time || '',
      line: section.display_informations?.name,
      lineCode: section.display_informations?.code,
      durationSeconds: section.duration || 0,
      walkingDistance,
    };
  }

  private normalizeDisruption(disruption: NavitiaDisruption): Disruption {
    const message = disruption.messages?.find(m => m.channel?.name === 'sms' || m.channel?.name === 'title')?.text
      || disruption.messages?.[0]?.text;
    const title = disruption.cause || disruption.messages?.find(m => m.channel?.name === 'title')?.text;

    let severity: Disruption['severity'] = 'unknown';
    if (disruption.severity) {
      const effect = disruption.severity.effect?.toLowerCase();
      if (effect === 'no_service') severity = 'no_service';
      else if (effect === 'reduced_service') severity = 'reduced_service';
      else if (effect === 'significant_delays') severity = 'significant_delays';
      else if (effect === 'other_effect' || disruption.severity.name?.toLowerCase() === 'information') severity = 'information';
    }

    return {
      id: disruption.id,
      title,
      message,
      severity,
      applicationPeriods: disruption.application_periods?.map(p => ({
        begin: p.begin,
        end: p.end,
      })),
      impactedObjects: disruption.impacted_objects?.map(io => ({
        id: io.pt_object?.id || '',
        name: io.pt_object?.name || '',
        type: io.pt_object?.embedded_type || '',
      })).filter(io => io.id),
    };
  }

  // ============================================================================
  // High-Level Methods
  // ============================================================================

  async searchPlaces(query: string, options?: SearchPlacesOptions): Promise<Place[]> {
    const response = await this.fetchPlaces(query, options);
    if (response.error) {
      throw new Error(`Search places error: ${response.error.message}`);
    }
    return (response.places || []).map(p => this.normalizePlace(p));
  }

  async getNextDepartures(stationInput: string, options?: GetDeparturesOptions): Promise<Departure[]> {
    let stopId = stationInput;

    // If it doesn't look like an ID, search for it
    if (!stationInput.startsWith('stop_area:') && !stationInput.startsWith('stop_point:')) {
      const places = await this.searchPlaces(stationInput, {
        type: ['stop_area', 'stop_point'],
        count: 5,
      });

      if (places.length === 0) {
        throw new Error(`No station found for: ${stationInput}`);
      }

      // Prefer stop_area, then stop_point
      const best = places.find(p => p.type === 'stop_area') || places[0];
      stopId = best.id;
    }

    const response = await this.fetchDepartures(stopId, {
      count: options?.count || 10,
      data_freshness: options?.data_freshness || 'realtime',
      ...options,
    });

    if (response.error) {
      throw new Error(`Departures error: ${response.error.message}`);
    }

    return (response.departures || []).map(d => this.normalizeDeparture(d));
  }

  async planItinerary(
    from: string,
    to: string,
    options?: PlanItineraryOptions & { departureTime?: string; arrivalTime?: string }
  ): Promise<ItineraryResult & { alternatives?: ItineraryResult[] }> {
    // Resolve from/to if they are names
    const resolveLocation = async (input: string): Promise<string> => {
      if (input.startsWith('stop_area:') || input.startsWith('stop_point:') || input.startsWith('admin:') || input.includes(';')) {
        return input;
      }
      const places = await this.searchPlaces(input, {
        type: ['stop_area', 'stop_point', 'address'],
        count: 3,
      });
      if (places.length === 0) {
        throw new Error(`Location not found: ${input}`);
      }
      return places[0].id;
    };

    const fromId = await resolveLocation(from);
    const toId = await resolveLocation(to);

    const apiOptions: PlanItineraryOptions = { ...options };

    // Handle arrival vs departure time
    if (options?.arrivalTime && !options?.departureTime) {
      apiOptions.datetime = options.arrivalTime;
      apiOptions.datetime_represents = 'arrival';
    } else if (options?.departureTime) {
      apiOptions.datetime = options.departureTime;
      apiOptions.datetime_represents = 'departure';
    }

    const response = await this.fetchJourneys(fromId, toId, apiOptions);

    if (response.error) {
      throw new Error(`Journey planning error: ${response.error.message}`);
    }

    const journeys = response.journeys || [];
    if (journeys.length === 0) {
      throw new Error('No journeys found');
    }

    const [first, ...rest] = journeys;
    const result = this.normalizeJourney(first);

    if (rest.length > 0) {
      result.alternatives = rest.map(j => this.normalizeJourney(j).chosenJourney);
    }

    return result as ItineraryResult & { alternatives?: ItineraryResult[] };
  }

  async getDisruptions(
    scope: 'all' | 'line' | 'vehicle_journey',
    idOrName?: string,
    options?: GetDisruptionsOptions
  ): Promise<Disruption[]> {
    if (scope === 'all') {
      const response = await this.fetchTrafficReports(options);
      if (response.error) {
        throw new Error(`Traffic reports error: ${response.error.message}`);
      }

      // Extract disruptions from traffic reports
      const disruptions: NavitiaDisruption[] = response.disruptions || [];

      // Also collect from traffic_reports if present
      if (response.traffic_reports) {
        for (const report of response.traffic_reports) {
          if (report.lines) {
            for (const lineReport of report.lines) {
              if (lineReport.disruptions) {
                disruptions.push(...lineReport.disruptions);
              }
            }
          }
        }
      }

      return disruptions.map(d => this.normalizeDisruption(d));
    }

    if (scope === 'line' && idOrName) {
      // Resolve line id if it's a name
      let lineId = idOrName;
      if (!idOrName.startsWith('line:')) {
        const linesResponse = await this.fetchLines(`line.code="${idOrName}" or line.name="${idOrName}"`);
        if (linesResponse.lines && linesResponse.lines.length > 0) {
          lineId = linesResponse.lines[0].id;
        } else {
          // Try a broader search
          const allLines = await this.fetchLines();
          const matchedLine = allLines.lines?.find(
            l => l.code?.toLowerCase() === idOrName.toLowerCase() ||
                 l.name.toLowerCase().includes(idOrName.toLowerCase())
          );
          if (matchedLine) {
            lineId = matchedLine.id;
          } else {
            throw new Error(`Line not found: ${idOrName}`);
          }
        }
      }

      const response = await this.fetchDisruptions({
        ...options,
        filter: `line.id="${lineId}"`,
      });

      if (response.error) {
        throw new Error(`Disruptions error: ${response.error.message}`);
      }

      return (response.disruptions || []).map(d => this.normalizeDisruption(d));
    }

    if (scope === 'vehicle_journey' && idOrName) {
      const response = await this.fetchDisruptions({
        ...options,
        filter: `vehicle_journey.id="${idOrName}"`,
      });

      if (response.error) {
        throw new Error(`Disruptions error: ${response.error.message}`);
      }

      return (response.disruptions || []).map(d => this.normalizeDisruption(d));
    }

    return [];
  }

  async computeIsochrone(
    from?: string,
    to?: string,
    options?: ComputeIsochroneOptions
  ): Promise<IsochroneResult> {
    // Resolve location if it's a name
    const resolveLocation = async (input?: string): Promise<string | undefined> => {
      if (!input) return undefined;
      if (input.startsWith('stop_area:') || input.startsWith('stop_point:') || input.includes(';')) {
        return input;
      }
      const places = await this.searchPlaces(input, {
        type: ['stop_area', 'stop_point', 'address'],
        count: 1,
      });
      return places.length > 0 ? places[0].id : undefined;
    };

    const fromId = await resolveLocation(from);
    const toId = await resolveLocation(to);

    if (!fromId && !toId) {
      throw new Error('Either from or to must be specified');
    }

    const response = await this.fetchIsochrones(fromId, toId, options);

    if (response.error) {
      throw new Error(`Isochrone error: ${response.error.message}`);
    }

    const zones = (response.isochrones || []).map(iso => ({
      durationSeconds: iso.max_duration || 0,
      geojson: iso.geojson,
    }));

    return {
      from: fromId ? undefined : undefined,
      to: toId ? undefined : undefined,
      zones,
    };
  }
}
