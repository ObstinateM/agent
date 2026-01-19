import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdfmPrimApiClient } from '../api-client.js';
import { createTools } from '../tools.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('IdfmPrimApiClient', () => {
  let client: IdfmPrimApiClient;

  beforeEach(() => {
    client = new IdfmPrimApiClient('test-api-key');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchPlaces', () => {
    it('should search for places and normalize results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'stop_area:IDFM:71264',
              name: 'Gare de Lyon',
              label: 'Gare de Lyon (Paris)',
              embedded_type: 'stop_area',
              coord: { lat: '48.844', lon: '2.373' },
              stop_area: {
                id: 'stop_area:IDFM:71264',
                name: 'Gare de Lyon',
                label: 'Gare de Lyon (Paris)',
                coord: { lat: '48.844', lon: '2.373' },
              },
            },
            {
              id: 'poi:IDFM:12345',
              name: 'Gare de Lyon - Parvis',
              embedded_type: 'poi',
              coord: { lat: '48.845', lon: '2.374' },
            },
          ],
        }),
      });

      const places = await client.searchPlaces('Gare de Lyon');

      expect(places).toHaveLength(2);
      expect(places[0]).toEqual({
        id: 'stop_area:IDFM:71264',
        name: 'Gare de Lyon',
        label: 'Gare de Lyon (Paris)',
        coord: { lat: 48.844, lon: 2.373 },
        type: 'stop_area',
      });
      expect(places[1].type).toBe('poi');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/places?q=Gare+de+Lyon'),
        expect.objectContaining({
          headers: expect.objectContaining({ apikey: 'test-api-key' }),
        })
      );
    });

    it('should return empty array when no places found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

      const places = await client.searchPlaces('nonexistent');
      expect(places).toHaveLength(0);
    });

    it('should throw error on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { id: 'error', message: 'Something went wrong' },
        }),
      });

      await expect(client.searchPlaces('test')).rejects.toThrow('Search places error');
    });
  });

  describe('getNextDepartures', () => {
    it('should resolve station name and get departures', async () => {
      // First call: search for station
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'stop_area:IDFM:71264',
              name: 'Gare de Lyon',
              embedded_type: 'stop_area',
            },
          ],
        }),
      });

      // Second call: get departures
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          departures: [
            {
              stop_date_time: {
                departure_date_time: '20240115T083000',
                arrival_date_time: '20240115T082800',
                base_departure_date_time: '20240115T083000',
                data_freshness: 'realtime',
              },
              stop_point: {
                id: 'stop_point:IDFM:12345',
                name: 'Gare de Lyon',
                codes: [{ type: 'platform', value: '5' }],
              },
              route: {
                id: 'route:IDFM:123',
                name: 'Route A',
                direction: { id: 'dir:1', name: 'Marne-la-Vallée' },
                line: { id: 'line:A', name: 'RER A', code: 'A' },
              },
              display_informations: {
                direction: 'Marne-la-Vallée - Chessy',
                code: 'A',
                name: 'RER A',
                commercial_mode: 'RER',
              },
            },
            {
              stop_date_time: {
                departure_date_time: '20240115T084500',
                base_departure_date_time: '20240115T084000',
                data_freshness: 'realtime',
              },
              stop_point: { id: 'stop_point:IDFM:12345', name: 'Gare de Lyon' },
              route: {
                id: 'route:IDFM:124',
                name: 'Route A',
                direction: { id: 'dir:2', name: 'Cergy' },
                line: { id: 'line:A', name: 'RER A', code: 'A' },
              },
              display_informations: {
                direction: 'Cergy',
                code: 'A',
                name: 'RER A',
              },
            },
          ],
        }),
      });

      const departures = await client.getNextDepartures('Gare de Lyon');

      expect(departures).toHaveLength(2);
      expect(departures[0]).toEqual({
        line: 'RER A',
        lineCode: 'A',
        direction: 'Marne-la-Vallée - Chessy',
        destination: 'Marne-la-Vallée',
        departureDateTime: '20240115T083000',
        arrivalDateTime: '20240115T082800',
        status: 'on_time',
        platform: '5',
      });
      expect(departures[1].status).toBe('delayed');
    });

    it('should use station ID directly if provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ departures: [] }),
      });

      await client.getNextDepartures('stop_area:IDFM:71264');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('stop_areas/stop_area%3AIDFM%3A71264/departures'),
        expect.any(Object)
      );
    });

    it('should throw error if station not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

      await expect(client.getNextDepartures('nonexistent')).rejects.toThrow('No station found');
    });
  });

  describe('planItinerary', () => {
    it('should plan journey with departure time', async () => {
      // Resolve from
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ id: 'stop_area:IDFM:from', name: 'From', embedded_type: 'stop_area' }],
        }),
      });

      // Resolve to
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ id: 'stop_area:IDFM:to', name: 'To', embedded_type: 'stop_area' }],
        }),
      });

      // Get journeys
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          journeys: [
            {
              departure_date_time: '20240115T083000',
              arrival_date_time: '20240115T090000',
              duration: 1800,
              nb_transfers: 1,
              status: 'NO_SERVICE',
              sections: [
                {
                  type: 'street_network',
                  mode: 'walking',
                  from: { id: 'from', name: 'Origin', embedded_type: 'address' },
                  to: { id: 'stop', name: 'Station A', embedded_type: 'stop_point', stop_point: { name: 'Station A' } },
                  departure_date_time: '20240115T083000',
                  arrival_date_time: '20240115T083500',
                  duration: 300,
                },
                {
                  type: 'public_transport',
                  from: { id: 'stop1', name: 'Station A', embedded_type: 'stop_point', stop_point: { name: 'Station A' } },
                  to: { id: 'stop2', name: 'Station B', embedded_type: 'stop_point', stop_point: { name: 'Station B' } },
                  departure_date_time: '20240115T084000',
                  arrival_date_time: '20240115T085500',
                  duration: 900,
                  display_informations: { code: 'A', name: 'RER A', direction: 'East' },
                },
              ],
            },
            {
              departure_date_time: '20240115T090000',
              arrival_date_time: '20240115T093000',
              duration: 1800,
              nb_transfers: 0,
            },
          ],
        }),
      });

      const result = await client.planItinerary('From', 'To', {
        departureTime: '20240115T083000',
      });

      expect(result.chosenJourney).toEqual({
        departure: '20240115T083000',
        arrival: '20240115T090000',
        durationSeconds: 1800,
        nbTransfers: 1,
        status: 'normal',
      });
      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].mode).toBe('walking');
      expect(result.sections[1].mode).toBe('public_transport');
      expect(result.sections[1].line).toBe('RER A');
      expect(result.alternatives).toHaveLength(1);
    });

    it('should plan journey with arrival time', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ id: 'stop_area:IDFM:from', name: 'From', embedded_type: 'stop_area' }],
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ id: 'stop_area:IDFM:to', name: 'To', embedded_type: 'stop_area' }],
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          journeys: [
            {
              departure_date_time: '20240115T080000',
              arrival_date_time: '20240115T090000',
              duration: 3600,
              nb_transfers: 0,
              sections: [],
            },
          ],
        }),
      });

      await client.planItinerary('From', 'To', {
        arrivalTime: '20240115T090000',
      });

      const lastCall = mockFetch.mock.calls[2][0];
      expect(lastCall).toContain('datetime=20240115T090000');
      expect(lastCall).toContain('datetime_represents=arrival');
    });

    it('should use existing IDs without resolving', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          journeys: [
            {
              departure_date_time: '20240115T083000',
              arrival_date_time: '20240115T090000',
              duration: 1800,
              nb_transfers: 0,
              sections: [],
            },
          ],
        }),
      });

      await client.planItinerary('stop_area:IDFM:from', 'stop_area:IDFM:to');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('from=stop_area%3AIDFM%3Afrom'),
        expect.any(Object)
      );
    });
  });

  describe('getDisruptions', () => {
    it('should get all disruptions from traffic reports', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          disruptions: [
            {
              id: 'disruption:1',
              cause: 'Strike',
              severity: { name: 'blocking', effect: 'NO_SERVICE' },
              messages: [{ text: 'Line closed due to strike', channel: { name: 'sms' } }],
              application_periods: [{ begin: '20240115T000000', end: '20240115T235959' }],
              impacted_objects: [
                { pt_object: { id: 'line:A', name: 'RER A', embedded_type: 'line' } },
              ],
            },
          ],
          traffic_reports: [
            {
              lines: [
                {
                  line: { id: 'line:B', name: 'RER B', code: 'B' },
                  disruptions: [
                    {
                      id: 'disruption:2',
                      cause: 'Works',
                      severity: { name: 'information', effect: 'OTHER_EFFECT' },
                      messages: [{ text: 'Reduced service', channel: { name: 'title' } }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      const disruptions = await client.getDisruptions('all');

      expect(disruptions).toHaveLength(2);
      expect(disruptions[0]).toEqual({
        id: 'disruption:1',
        title: 'Strike',
        message: 'Line closed due to strike',
        severity: 'no_service',
        applicationPeriods: [{ begin: '20240115T000000', end: '20240115T235959' }],
        impactedObjects: [{ id: 'line:A', name: 'RER A', type: 'line' }],
      });
      expect(disruptions[1].severity).toBe('information');
    });

    it('should get disruptions for a specific line by name', async () => {
      // First call: search for line
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lines: [{ id: 'line:IDFM:A', name: 'RER A', code: 'A' }],
        }),
      });

      // Second call: get disruptions
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          disruptions: [
            {
              id: 'disruption:line:A',
              cause: 'Technical issue',
              severity: { name: 'delays', effect: 'SIGNIFICANT_DELAYS' },
              messages: [{ text: 'Expect delays', channel: { name: 'sms' } }],
            },
          ],
        }),
      });

      const disruptions = await client.getDisruptions('line', 'A');

      expect(disruptions).toHaveLength(1);
      expect(disruptions[0].severity).toBe('significant_delays');
    });
  });

  describe('computeIsochrone', () => {
    it('should compute isochrone from a location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [{ id: 'stop_area:IDFM:test', name: 'Test', embedded_type: 'stop_area' }],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isochrones: [
            { max_duration: 600, geojson: { type: 'Polygon' } },
            { max_duration: 1200, geojson: { type: 'Polygon' } },
          ],
        }),
      });

      const result = await client.computeIsochrone('Test Station', undefined, {
        boundary_duration: [600, 1200],
      });

      expect(result.zones).toHaveLength(2);
      expect(result.zones[0].durationSeconds).toBe(600);
      expect(result.zones[1].durationSeconds).toBe(1200);
    });

    it('should throw error if neither from nor to is specified', async () => {
      await expect(client.computeIsochrone()).rejects.toThrow('Either from or to must be specified');
    });
  });
});

