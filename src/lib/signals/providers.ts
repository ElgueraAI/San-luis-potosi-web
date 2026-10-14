/**
 * Provider adapters: documented payload → TourismSignal[]. Pure parsers, no
 * network. Field names follow each provider's public documentation as read on
 * 2026-10-13 (docs/external-api-evaluation.md); none of them has been run
 * against a live account from this project, and the code says so wherever a
 * detail could not be confirmed.
 *
 * Rules every adapter keeps:
 *  - a value the provider did not send is null, never a default;
 *  - no value is rescaled across places (a BestTime percentage is relative to
 *    that venue's own weekly peak and is not comparable between venues);
 *  - flights are flights: no passenger or visitor figure is derived.
 */
import { PROVIDER_INFO, unavailable, type TourismSignal } from './types';

const iso = (d: Date) => d.toISOString();
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fail = (why: string): never => { throw new Error(why); };

// ================================================================= BestTime ==
export const BESTTIME = {
  docs: 'https://documentation.besttime.app/',
  unit: '% del máximo semanal del propio establecimiento',
  /** day_raw holds 24 hourly values; the documentation states the window starts at 6 AM local time. */
  firstHour: 6,
  noData: 'Sin información de concurrencia para este establecimiento',
  ttlForecastMs: 7 * 24 * 3600_000, // a weekly forecast changes slowly; the provider itself caches it server-side
  ttlLiveMs: 15 * 60_000,
  costNewForecast: 2, costLive: 1,
} as const;
export const DAYS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

interface BestTimeDay { day_info?: { day_int?: number; day_text?: string }; day_raw?: unknown[]; quiet_hours?: unknown[]; busy_hours?: unknown[]; peak_hours?: unknown }
interface BestTimeForecast { status?: string; message?: string; epoch_analysis?: number | string; venue_info?: { venue_id?: string; venue_name?: string }; analysis?: BestTimeDay[] }

/** Weekly forecast → one signal per day and hour (168 at most). */
export function parseBestTimeForecast(placeId: string) {
  return (p: BestTimeForecast, at: Date, exp: Date): TourismSignal[] => {
    if (!p || typeof p !== 'object') fail('not an object');
    if (p.status !== 'OK' || !Array.isArray(p.analysis)) return [unavailable('besttime', 'relative-busyness-forecast', placeId, BESTTIME.noData, at)];
    const analysed = p.epoch_analysis ? new Date(Number(p.epoch_analysis) * 1000) : null;
    const out: TourismSignal[] = [];
    for (const d of p.analysis) {
      const day = num(d.day_info?.day_int);
      if (day === null || day < 0 || day > 6 || !Array.isArray(d.day_raw)) continue;
      d.day_raw.forEach((raw, i) => {
        const v = num(raw);
        if (v === null || v < 0) return; // closed or missing hours are skipped, not zero-filled
        out.push({
          provider: 'besttime', signalType: 'relative-busyness-forecast', placeId,
          observedAt: analysed && !Number.isNaN(analysed.getTime()) ? iso(analysed) : null, retrievedAt: iso(at), expiresAt: iso(exp),
          value: v, unit: BESTTIME.unit, evidenceType: 'estimated', confidence: null, status: 'forecast', sourceUrl: PROVIDER_INFO.besttime.url,
          meta: { day, hour: (BESTTIME.firstHour + i) % 24, venueId: p.venue_info?.venue_id ?? null },
        });
      });
    }
    return out.length ? out : [unavailable('besttime', 'relative-busyness-forecast', placeId, BESTTIME.noData, at)];
  };
}

interface BestTimeLive { status?: string; analysis?: { venue_live_busyness?: unknown; venue_live_busyness_available?: unknown; venue_forecasted_busyness?: unknown; venue_live_forecasted_delta?: unknown; hour_start?: unknown }; venue_info?: { venue_current_gmttime?: string; venue_id?: string } }
export function parseBestTimeLive(placeId: string) {
  return (p: BestTimeLive, at: Date, exp: Date): TourismSignal[] => {
    if (!p || typeof p !== 'object') fail('not an object');
    const a = p.analysis, live = num(a?.venue_live_busyness);
    if (p.status !== 'OK' || !a || a.venue_live_busyness_available !== true || live === null) return [unavailable('besttime', 'relative-busyness-live', placeId, BESTTIME.noData, at)];
    return [{
      provider: 'besttime', signalType: 'relative-busyness-live', placeId, observedAt: iso(at), retrievedAt: iso(at), expiresAt: iso(exp),
      value: live, unit: BESTTIME.unit, evidenceType: 'observed', confidence: null, status: 'live', sourceUrl: PROVIDER_INFO.besttime.url,
      meta: { forecast: num(a.venue_forecasted_busyness), delta: num(a.venue_live_forecasted_delta), hour: num(a.hour_start), venueId: p.venue_info?.venue_id ?? null },
    }];
  };
}

