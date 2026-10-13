/**
 * Explainable recommendation engine.
 *
 *   base  = 100 × Σ wᵢ·vᵢ / Σ wᵢ      over the factors that HAVE data
 *   score = min(100, base + event bonus + diversity bonus)
 *
 * Every factor returns a value in 0–1 or null. null means "no data for this
 * factor": its weight leaves the denominator, so a missing season, a failed
 * weather request or an unknown origin never lowers a place. Each value comes
 * with the sentence shown to the visitor, so no reason appears that the data
 * does not support.
 *
 * Relevance first, diversification second: the two bonuses are additive,
 * small (event ≤ 4 points, diversity ≤ 6) and only given to places that are
 * already relevant (base ≥ 55). They can only add: an event of uncertain date
 * or a well-known municipality never lowers a place. A popular place is never
 * penalised for being popular.
 *
 * Weights, formulas and limits: docs/recommendation-engine.md.
 */
import { INTEREST_LABEL, MONTHS_ES, REGION_LABEL, reachKm, DURATIONS } from './taxonomy';
import type { Coord, EvidenceLevel, IntelEvent, IntelPlace, MuniFeatures, ProfileInterest, TouristProfile } from './types';

export const WEIGHTS = {
  interest: 0.36,
  distance: 0.2,
  season: 0.16,
  support: 0.1,
  weather: 0.09,
  evidence: 0.09,
} as const;
export type FactorId = keyof typeof WEIGHTS;
export const FACTOR_LABEL: Record<FactorId, string> = {
  interest: 'Coincidencia con tus intereses', distance: 'Distancia o desvío', season: 'Temporada', support: 'Servicios de apoyo (proxy)',
  weather: 'Clima actual', evidence: 'Calidad de la información',
};
export const DIVERSITY_BONUS_MAX = 6;
/** Points an event in the trip month adds, by how sure its date is. */
export const EVENT_BONUS = { confirmed: 4, pattern: 3, past: 1.5, unknown: 0 } as const;
/** Interest fit = 0.75 × share of the chosen interests covered + 0.25 × how central they are to the place. */
export const INTEREST_MIX = { coverage: 0.75, focus: 0.25 } as const;
export const RELEVANCE_GATE = 55;
/** A municipality counts as little exposed below this exposure proxy (and with some potential). */
export const LOW_EXPOSURE = 0.4;
export const MIN_POTENTIAL = 0.3;
/** A stated interest counts 1; one inferred from the official type counts 0.8. */
export const DERIVED_MATCH = 0.8;

export interface WeatherNow { temp: number; code: number; precip: number; rainProb: number | null }
export interface Detour { offRouteKm: number; extraMin: number; measured: boolean }

export interface ScoreContext {
  profile: TouristProfile;
  /** Trip month, 1–12. */
  month: number;
  /** Starting point (visitor's position or a chosen municipality). null = unknown. */
  origin: Coord | null;
  events: IntelEvent[];
  municipalities: Map<string, MuniFeatures>;
  /** Current weather for a place, when the request succeeded. */
  weatherOf?: (p: IntelPlace) => WeatherNow | null;
  /** Detour from the current road route, when one exists (replaces straight-line distance). */
  detourOf?: (p: IntelPlace) => Detour | null;
  /** Regions and municipalities already in Mi Ruta (for the diversity bonus). */
  routeRegions?: Set<string>;
  routeMunicipalities?: Set<string>;
  /** Score on relevance alone (used only by the simulated scenario, to compare with and without bonuses). */
  disableBonuses?: boolean;
}