describe('IDFM PRIM Tools', () => {
  let client: IdfmPrimApiClient;
  let tools: ReturnType<typeof createTools>;

  beforeEach(() => {
    client = new IdfmPrimApiClient('test-api-key');
    tools = createTools(client);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should expose 5 tools', () => {
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.definition.name)).toEqual([
      'idfm_search_places',
      'idfm_next_departures',
      'idfm_plan_itinerary',
      'idfm_disruptions',
      'idfm_isochrone',
    ]);
  });

  describe('idfm_search_places tool', () => {
    it('should search and format results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
            {
              id: 'stop_area:IDFM:71264',
              name: 'Gare de Lyon',
              label: 'Gare de Lyon (Paris)',
              embedded_type: 'stop_area',
              coord: { lat: '48.8442', lon: '2.3736' },
            },
          ],
        }),
      });

      const searchTool = tools.find((t) => t.definition.name === 'idfm_search_places')!;
      const result = await searchTool.execute({ query: 'Gare de Lyon' });

      expect(result).toContain('Found 1 place(s)');
      expect(result).toContain('Gare de Lyon (Paris)');
      expect(result).toContain('[stop_area]');
      expect(result).toContain('stop_area:IDFM:71264');
    });

    it('should return message when no places found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [] }),
      });

      const searchTool = tools.find((t) => t.definition.name === 'idfm_search_places')!;
      const result = await searchTool.execute({ query: 'xyz' });

      expect(result).toContain('No places found');
    });
  });

  describe('idfm_next_departures tool', () => {
    it('should format departures correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          departures: [
            {
              stop_date_time: {
                departure_date_time: '20240115T083000',
                data_freshness: 'realtime',
              },
              stop_point: { id: 'sp:1', name: 'Station' },
              route: {
                id: 'r:1',
                name: 'Route',
                direction: { id: 'd:1', name: 'Direction' },
                line: { id: 'l:1', name: 'Line 1' },
              },
              display_informations: { direction: 'To Destination', name: 'Line 1' },
            },
          ],
        }),
      });

      const depTool = tools.find((t) => t.definition.name === 'idfm_next_departures')!;
      const result = await depTool.execute({ station: 'stop_area:IDFM:test' });

      expect(result).toContain('Next departures');
      expect(result).toContain('08:30');
      expect(result).toContain('Line 1');
      expect(result).toContain('To Destination');
    });
  });

  describe('idfm_plan_itinerary tool', () => {
    it('should format itinerary correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          journeys: [
            {
              departure_date_time: '20240115T083000',
              arrival_date_time: '20240115T090000',
              duration: 1800,
              nb_transfers: 1,
              sections: [
                {
                  type: 'public_transport',
                  from: { id: 'a', name: 'A', embedded_type: 'stop_point', stop_point: { name: 'Station A' } },
                  to: { id: 'b', name: 'B', embedded_type: 'stop_point', stop_point: { name: 'Station B' } },
                  departure_date_time: '20240115T083500',
                  arrival_date_time: '20240115T085500',
                  duration: 1200,
                  display_informations: { name: 'RER A', code: 'A' },
                },
              ],
            },
          ],
        }),
      });

      const planTool = tools.find((t) => t.definition.name === 'idfm_plan_itinerary')!;
      const result = await planTool.execute({
        from: 'stop_area:IDFM:from',
        to: 'stop_area:IDFM:to',
      });

      expect(result).toContain('Journey from');
      expect(result).toContain('Departure: 2024-01-15 08:30');
      expect(result).toContain('Arrival: 2024-01-15 09:00');
      expect(result).toContain('Duration: 30m');
      expect(result).toContain('Transfers: 1');
      expect(result).toContain('RER A');
    });
  });

  describe('idfm_disruptions tool', () => {
    it('should format disruptions correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          disruptions: [
            {
              id: 'd:1',
              cause: 'Strike',
              severity: { name: 'blocking', effect: 'NO_SERVICE' },
              messages: [{ text: 'Service suspended', channel: { name: 'sms' } }],
              application_periods: [{ begin: '20240115T060000', end: '20240115T220000' }],
            },
          ],
        }),
      });

      const disTool = tools.find((t) => t.definition.name === 'idfm_disruptions')!;
      const result = await disTool.execute({ scope: 'all' });

      expect(result).toContain('Disruptions for');
      expect(result).toContain('[no_service]');
      expect(result).toContain('Strike');
      expect(result).toContain('Service suspended');
      expect(result).toContain('Period:');
    });

    it('should return message when no disruptions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ disruptions: [] }),
      });

      const disTool = tools.find((t) => t.definition.name === 'idfm_disruptions')!;
      const result = await disTool.execute({ scope: 'all' });

      expect(result).toContain('No current disruptions');
    });
  });

  describe('idfm_isochrone tool', () => {
    it('should format isochrone results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isochrones: [
            { max_duration: 600 },
            { max_duration: 1200, geojson: { type: 'Polygon' } },
          ],
        }),
      });

      const isoTool = tools.find((t) => t.definition.name === 'idfm_isochrone')!;
      const result = await isoTool.execute({ from: 'stop_area:IDFM:test' });

      expect(result).toContain('Isochrone from');
      expect(result).toContain('10m zone');
      expect(result).toContain('20m zone (geojson available)');
    });

    it('should return error when neither from nor to specified', async () => {
      const isoTool = tools.find((t) => t.definition.name === 'idfm_isochrone')!;
      const result = await isoTool.execute({});

      expect(result).toContain('Either "from" or "to" must be specified');
    });
  });
});