export interface VisitWindow { day: number; quiet: number[]; busy: number[]; peak: number | null; hours: { hour: number; value: number }[] }
/**
 * «¿Cuándo conviene visitar?» for ONE venue. Thresholds are relative to that
 * venue's own day: quiet = at or below 40 % of the day's maximum, busy = at or
 * above 80 %. Nothing here compares two venues.
 */
export function visitWindows(signals: TourismSignal[]): VisitWindow[] {
  const byDay = new Map<number, { hour: number; value: number }[]>();
  for (const s of signals) {
    if (s.signalType !== 'relative-busyness-forecast' || typeof s.value !== 'number') continue;
    const day = Number(s.meta?.day), hour = Number(s.meta?.hour);
    if (!Number.isInteger(day) || !Number.isInteger(hour)) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), { hour, value: s.value }]);
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, hours]) => {
    const open = hours.filter((h) => h.value > 0);
    const max = Math.max(0, ...open.map((h) => h.value));
    const order = (h: { hour: number }) => (h.hour - BESTTIME.firstHour + 24) % 24;
    hours.sort((a, b) => order(a) - order(b));
    return {
      day, hours,
      quiet: max > 0 ? open.filter((h) => h.value <= 0.4 * max).map((h) => h.hour) : [],
      busy: max > 0 ? open.filter((h) => h.value >= 0.8 * max).map((h) => h.hour) : [],
      peak: max > 0 ? open.find((h) => h.value === max)!.hour : null,
    };
  });
}

// =================================================================== TomTom ==
export const TOMTOM = {
  docs: 'https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/product-information/introduction',
  flowUrl: 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json',
  incidentsUrl: 'https://api.tomtom.com/traffic/services/5/incidentDetails',
  /** Incident Details accepts a bounding box of at most 10,000 km². */
  maxBboxKm2: 10_000,
  ttlFlowMs: 5 * 60_000, ttlIncidentsMs: 10 * 60_000,
  freeMonthly: { flow: 20_000, incidents: 2_500 },
} as const;

interface TomTomFlow { flowSegmentData?: { frc?: string; currentSpeed?: unknown; freeFlowSpeed?: unknown; currentTravelTime?: unknown; freeFlowTravelTime?: unknown; confidence?: unknown; roadClosure?: unknown } }
export function parseTomTomFlow(placeId: string) {
  return (p: TomTomFlow, at: Date, exp: Date): TourismSignal[] => {
    const f = p?.flowSegmentData;
    if (!f || typeof f !== 'object') fail('no flowSegmentData');
    const cur = num(f!.currentSpeed), free = num(f!.freeFlowSpeed), conf = num(f!.confidence);
    if (cur === null || free === null) return [unavailable('tomtom', 'road-speed', placeId, 'Sin datos de flujo para este tramo', at)];
    const base = { provider: 'tomtom' as const, placeId, observedAt: iso(at), retrievedAt: iso(at), expiresAt: iso(exp), evidenceType: 'observed' as const, confidence: conf !== null && conf >= 0 && conf <= 1 ? conf : null, status: 'live' as const, sourceUrl: PROVIDER_INFO.tomtom.url, meta: { frc: f!.frc ?? null } };
    return [
      { ...base, signalType: 'road-speed', value: cur, unit: 'km/h' },
      { ...base, signalType: 'road-free-flow-speed', value: free, unit: 'km/h', evidenceType: 'estimated' },
      { ...base, signalType: 'road-speed-ratio', value: free > 0 ? Math.round((cur / free) * 100) / 100 : null, unit: 'velocidad actual ÷ flujo libre' },
      { ...base, signalType: 'road-closure', value: f!.roadClosure === true, unit: null },
    ];
  };
}

