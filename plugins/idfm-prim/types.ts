/**
 * Normalized types for IDFM PRIM API responses
 */

// ============================================================================
// Common Types
// ============================================================================

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Place {
  id: string;
  name: string;
  label: string;
  coord?: Coordinates;
  type: 'stop_area' | 'stop_point' | 'address' | 'poi' | 'administrative_region';
}

// ============================================================================
// Departures Types
// ============================================================================

export interface Departure {
  line: string;
  lineCode?: string;
  direction: string;
  destination: string;
  departureDateTime: string;
  arrivalDateTime?: string;
  status?: 'on_time' | 'delayed' | 'cancelled' | 'unknown';
  platform?: string;
}

// ============================================================================
// Journey Types
// ============================================================================

export interface JourneySection {
  mode: 'walking' | 'public_transport' | 'waiting' | 'transfer' | 'crow_fly';
  from: string;
  to: string;
  departure: string;
  arrival: string;
  line?: string;
  lineCode?: string;
  durationSeconds: number;
  walkingDistance?: number;
}

export interface Journey {
  departure: string;
  arrival: string;
  durationSeconds: number;
  nbTransfers: number;
  status?: 'normal' | 'disrupted';
}

export interface ItineraryResult {
  chosenJourney: Journey;
  sections: JourneySection[];
  alternatives?: Journey[];
}

// ============================================================================
// Disruption Types
// ============================================================================

export interface ApplicationPeriod {
  begin: string;
  end: string;
}

export interface ImpactedObject {
  id: string;
  name: string;
  type: string;
}

export interface Disruption {
  id: string;
  title?: string;
  message?: string;
  severity?: 'information' | 'reduced_service' | 'no_service' | 'significant_delays' | 'unknown';
  applicationPeriods?: ApplicationPeriod[];
  impactedObjects?: ImpactedObject[];
}

// ============================================================================
// Isochrone Types
// ============================================================================

export interface IsochroneZone {
  durationSeconds: number;
  geojson?: object;
}

export interface IsochroneResult {
  from?: Coordinates;
  to?: Coordinates;
  zones: IsochroneZone[];
}

// ============================================================================
// API Response Types (raw Navitia responses)
// ============================================================================

export interface NavitiaCoord {
  lat: string;
  lon: string;
}

export interface NavitiaPlace {
  id: string;
  name: string;
  label?: string;
  coord?: NavitiaCoord;
  embedded_type: string;
  stop_area?: {
    id: string;
    name: string;
    label?: string;
    coord?: NavitiaCoord;
  };
  stop_point?: {
    id: string;
    name: string;
    label?: string;
    coord?: NavitiaCoord;
  };
  address?: {
    id: string;
    name: string;
    label?: string;
    coord?: NavitiaCoord;
  };
  poi?: {
    id: string;
    name: string;
    label?: string;
    coord?: NavitiaCoord;
  };
}

export interface NavitiaPlacesResponse {
  places?: NavitiaPlace[];
  error?: {
    id: string;
    message: string;
  };
}

export interface NavitiaStopDateTime {
  departure_date_time: string;
  arrival_date_time?: string;
  base_departure_date_time?: string;
  base_arrival_date_time?: string;
  data_freshness: string;
}

export interface NavitiaRoute {
  id: string;
  name: string;
  direction: {
    id: string;
    name: string;
  };
  line: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface NavitiaDeparture {
  stop_date_time: NavitiaStopDateTime;
  stop_point: {
    id: string;
    name: string;
    label?: string;
    codes?: Array<{ type: string; value: string }>;
  };
  route: NavitiaRoute;
  display_informations: {
    direction: string;
    code?: string;
    name: string;
    commercial_mode?: string;
    physical_mode?: string;
  };
}

export interface NavitiaDeparturesResponse {
  departures?: NavitiaDeparture[];
  error?: {
    id: string;
    message: string;
  };
}

export interface NavitiaSection {
  type: string;
  mode?: string;
  from?: {
    id: string;
    name: string;
    embedded_type: string;
    stop_point?: { name: string };
    address?: { name: string };
    poi?: { name: string };
  };
  to?: {
    id: string;
    name: string;
    embedded_type: string;
    stop_point?: { name: string };
    address?: { name: string };
    poi?: { name: string };
  };
  departure_date_time?: string;
  arrival_date_time?: string;
  duration?: number;
  display_informations?: {
    code?: string;
    name: string;
    direction?: string;
  };
  geojson?: {
    properties?: Array<{ length?: number }>;
  };
}

export interface NavitiaJourney {
  departure_date_time: string;
  arrival_date_time: string;
  duration: number;
  nb_transfers: number;
  status?: string;
  sections?: NavitiaSection[];
}

export interface NavitiaJourneysResponse {
  journeys?: NavitiaJourney[];
  error?: {
    id: string;
    message: string;
  };
}

export interface NavitiaDisruption {
  id: string;
  status?: string;
  cause?: string;
  severity?: {
    name: string;
    effect?: string;
    priority?: number;
  };
  messages?: Array<{
    text: string;
    channel?: { name: string };
  }>;
  application_periods?: Array<{
    begin: string;
    end: string;
  }>;
  impacted_objects?: Array<{
    pt_object?: {
      id: string;
      name: string;
      embedded_type: string;
    };
  }>;
}

export interface NavitiaDisruptionsResponse {
  disruptions?: NavitiaDisruption[];
  error?: {
    id: string;
    message: string;
  };
}

export interface NavitiaTrafficReport {
  network?: {
    id: string;
    name: string;
  };
  lines?: Array<{
    line: {
      id: string;
      name: string;
      code?: string;
    };
    disruptions?: NavitiaDisruption[];
  }>;
}

export interface NavitiaTrafficReportsResponse {
  traffic_reports?: NavitiaTrafficReport[];
  disruptions?: NavitiaDisruption[];
  error?: {
    id: string;
    message: string;
  };
}

export interface NavitiaLine {
  id: string;
  name: string;
  code?: string;
}

export interface NavitiaLinesResponse {
  lines?: NavitiaLine[];
  error?: {
    id: string;
    message: string;
  };
}

export interface NavitiaIsochroneResponse {
  isochrones?: Array<{
    geojson?: object;
    max_duration?: number;
    min_duration?: number;
  }>;
  error?: {
    id: string;
    message: string;
  };
}
