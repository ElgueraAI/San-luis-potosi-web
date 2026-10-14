/**
 * Deterministic fixtures in the documented response shape of each provider.
 * They exist so that the adapters, the guards and the interface can be built
 * and tested without an account and without spending a credit.
 *
 * They describe NO real place: the ids are «demo-…» on purpose. A fixture must
 * never be attached to a museum, a road or an airport of the portal, because
 * that would put an invented crowd, speed or flight count next to a real name.
 * The client relabels everything that comes from here as `simulated`.
 */
export const DEMO_VENUES = [
  { id: 'demo-recinto-a', name: 'Recinto de ejemplo A', shape: 'midday' },
  { id: 'demo-recinto-b', name: 'Recinto de ejemplo B', shape: 'evening' },
  { id: 'demo-recinto-sin-datos', name: 'Recinto de ejemplo sin cobertura', shape: 'none' },
] as const;
export const DEMO_CORRIDORS = [
  { id: 'demo-tramo-1', name: 'Tramo de ejemplo 1', current: 78, free: 84, closed: false },
  { id: 'demo-tramo-2', name: 'Tramo de ejemplo 2', current: 31, free: 80, closed: false },
  { id: 'demo-tramo-3', name: 'Tramo de ejemplo 3', current: 0, free: 70, closed: true },
] as const;
export const DEMO_AIRPORT = 'DEMO';

const bell = (hour: number, centre: number, width: number) => Math.exp(-((hour - centre) ** 2) / (2 * width ** 2));
function dayCurve(shape: 'midday' | 'evening', day: number): number[] {
  const weekend = day >= 5 ? 1 : 0.72;
  // 24 values starting at 6 AM, as the provider documents; closed hours are 0
  return Array.from({ length: 24 }, (_, i) => {
    const hour = (6 + i) % 24;
    if (hour < 9 || hour > (shape === 'evening' ? 22 : 18)) return 0;
    const v = shape === 'midday' ? bell(hour, 13, 2.4) : 0.45 * bell(hour, 13, 2) + bell(hour, 19.5, 1.8);
    return Math.round(100 * Math.min(1, v) * weekend);
  });
}

export function besttimeForecastFixture(venueId: string) {
  const v = DEMO_VENUES.find((x) => x.id === venueId);
  if (!v || v.shape === 'none') return { status: 'Error', message: 'Could not find venue. Please check the venue name and address.' };
  return {
    status: 'OK', epoch_analysis: 1760000000,
    venue_info: { venue_id: `ven_${venueId}`, venue_name: v.name, venue_address: 'Dirección de ejemplo', venue_timezone: 'America/Mexico_City' },
    analysis: Array.from({ length: 7 }, (_, day) => ({ day_info: { day_int: day, day_text: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day], venue_open: 9, venue_closed: v.shape === 'evening' ? 22 : 18 }, day_raw: dayCurve(v.shape, day) })),
  };
}
export function besttimeLiveFixture(venueId: string) {
  const v = DEMO_VENUES.find((x) => x.id === venueId);
  if (!v || v.shape === 'none') return { status: 'Error', message: 'Venue not found' };
  if (v.shape === 'evening') return { status: 'OK', analysis: { venue_live_busyness_available: false, venue_forecasted_busyness: 40 }, venue_info: { venue_id: `ven_${venueId}` } };
  return { status: 'OK', analysis: { venue_live_busyness: 64, venue_live_busyness_available: true, venue_forecasted_busyness: 55, venue_forecast_busyness_available: true, venue_live_forecasted_delta: 9, hour_start: 13 }, venue_info: { venue_id: `ven_${venueId}`, venue_current_gmttime: 'demo' } };
}
export function tomtomFlowFixture(corridorId: string) {
  const c = DEMO_CORRIDORS.find((x) => x.id === corridorId);
  if (!c) return null;
  return { flowSegmentData: { frc: 'FRC2', currentSpeed: c.current, freeFlowSpeed: c.free, currentTravelTime: 0, freeFlowTravelTime: 0, confidence: 0.9, roadClosure: c.closed, coordinates: { coordinate: [] } } };
}
export function tomtomIncidentsFixture(corridorId: string) {
  if (corridorId === 'demo-tramo-1') return { incidents: [] };
  if (corridorId === 'demo-tramo-2') return { incidents: [{ type: 'Feature', properties: { id: 'demo-1', iconCategory: 9, magnitudeOfDelay: 2, events: [{ description: 'Obras en la vía (ejemplo)', code: 701 }], from: 'Punto de ejemplo A', to: 'Punto de ejemplo B', delay: 420, length: 1800, roadNumbers: ['DEMO-1'], lastReportTime: '2026-01-01T12:00:00Z', probabilityOfOccurrence: 'certain' } }] };
  return { incidents: [{ type: 'Feature', properties: { id: 'demo-2', iconCategory: 8, magnitudeOfDelay: 4, events: [{ description: 'Camino cerrado (ejemplo)', code: 401 }], from: 'Punto de ejemplo C', to: 'Punto de ejemplo D', delay: null, length: 900, roadNumbers: ['DEMO-2'], lastReportTime: '2026-01-01T12:00:00Z', probabilityOfOccurrence: 'certain' } }, null] };
}
export function fr24MovementsFixture() {
  const row = (i: number, orig: string, dest: string) => ({ fr24_id: `demo${i}`, flight: `DEMO${100 + i}`, orig_icao: orig, dest_icao: dest, datetime_takeoff: null, datetime_landed: null });
  return { data: [row(1, 'XXXX', DEMO_AIRPORT), row(2, 'XXXX', DEMO_AIRPORT), row(3, 'YYYY', DEMO_AIRPORT), row(4, DEMO_AIRPORT, 'XXXX'), row(5, DEMO_AIRPORT, 'YYYY')] };
}

/** Fixture transport for SignalClient: resolves a request key to a payload. */
export function fixtureFor({ provider, key }: { provider: string; key: string }): unknown {
  const [route, id] = key.split(':');
  if (provider === 'besttime') return route === 'live' ? besttimeLiveFixture(id) : besttimeForecastFixture(id);
  if (provider === 'tomtom') return route === 'incidents' ? tomtomIncidentsFixture(id) : tomtomFlowFixture(id);
  if (provider === 'fr24') return fr24MovementsFixture();
  return null;
}
