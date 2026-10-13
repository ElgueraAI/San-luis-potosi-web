/**
 * Behavioural segmentation, first stage: interpretable segments.
 *
 * There are no observations of real visitors yet, so nothing is trained here.
 * A segment is a named, weighted combination of the profile's interests (plus
 * the trip length for the weekend getaway), and a session is assigned to the
 * segment it resembles most. The rule, its inputs and its output are all
 * visible to the visitor and to an evaluator.
 *
 * `sessionFeatures()` builds the numeric row a future model (K-Means,
 * hierarchical clustering, DBSCAN, cohort analysis) would be trained on, once
 * enough consented, observed sessions exist. The roadmap and the minimum data
 * requirements are in docs/smart-marketing-methodology.md.
 */
import { INTERESTS } from './taxonomy';
import type { Duration, IntelPlace, ProfileInterest, TouristProfile } from './types';

export type SegmentId =
  | 'explorador-natural' | 'aventurero' | 'viajero-cultural' | 'explorador-patrimonial'
  | 'viajero-gastronomico' | 'explorador-de-pueblos' | 'viajero-familiar' | 'escapada-fin-de-semana';

export interface Segment {
  id: SegmentId;
  name: string;
  /** One line: who this is. */
  summary: string;
  /** Interest weights (0–1). The first one defines the segment. */
  weights: Partial<Record<ProfileInterest, number>>;
  /** Trip lengths that characterise the segment, when length matters. */
  durations?: Partial<Record<Duration, number>>;
}

export const SEGMENTS: Segment[] = [
  { id: 'explorador-natural', name: 'Explorador natural', summary: 'Busca paisaje, agua y aire libre, a su ritmo.', weights: { naturaleza: 1, agua: 0.8, fotografia: 0.5, relajacion: 0.3 } },
  { id: 'aventurero', name: 'Aventurero', summary: 'Quiere actividad: rápidos, sótanos, escalada, senderos.', weights: { aventura: 1, agua: 0.6, naturaleza: 0.5 } },
  { id: 'viajero-cultural', name: 'Viajero cultural', summary: 'Sigue museos, arte, tradiciones y cultura viva.', weights: { cultura: 1, arte: 0.8, historia: 0.5 } },
  { id: 'explorador-patrimonial', name: 'Explorador patrimonial', summary: 'Recorre minas, haciendas, centros históricos y zonas arqueológicas.', weights: { historia: 1, arqueologia: 0.9, cultura: 0.4, 'pueblos-magicos': 0.3 } },
  { id: 'viajero-gastronomico', name: 'Viajero gastronómico', summary: 'Organiza el viaje alrededor de lo que se come y se bebe.', weights: { gastronomia: 1, cultura: 0.3, 'pueblos-magicos': 0.3 } },
  { id: 'explorador-de-pueblos', name: 'Explorador de pueblos', summary: 'Colecciona Pueblos Mágicos y plazas con historia.', weights: { 'pueblos-magicos': 1, historia: 0.4, gastronomia: 0.4, fotografia: 0.4, cultura: 0.3 } },
  { id: 'viajero-familiar', name: 'Viajero familiar', summary: 'Planea para varias edades: balnearios, museos interactivos, paseos tranquilos.', weights: { familia: 1, relajacion: 0.6, agua: 0.4, cultura: 0.2 } },
  { id: 'escapada-fin-de-semana', name: 'Escapada de fin de semana', summary: 'Dos días, pocas paradas y poco volante.', weights: { relajacion: 0.5, gastronomia: 0.3, 'pueblos-magicos': 0.3 }, durations: { weekend: 1, 'two-days': 0.8 } },
];
export const SEGMENT_BY_ID = new Map(SEGMENTS.map((s) => [s.id, s]));

/** Below this affinity no segment is assigned ("perfil aún sin definir"). */
export const MIN_AFFINITY = 0.25;
/** How much each source of evidence counts when building the interest signal. */
export const SIGNAL_WEIGHTS = { declared: 1, saved: 0.6, behaviour: 0.4 } as const;

export interface SegmentInput {
  profile: TouristProfile;
  /** Places saved in Mi Ruta (their interests are behaviour, not a declaration). */
  saved?: IntelPlace[];
  /** Interest signals from the local event log (analytics.interestSignals). */
  behaviour?: Partial<Record<ProfileInterest, number>>;
}

const normalize = (m: Partial<Record<ProfileInterest, number>>): Partial<Record<ProfileInterest, number>> => {
  const max = Math.max(0, ...Object.values(m).map((v) => v ?? 0));
  return max > 0 ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, (v ?? 0) / max])) : {};
};

/** Interest signal 0–1 per interest: declared choices, saved places and logged behaviour, each normalised first. */
export function interestSignal(input: SegmentInput): Record<ProfileInterest, number> {
  const savedCount: Partial<Record<ProfileInterest, number>> = {};
  for (const p of input.saved ?? []) for (const i of p.interests) savedCount[i] = (savedCount[i] ?? 0) + 1;
  const saved = normalize(savedCount), behaviour = normalize(input.behaviour ?? {});
  const out = {} as Record<ProfileInterest, number>;
  for (const i of INTERESTS) {
    const v = (input.profile.interests.includes(i) ? SIGNAL_WEIGHTS.declared : 0) + SIGNAL_WEIGHTS.saved * (saved[i] ?? 0) + SIGNAL_WEIGHTS.behaviour * (behaviour[i] ?? 0);
    out[i] = Math.min(1, v);
  }
  return out;
}