interface TomTomIncident { properties?: { id?: string; iconCategory?: unknown; magnitudeOfDelay?: unknown; events?: { description?: string }[]; from?: string; to?: string; delay?: unknown; length?: unknown; roadNumbers?: string[]; startTime?: string; endTime?: string; lastReportTime?: string; probabilityOfOccurrence?: string } }
export const INCIDENT_CATEGORY: Record<number, string> = { 0: 'Sin clasificar', 1: 'Accidente', 2: 'Niebla', 3: 'Condiciones peligrosas', 4: 'Lluvia', 5: 'Hielo', 6: 'Congestión', 7: 'Carril cerrado', 8: 'Camino cerrado', 9: 'Obras', 10: 'Viento', 11: 'Inundación', 14: 'Vehículo averiado' };
export function parseTomTomIncidents(placeId: string) {
  return (p: { incidents?: (TomTomIncident | null)[] }, at: Date, exp: Date): TourismSignal[] => {
    if (!p || !Array.isArray(p.incidents)) fail('no incidents array');
    return p.incidents!.filter((i): i is TomTomIncident => !!i?.properties).map((i) => {
      const pr = i.properties!, cat = num(pr.iconCategory);
      return {
        provider: 'tomtom', signalType: 'road-incident', placeId, observedAt: pr.lastReportTime ?? pr.startTime ?? null, retrievedAt: iso(at), expiresAt: iso(exp),
        value: cat !== null ? INCIDENT_CATEGORY[cat] ?? 'Incidente' : 'Incidente', unit: null, evidenceType: 'observed', confidence: null, status: 'live', sourceUrl: PROVIDER_INFO.tomtom.url,
        meta: { id: pr.id ?? null, closed: cat === 8, from: pr.from ?? null, to: pr.to ?? null, delayS: num(pr.delay), lengthM: num(pr.length), road: pr.roadNumbers?.join(', ') ?? null, description: pr.events?.[0]?.description ?? null, endTime: pr.endTime ?? null, probability: pr.probabilityOfOccurrence ?? null },
      } satisfies TourismSignal;
    });
  };
}
/** Approximate area of a lon/lat box in km² (enough to respect the provider's limit before calling). */
export function bboxAreaKm2([minLon, minLat, maxLon, maxLat]: [number, number, number, number]): number {
  const lat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  return Math.abs(maxLat - minLat) * 110.574 * Math.abs(maxLon - minLon) * 111.32 * Math.cos(lat);
}

// ============================================================ Flightradar24 ==
export const FR24 = {
  docs: 'https://fr24api.flightradar24.com/docs/getting-started',
  base: 'https://fr24api.flightradar24.com/api',
  /** The sandbox mirrors production paths under /api/sandbox and answers with predefined static data. */
  sandboxBase: 'https://fr24api.flightradar24.com/api/sandbox',
  airport: { iata: 'SLP', icao: 'MMSP', name: 'Aeropuerto Internacional Ponciano Arriaga' },
  ttlMs: 60 * 60_000,
  unit: 'vuelos en el periodo consultado (no son pasajeros ni turistas)',
} as const;

interface Fr24Flight { fr24_id?: string; flight?: string; orig_icao?: string; dest_icao?: string; datetime_takeoff?: string | null; datetime_landed?: string | null }
/** Flight summary rows → arrivals and departures counted for one airport. */
export function parseFr24Movements(icao: string, period: { from: string; to: string }, sandbox: boolean) {
  return (p: { data?: Fr24Flight[] }, at: Date, exp: Date): TourismSignal[] => {
    if (!p || !Array.isArray(p.data)) fail('no data array');
    const arrivals = p.data!.filter((f) => f.dest_icao === icao).length, departures = p.data!.filter((f) => f.orig_icao === icao).length;
    const base = { provider: 'fr24' as const, signalType: 'airport-movements' as const, placeId: icao, observedAt: period.to, retrievedAt: iso(at), expiresAt: iso(exp), unit: FR24.unit, confidence: null, sourceUrl: PROVIDER_INFO.fr24.url };
    // sandbox answers are the provider's static samples: they describe no real day at any airport
    const kind = sandbox ? { status: 'simulated' as const, evidenceType: 'simulated' as const } : { status: 'historical' as const, evidenceType: 'observed' as const };
    return [
      { ...base, ...kind, value: arrivals, meta: { direction: 'arrivals', from: period.from, to: period.to, rows: p.data!.length } },
      { ...base, ...kind, value: departures, meta: { direction: 'departures', from: period.from, to: period.to, rows: p.data!.length } },
    ];
  };
}

// ================================================================ Open-Meteo ==
export interface OpenMeteoNow { temp: number; code: number; precip: number; rainProb: number | null }
/**
 * Wraps what src/scripts/weather.ts already fetched (one request, 15-minute
 * cache). No second request is made. «Current» values are the model's
 * analysis for now, not a station reading; the daily probability is a forecast.
 */
export function openMeteoSignals(placeId: string, now: OpenMeteoNow, at: Date): TourismSignal[] {
  const exp = new Date(at.getTime() + 15 * 60_000);
  const base = { provider: 'open-meteo' as const, placeId, observedAt: iso(at), retrievedAt: iso(at), expiresAt: iso(exp), confidence: null, sourceUrl: PROVIDER_INFO['open-meteo'].url };
  const out: TourismSignal[] = [
    { ...base, signalType: 'weather-current', value: now.temp, unit: '°C', evidenceType: 'estimated', status: 'live', meta: { variable: 'temperature', code: now.code } },
    { ...base, signalType: 'weather-current', value: now.precip, unit: 'mm', evidenceType: 'estimated', status: 'live', meta: { variable: 'precipitation' } },
  ];
  if (now.rainProb !== null) out.push({ ...base, signalType: 'weather-forecast', value: now.rainProb, unit: '% probabilidad máxima de lluvia hoy', evidenceType: 'estimated', status: 'forecast', meta: { variable: 'precipitation-probability' } });
  return out;
}
