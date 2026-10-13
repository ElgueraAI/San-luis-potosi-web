/**
 * Context engine: turns what is known about the trip right now (clock, month,
 * season, current weather, events, starting point, the route already saved)
 * into the ScoreContext the recommender reads, and into the short context
 * labels shown on cards.
 *
 * Every input is optional. A piece that is missing (no weather, no position,
 * no route) simply leaves its factor without data; nothing is assumed.
 */
import { MONTHS_ES, SEASON_OF } from './taxonomy';
import type { Detour, Recommendation, ScoreContext, WeatherNow } from './scoring';
import type { Coord, IntelDataset, IntelPlace, TouristProfile } from './types';

/** The weather reference point of a place (same rule as src/data/research.ts weatherPointFor). */
export function weatherKey(p: Pick<IntelPlace, 'municipality' | 'region'>): string | null {
  if (p.municipality === 'Catorce') return 'real-de-catorce';
  if (p.municipality === 'Xilitla') return 'xilitla';
  return p.region;
}

export interface ContextInput {
  dataset: IntelDataset;
  profile: TouristProfile;
  now?: Date;
  origin?: Coord | null;
  /** Current weather per reference point key; omit or pass null when the request failed. */
  weather?: Record<string, WeatherNow> | null;
  /** Places already in Mi Ruta (ids as stored by route-store). */
  routeIds?: string[];
  detours?: Map<string, Detour> | null;
}

export function buildContext(input: ContextInput): ScoreContext {
  const { dataset, profile } = input;
  const now = input.now ?? new Date();
  const inRoute = new Set(input.routeIds ?? []);
  const stops = dataset.places.filter((p) => inRoute.has(p.id) || (p.route_id && inRoute.has(p.route_id)));
  const weather = input.weather ?? null;
  const detours = input.detours ?? null;
  return {
    profile,
    month: now.getMonth() + 1,
    origin: input.origin ?? null,
    events: dataset.events,
    municipalities: new Map(dataset.municipalities.map((m) => [m.id, m])),
    weatherOf: weather ? (p) => { const k = weatherKey(p); return k ? weather[k] ?? null : null; } : undefined,
    detourOf: detours ? (p) => detours.get(p.id) ?? null : undefined,
    routeRegions: new Set(stops.map((s) => s.region).filter((r): r is NonNullable<typeof r> => !!r)),
    routeMunicipalities: new Set(stops.map((s) => s.municipality_id).filter((m): m is string => !!m)),
  };
}

export interface TripMoment { month: number; monthName: string; season: string; hour: number; partOfDay: 'mañana' | 'tarde' | 'noche' }
export function tripMoment(now = new Date()): TripMoment {
  const month = now.getMonth() + 1, hour = now.getHours();
  return { month, monthName: MONTHS_ES[month - 1], season: SEASON_OF(month), hour, partOfDay: hour < 12 ? 'mañana' : hour < 19 ? 'tarde' : 'noche' };
}

/** Short context labels for a card; each one is backed by a factor that had data. */
export function contextTags(r: Recommendation): string[] {
  const f = (id: string) => r.factors.find((x) => x.id === id);
  const tags: string[] = [];
  if (r.detour && r.detour.extraMin <= 30) tags.push('Cerca de tu recorrido');
  if (r.detour && r.detour.extraMin > 30) tags.push('Desvío considerable');
  if ((f('season')?.value ?? 0) >= 1) tags.push('Buena opción para esta temporada');
  if (r.event) tags.push('Evento durante tu viaje');
  if (f('weather')?.warning) tags.push('El clima actual puede afectarla');
  if (r.bonus >= 2) tags.push('Suma diversidad a tu viaje');
  return tags;
}

/** Monthly climate context for a region (modelled 2016–2025 average, never a forecast). */
export function climateNote(dataset: IntelDataset, region: string | null, month: number): string | null {
  const m = region ? dataset.climate[region]?.[month - 1] : null;
  if (!m) return null;
  return `En ${MONTHS_ES[month - 1]} la región promedia ${Math.round(m.rain_days)} días con lluvia y máximas de ${Math.round(m.tmax)} °C (promedio modelado 2016–2025, Open-Meteo; no es un pronóstico)`;
}