export interface SegmentMatch { segment: Segment; affinity: number; drivers: ProfileInterest[] }
export interface SegmentResult {
  /** null when nothing reaches MIN_AFFINITY. */
  primary: SegmentMatch | null;
  ranking: SegmentMatch[];
  /** Whether anything at all is known about the session. */
  hasSignal: boolean;
}

/** Share of the affinity that comes from what defines the segment; the rest comes from its supporting interests. */
export const DEFINING_SHARE = 0.6;

/**
 * Affinity of a session to a segment, 0–1:
 *   0.6 × the signal of the interest that defines the segment (its first weight)
 * + 0.4 × the weighted mean of the signal over its supporting interests.
 * For a segment defined by trip length, the trip length takes the 0.6 and all
 * its interests are supporting. Giving the defining interest its own share
 * keeps a segment with many optional interests from losing to a narrow one.
 */
export function affinity(segment: Segment, signal: Record<ProfileInterest, number>, duration: Duration): { value: number; drivers: ProfileInterest[] } {
  const entries = Object.entries(segment.weights) as [ProfileInterest, number][];
  const drivers = entries.filter(([i]) => signal[i] > 0).sort((a, b) => b[1] * signal[b[0]] - a[1] * signal[a[0]]).map(([i]) => i);
  const mean = (list: [ProfileInterest, number][]) => { const w = list.reduce((s, [, x]) => s + x, 0); return w ? list.reduce((s, [i, x]) => s + x * signal[i], 0) / w : 0; };
  if (segment.durations) return { value: DEFINING_SHARE * (segment.durations[duration] ?? 0) + (1 - DEFINING_SHARE) * mean(entries), drivers };
  const [lead, ...support] = entries;
  return { value: DEFINING_SHARE * signal[lead[0]] + (1 - DEFINING_SHARE) * mean(support), drivers };
}

export function segmentFor(input: SegmentInput): SegmentResult {
  const signal = interestSignal(input);
  const hasSignal = Object.values(signal).some((v) => v > 0);
  const ranking = SEGMENTS.map((segment) => { const a = affinity(segment, signal, input.profile.duration); return { segment, affinity: Math.round(a.value * 100) / 100, drivers: a.drivers }; })
    // a length-defined segment needs the length to match; otherwise it would win by default on an empty profile
    .filter((m) => !m.segment.durations || (m.segment.durations[input.profile.duration] ?? 0) > 0)
    .sort((a, b) => b.affinity - a.affinity || SEGMENTS.indexOf(a.segment) - SEGMENTS.indexOf(b.segment));
  const top = ranking[0];
  // interest-defined segments also need at least one interest signal
  const eligible = top && top.affinity >= MIN_AFFINITY && (top.segment.durations ? true : hasSignal);
  return { primary: eligible ? top : null, ranking, hasSignal };
}

// ----------------------------------------------------- future analytical schema --
const DURATION_ORDINAL: Record<Duration, number> = { 'half-day': 0, day: 1, 'two-days': 2, weekend: 2, long: 3 };

/** Column names of the session feature row, in order. */
export const FEATURE_COLUMNS = [
  ...INTERESTS.map((i) => `interest_${i}`),
  'duration_ordinal', 'mode_car', 'mode_bike', 'mode_foot', 'budget_ordinal',
  'stops', 'regions', 'municipalities', 'share_flagship', 'share_low_exposure',
  'recommendations_seen', 'recommendations_added', 'add_rate', 'optimized', 'month',
] as const;

export interface SessionFeaturesInput extends SegmentInput {
  /** exposure proxy per municipality id, to describe what the session saved */
  exposureOf?: (municipalityId: string) => number | null;
  recommendationsSeen?: number;
  recommendationsAdded?: number;
  optimized?: boolean;
  month?: number;
}

/**
 * One row per session, numbers only, no identifier and no position: what a
 * clustering model would read. Built and exportable today so the schema is
 * exercised; training waits for observed data.
 */
export function sessionFeatures(input: SessionFeaturesInput): Record<(typeof FEATURE_COLUMNS)[number], number> {
  const signal = interestSignal(input);
  const saved = input.saved ?? [];
  const exposures = saved.map((p) => (p.municipality_id ? input.exposureOf?.(p.municipality_id) ?? null : null)).filter((v): v is number => v !== null);
  const seen = input.recommendationsSeen ?? 0, added = input.recommendationsAdded ?? 0;
  const row: Record<string, number> = {};
  for (const i of INTERESTS) row[`interest_${i}`] = Math.round(signal[i] * 100) / 100;
  Object.assign(row, {
    duration_ordinal: DURATION_ORDINAL[input.profile.duration],
    mode_car: +(input.profile.mode === 'car'), mode_bike: +(input.profile.mode === 'bike'), mode_foot: +(input.profile.mode === 'foot'),
    budget_ordinal: input.profile.budget === 'economico' ? 0 : input.profile.budget === 'medio' ? 1 : 2,
    stops: saved.length,
    regions: new Set(saved.map((p) => p.region).filter(Boolean)).size,
    municipalities: new Set(saved.map((p) => p.municipality_id).filter(Boolean)).size,
    share_flagship: saved.length ? Math.round((saved.filter((p) => p.priority === 'A').length / saved.length) * 100) / 100 : 0,
    share_low_exposure: exposures.length ? Math.round((exposures.filter((e) => e < 0.4).length / exposures.length) * 100) / 100 : 0,
    recommendations_seen: seen,
    recommendations_added: added,
    add_rate: seen ? Math.round((added / seen) * 100) / 100 : 0,
    optimized: +!!input.optimized,
    month: input.month ?? 0,
  });
  return row as Record<(typeof FEATURE_COLUMNS)[number], number>;
}
