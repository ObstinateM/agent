# IDFM PRIM Plugin

Integrates with the Île-de-France Mobilités (IDFM) PRIM API to provide public transport data including places search, departures, journey planning, and disruptions.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IDFM_PRIM_API_KEY` | Yes | Your PRIM API key from [prim.iledefrance-mobilites.fr](https://prim.iledefrance-mobilites.fr/) |

Add to your `.env`:

```bash
IDFM_PRIM_API_KEY=your_api_key_here
```

## Tools

### idfm_search_places

Search for places (stations, stops, addresses, POIs) in Île-de-France.

**Parameters:**
- `query` (required): Search query (station name, address, or POI)
- `type` (optional): Filter by place types (`stop_area`, `stop_point`, `address`, `poi`, `administrative_region`)
- `count` (optional): Maximum number of results

**Example:**
```
idfm_search_places({ query: "Gare de Lyon" })
idfm_search_places({ query: "Châtelet", type: ["stop_area"], count: 5 })
```

### idfm_next_departures

Get next departures at a station.

**Parameters:**
- `station` (required): Station name or ID (e.g., "Gare de Lyon" or "stop_area:IDFM:...")
- `count` (optional): Number of departures to return (default: 10)
- `data_freshness` (optional): `realtime` (default) or `base_schedule`

**Example:**
```
idfm_next_departures({ station: "Gare de Lyon" })
idfm_next_departures({ station: "stop_area:IDFM:71264", count: 5 })
```

### idfm_plan_itinerary

Plan a journey between two locations.

**Parameters:**
- `from` (required): Origin station name, address, or ID
- `to` (required): Destination station name, address, or ID
- `departure_time` (optional): ISO format departure time
- `arrival_time` (optional): ISO format arrival time (if set without departure_time, finds journeys arriving before this time)
- `max_nb_transfers` (optional): Maximum number of transfers
- `wheelchair` (optional): Require wheelchair accessibility
- `first_section_mode` (optional): Modes for first section (`walking`, `bike`, `bss`, `car`)
- `last_section_mode` (optional): Modes for last section
- `max_nb_journeys` (optional): Maximum number of alternatives

**Example:**
```
idfm_plan_itinerary({ from: "Gare de Lyon", to: "La Défense" })
idfm_plan_itinerary({
  from: "Châtelet",
  to: "Gare du Nord",
  arrival_time: "2024-01-15T09:00:00",
  max_nb_transfers: 1
})
```

### idfm_disruptions

Get current disruptions on public transport.

**Parameters:**
- `scope` (required): `all` for all disruptions, `line` for a specific line, `vehicle_journey` for a specific trip
- `id_or_name` (optional): Line name/code (e.g., "A", "14", "T3a") or ID when scope is `line` or `vehicle_journey`
- `language` (optional): Language for messages (e.g., "fr", "en")

**Example:**
```
idfm_disruptions({ scope: "all" })
idfm_disruptions({ scope: "line", id_or_name: "A" })
idfm_disruptions({ scope: "line", id_or_name: "14" })
```

### idfm_isochrone

Compute isochrone zones (areas reachable within certain durations).

**Parameters:**
- `from` (optional): Origin station name, address, or ID
- `to` (optional): Destination (use either `from` or `to`)
- `datetime` (optional): Date/time in ISO format
- `datetime_represents` (optional): Whether datetime is `departure` or `arrival`
- `boundary_duration` (optional): Durations in seconds for isochrone boundaries
- `wheelchair` (optional): Require wheelchair accessibility

**Example:**
```
idfm_isochrone({ from: "Gare de Lyon", boundary_duration: [600, 1200, 1800] })
```

## API Reference

This plugin uses:
- **Navitia Generic API**: `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia`
- **Isochrones API**: `https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/isochrones`

Authentication is via the `apikey` header.

## Response Types

### Place
```typescript
{
  id: string;        // Navitia ID (e.g., "stop_area:IDFM:71264")
  name: string;      // Place name
  label: string;     // Full label with context
  coord?: { lat: number; lon: number };
  type: 'stop_area' | 'stop_point' | 'address' | 'poi' | 'administrative_region';
}
```

### Departure
```typescript
{
  line: string;              // Line name
  lineCode?: string;         // Line code
  direction: string;         // Direction text
  destination: string;       // Destination name
  departureDateTime: string; // Navitia datetime format
  arrivalDateTime?: string;
  status?: 'on_time' | 'delayed' | 'cancelled' | 'unknown';
  platform?: string;
}
```

### Journey
```typescript
{
  departure: string;      // Departure datetime
  arrival: string;        // Arrival datetime
  durationSeconds: number;
  nbTransfers: number;
  status?: 'normal' | 'disrupted';
}
```

### Disruption
```typescript
{
  id: string;
  title?: string;
  message?: string;
  severity?: 'information' | 'reduced_service' | 'no_service' | 'significant_delays' | 'unknown';
  applicationPeriods?: Array<{ begin: string; end: string }>;
  impactedObjects?: Array<{ id: string; name: string; type: string }>;
}
```