export interface Factor { id: FactorId; value: number | null; weight: number; reason: string | null; warning: string | null }
export interface Recommendation {
  place: IntelPlace;
  score: number;
  base: number;
  /** Diversity bonus (points). */
  bonus: number;
  /** Event bonus (points). */
  eventBonus: number;
  event: IntelEvent | null;
  factors: Factor[];
  reasons: string[];
  warnings: string[];
  evidence: EvidenceLevel;
  /** Share of the total weight that had data (0–1). */
  coverage: number;
  matched: ProfileInterest[];
  distanceKm: number | null;
  detour: Detour | null;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

export function haversineKm(a: Coord, b: Coord): number {
  const R = 6371.0088, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** "noviembre a marzo" for a contiguous run of months (wrapping the year), a list otherwise. */
export function monthRange(months: number[]): string {
  if (months.length >= 12) return 'todo el año';
  const set = new Set(months);
  const starts = months.filter((m) => !set.has(m === 1 ? 12 : m - 1));
  if (starts.length === 1) {
    const from = starts[0], to = ((from + months.length - 2) % 12) + 1;
    return months.length === 1 ? MONTHS_ES[from - 1] : `${MONTHS_ES[from - 1]} a ${MONTHS_ES[to - 1]}`;
  }
  return list([...months].sort((a, b) => a - b).map((m) => MONTHS_ES[m - 1]));
}

// ------------------------------------------------------------------ factors --
function interestFactor(p: IntelPlace, profile: TouristProfile): { f: Omit<Factor, 'id' | 'weight'>; matched: ProfileInterest[] } {
  if (!profile.interests.length) return { f: { value: null, reason: null, warning: null }, matched: [] };
  const matched = profile.interests.filter((i) => p.interests.includes(i));
  const weightSum = matched.reduce((s, i) => s + (p.derived_interests.includes(i) ? DERIVED_MATCH : 1), 0);
  const coverage = clamp01(weightSum / Math.min(profile.interests.length, 3));
  const focus = clamp01(weightSum / Math.max(1, p.interests.length));
  const value = INTEREST_MIX.coverage * coverage + INTEREST_MIX.focus * focus;
  if (!matched.length) return { f: { value: 0, reason: null, warning: null }, matched };
  const allDerived = matched.every((i) => p.derived_interests.includes(i));
  const n = matched.length;
  const reason = `Coincide con ${n === 1 ? 'tu interés' : `${n} de tus intereses`}: ${list(matched.map((i) => INTEREST_LABEL[i]))}${allDerived ? ' (clasificación derivada del tipo de lugar)' : ''}`;
  return { f: { value, reason, warning: null }, matched };
}

function seasonFactor(p: IntelPlace, month: number): Omit<Factor, 'id' | 'weight'> {
  const caution = p.caution_months?.includes(month) ? `La fuente oficial advierte sobre el clima en ${MONTHS_ES[month - 1]}: ${p.caution_note ?? 'condiciones extremas'}` : null;
  if (!p.recommended_months) return { value: caution ? 0.6 : null, reason: null, warning: caution };
  const range = monthRange(p.recommended_months);
  if (p.recommended_months.includes(month)) {
    return { value: 1, reason: p.recommended_months.length >= 12 ? 'Se recomienda todo el año, según la fuente oficial' : `Temporada favorable: la fuente oficial recomienda ${range}`, warning: caution };
  }
  return { value: 0.3, reason: null, warning: `Fuera de la temporada que recomienda la fuente oficial (${range})` };
}

export function weatherState(w: WeatherNow): 'storm' | 'rain' | 'dry' {
  if (w.code >= 95) return 'storm';
  if (w.precip > 0.2 || (w.code >= 51 && w.code <= 82) || (w.rainProb !== null && w.rainProb >= 70)) return 'rain';
  return 'dry';
}
function weatherFactor(p: IntelPlace, w: WeatherNow | null): Omit<Factor, 'id' | 'weight'> {
  if (!w || p.outdoor === null) return { value: null, reason: null, warning: null };
  const st = weatherState(w), t = `${Math.round(w.temp)} °C`;
  if (!p.outdoor) return { value: 0.9, reason: st === 'dry' ? null : 'Es bajo techo: la lluvia de hoy no la afecta', warning: null };
  if (st === 'storm') return { value: 0.15, reason: null, warning: `El clima actual puede afectar esta experiencia al aire libre: tormenta en la zona (${t})` };
  if (st === 'rain') return { value: 0.4, reason: null, warning: `El clima actual puede afectar esta experiencia al aire libre: lluvia o alta probabilidad de lluvia hoy (${t})` };
  return { value: 1, reason: `Clima actual compatible con una visita al aire libre (sin lluvia, ${t})`, warning: null };
}

function distanceFactor(p: IntelPlace, ctx: ScoreContext): { f: Omit<Factor, 'id' | 'weight'>; km: number | null; detour: Detour | null } {
  const NO_POINT = 'Sin punto propio en el mapa: no entra en cálculos de ruta';
  if (!p.coord) {
    // the place itself is never located, but its municipal seat (INEGI) tells how far the trip is
    const seat = p.municipality_id ? ctx.municipalities.get(p.municipality_id)?.coord ?? null : null;
    if (!ctx.origin) return { f: { value: null, reason: null, warning: NO_POINT }, km: null, detour: null };
    // origin known but nothing locates the place: a neutral value, so it neither wins nor loses on distance
    if (!seat) return { f: { value: 0.5, reason: null, warning: `${NO_POINT}; sin ubicación conocida, la distancia cuenta con un valor neutro` }, km: null, detour: null };
    const seatKm = haversineKm(ctx.origin, seat);
    const reachSeat = reachKm(ctx.profile.duration, ctx.profile.mode);
    const v = clamp01(1 - (seatKm - reachSeat * 0.5) / reachSeat) * 0.95 + 0.05;
    const far = seatKm > reachSeat ? `Queda lejos para ${DURATIONS.find((x) => x.id === ctx.profile.duration)!.label.toLowerCase()}: unos ${Math.round(seatKm)} km en línea recta hasta la cabecera de ${p.municipality}. ` : '';
    return { f: { value: v, reason: null, warning: `${far}${NO_POINT}; la distancia se mide a la cabecera municipal` }, km: null, detour: null };
  }
  const approx = p.coord_confidence === 'approximate' ? ' (ubicación aproximada)' : '';
  const detour = ctx.detourOf?.(p) ?? null;
  if (detour) {
    const value = clamp01(1 - (detour.extraMin - 10) / 50) * 0.9 + 0.1;
    const how = detour.measured ? 'por carretera' : 'estimados por distancia a la ruta';
    const text = `≈ +${Math.round(detour.extraMin)} min ${how}${approx}`;
    return detour.extraMin <= 30
      ? { f: { value, reason: `Cerca de tu recorrido: ${text}`, warning: null }, km: null, detour }
      : { f: { value, reason: null, warning: `Requiere un desvío considerable: ${text}` }, km: null, detour };
  }
  if (!ctx.origin) return { f: { value: null, reason: null, warning: null }, km: null, detour: null };
  const km = haversineKm(ctx.origin, p.coord);
  const reach = reachKm(ctx.profile.duration, ctx.profile.mode);
  const value = clamp01(1 - (km - reach * 0.5) / reach) * 0.95 + 0.05;
  const d = `${km < 10 ? km.toFixed(1) : Math.round(km)} km en línea recta de tu punto de partida${approx}`;
  const dur = DURATIONS.find((x) => x.id === ctx.profile.duration)!.label.toLowerCase();
  if (km <= reach) return { f: { value, reason: `A ${d}`, warning: null }, km, detour: null };
  return { f: { value, reason: null, warning: `Queda lejos para ${dur}: ${d}` }, km, detour: null };
}

/** Best event of the trip month in the municipality of the place (most certain date first), or null. */
export function eventOf(p: IntelPlace, ctx: ScoreContext): IntelEvent | null {
  if (!p.municipality_id) return null;
  const evs = ctx.events.filter((e) => e.municipality_id === p.municipality_id && e.months.includes(ctx.month) && e.date_confidence !== 'unknown');
  return [...evs].sort((x, y) => EVENT_BONUS[y.date_confidence] - EVENT_BONUS[x.date_confidence])[0] ?? null;
}
function eventReason(p: IntelPlace, e: IntelEvent, month: number): string {
  const status = e.date_confidence === 'confirmed' ? 'fecha confirmada' : e.date_confidence === 'pattern' ? 'fecha según patrón oficial; confirma el día' : 'según la última edición conocida; confirma si se repite';
  return `Evento en ${p.municipality} en ${MONTHS_ES[month - 1]}: ${e.name} (${status})`;
}

function supportFactor(p: IntelPlace, ctx: ScoreContext): Omit<Factor, 'id' | 'weight'> {
  // only matters when the visitor stays overnight
  if (ctx.profile.duration === 'half-day' || ctx.profile.duration === 'day') return { value: null, reason: null, warning: null };
  const m = p.municipality_id ? ctx.municipalities.get(p.municipality_id) : undefined;
  if (!m) return { value: null, reason: null, warning: null };
  const { lodging, food } = m.counts;
  if (lodging === 0) return { value: m.infrastructure_index * 0.6, reason: null, warning: `Sin hospedaje registrado en ${m.name}: planea dormir en otro municipio` };
  return { value: 0.4 + 0.6 * m.infrastructure_index, reason: `Hay hospedaje y alimentos registrados en ${m.name} (${lodging} y ${food} registros; no confirma disponibilidad)`, warning: null };
}

const EVIDENCE_VALUE: Record<EvidenceLevel, number> = { alta: 1, media: 0.7, baja: 0.4 };

// -------------------------------------------------------------------- score --
export function scorePlace(p: IntelPlace, ctx: ScoreContext): Recommendation {
  const i = interestFactor(p, ctx.profile);
  const d = distanceFactor(p, ctx);
  const raw: Record<FactorId, Omit<Factor, 'id' | 'weight'>> = {
    interest: i.f,
    distance: d.f,
    season: seasonFactor(p, ctx.month),
    support: supportFactor(p, ctx),
    weather: weatherFactor(p, ctx.weatherOf?.(p) ?? null),
    evidence: { value: EVIDENCE_VALUE[p.evidence], reason: null, warning: p.evidence === 'baja' ? 'Información limitada: confirma antes de ir' : null },
  };
  const factors = (Object.keys(WEIGHTS) as FactorId[]).map((id) => ({ id, weight: WEIGHTS[id], ...raw[id] }));
  const withData = factors.filter((f) => f.value !== null);
  const wSum = withData.reduce((s, f) => s + f.weight, 0);
  const base = wSum > 0 ? (100 * withData.reduce((s, f) => s + f.weight * (f.value as number), 0)) / wSum : 0;

  // ---- bonuses: only for places that are already relevant, and only upwards ----------
  let bonus = 0, eventBonus = 0;
  const reasons = factors.map((f) => f.reason).filter((r): r is string => !!r);
  const event = eventOf(p, ctx);
  if (event && base >= RELEVANCE_GATE && !ctx.disableBonuses) eventBonus = EVENT_BONUS[event.date_confidence];
  if (event) reasons.push(eventReason(p, event, ctx.month));
  if (base >= RELEVANCE_GATE && !ctx.disableBonuses) {
    const muni = p.municipality_id ? ctx.municipalities.get(p.municipality_id) : undefined;
    if (ctx.routeRegions?.size && p.region && !ctx.routeRegions.has(p.region)) { bonus += 3; reasons.push(`Añade una región distinta a tu viaje: ${REGION_LABEL[p.region]}`); }
    else if (ctx.routeMunicipalities?.size && p.municipality_id && !ctx.routeMunicipalities.has(p.municipality_id)) { bonus += 1.5; reasons.push(`Añade un municipio distinto a tu viaje: ${p.municipality}`); }
    if (muni && muni.exposure_proxy < LOW_EXPOSURE && muni.diversification_potential >= MIN_POTENTIAL) { bonus += 3 * muni.diversification_potential; reasons.push(`${muni.name} tiene oferta poco expuesta (indicador derivado, no mide afluencia)`); }
    bonus = Math.min(DIVERSITY_BONUS_MAX, bonus);
  }
  const coverage = wSum / Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
  // the recommendation is as strong as its weakest basis: the record itself and how many factors had data
  const evidence: EvidenceLevel = p.evidence === 'baja' || coverage < 0.4 ? 'baja' : p.evidence === 'media' || coverage < 0.6 ? 'media' : 'alta';
  return {
    place: p,
    score: Math.round(Math.min(100, base + eventBonus + bonus)),
    base: Math.round(base * 10) / 10,
    bonus: Math.round(bonus * 10) / 10,
    eventBonus,
    event,
    factors,
    reasons,
    warnings: factors.map((f) => f.warning).filter((w): w is string => !!w),
    evidence,
    coverage: Math.round(coverage * 100) / 100,
    matched: i.matched,
    distanceKm: d.km,
    detour: d.detour,
  };
}

export interface RankOptions {
  limit?: number;
  /** At most this many places of one municipality in the list (a list rule, not a score penalty). */
  perMunicipality?: number;
  exclude?: Set<string>;
  /** Drop places that match none of the chosen interests (when the visitor chose any). */
  requireMatch?: boolean;
}

export function rank(places: IntelPlace[], ctx: ScoreContext, opt: RankOptions = {}): Recommendation[] {
  const { limit = 12, perMunicipality = 3, exclude, requireMatch = true } = opt;
  const order: Record<EvidenceLevel, number> = { alta: 0, media: 1, baja: 2 };
  const scored = places
    .filter((p) => !exclude?.has(p.id) && !(p.route_id && exclude?.has(p.route_id)))
    .map((p) => scorePlace(p, ctx))
    .filter((r) => !requireMatch || !ctx.profile.interests.length || r.matched.length > 0)
    .sort((a, b) => b.score - a.score || order[a.evidence] - order[b.evidence] || a.place.name.localeCompare(b.place.name, 'es'));
  const perMuni = new Map<string, number>();
  const out: Recommendation[] = [];
  for (const r of scored) {
    const k = r.place.municipality_id ?? r.place.id;
    const n = perMuni.get(k) ?? 0;
    if (n >= perMunicipality) continue;
    perMuni.set(k, n + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}
