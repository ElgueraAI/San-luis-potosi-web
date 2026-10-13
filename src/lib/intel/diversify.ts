/**
 * Tourism redistribution engine.
 *
 * For a place the visitor already cares about (an "anchor": a saved stop or a
 * top recommendation), it looks for a RELEVANT alternative in another, less
 * exposed municipality, at a small extra cost. It is not a random push towards
 * unknown places: a candidate must first pass every gate (similar interests,
 * within reach, reliable information, somewhere to eat or sleep nearby, lower
 * exposure than the anchor's municipality), and only then is it ranked by the
 * Diversification Opportunity Score.
 *
 *   DOS = 100 × Σ wᵢ·cᵢ / Σ wᵢ   over the components that have data
 *
 * "Exposure" is a proxy (lodging stock, flagship destinations, Pueblo Mágico
 * status). There is no visitor, occupancy or crowding data in this project, so
 * no sentence here says or implies that a place is crowded.
 * Method, formula and limits: docs/tourism-redistribution-methodology.md.
 */
import { haversineKm, type Detour } from './scoring';
import { INTEREST_LABEL, REGION_LABEL } from './taxonomy';
import type { IntelPlace, MuniFeatures, ProfileInterest, TravelMode } from './types';

export const DOS_WEIGHTS = { similarity: 0.3, cost: 0.2, exposureGap: 0.2, infrastructure: 0.1, novelty: 0.1, season: 0.05, evidence: 0.05 } as const;
export type DosComponent = keyof typeof DOS_WEIGHTS;
export const DOS_LABEL: Record<DosComponent, string> = {
  similarity: 'Similitud de intereses', cost: 'Coste adicional (distancia o desvío)', exposureGap: 'Menor exposición que el lugar de referencia (proxy)',
  infrastructure: 'Infraestructura turística registrada', novelty: 'Variedad territorial', season: 'Temporada', evidence: 'Calidad de la información',
};
/** Gates: relevance comes before diversification. */
export const MIN_SIMILARITY = 0.3;
export const MIN_EXPOSURE_GAP = 0.1;
export const MIN_INFRASTRUCTURE = 0.15;
/** How far from the anchor an alternative may be (km, straight line), by travel mode. */
export const ALT_REACH_KM: Record<TravelMode, number> = { car: 110, bike: 25, foot: 6 };
/** With a route, the alternative must not add more than this (min). */
export const ALT_MAX_DETOUR_MIN = 45;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/**
 * Jaccard similarity over the features of the two places: their interests plus
 * their region (two mining towns of the Altiplano are more alike than a mining
 * town and a Huasteca town with the same tag). Without a shared interest the
 * similarity is 0: sharing a region alone is not a reason to suggest a place.
 */
export function similarity(a: IntelPlace, b: IntelPlace): { value: number; shared: ProfileInterest[]; sameRegion: boolean } {
  const shared = a.interests.filter((i) => b.interests.includes(i));
  const sameRegion = !!a.region && a.region === b.region;
  if (!shared.length) return { value: 0, shared, sameRegion };
  const union = new Set([...a.interests, ...b.interests]).size + (a.region && b.region ? (sameRegion ? 1 : 2) : 0);
  return { value: (shared.length + (sameRegion ? 1 : 0)) / union, shared, sameRegion };
}

export interface Alternative {
  place: IntelPlace;
  anchor: IntelPlace;
  /** Diversification Opportunity Score, 0–100. */
  score: number;
  components: { id: DosComponent; value: number | null; weight: number }[];
  shared: ProfileInterest[];
  km: number;
  detour: Detour | null;
  exposure: { anchor: number; candidate: number };
  /** One sentence for the visitor. */
  sentence: string;
  reasons: string[];
}

export interface DiversifyOptions {
  month: number;
  mode: TravelMode;
  municipalities: Map<string, MuniFeatures>;
  /** Places already saved (never offered). */
  exclude?: Set<string>;
  /** Regions already in the trip (a new one adds more variety). */
  routeRegions?: Set<string>;
  /** Detour from the current road route, when there is one. */
  detourOf?: (p: IntelPlace) => Detour | null;
  /** Interests the visitor chose; an alternative must share at least one with them when given. */
  interests?: ProfileInterest[];
}

export function alternativesFor(anchor: IntelPlace, places: IntelPlace[], opt: DiversifyOptions): Alternative[] {
  const am = anchor.municipality_id ? opt.municipalities.get(anchor.municipality_id) : undefined;
  if (!anchor.coord || !am) return []; // the anchor cannot be located or has no municipal context: nothing to compare against
  const out: Alternative[] = [];
  for (const p of places) {
    if (p.id === anchor.id || opt.exclude?.has(p.id) || (p.route_id && opt.exclude?.has(p.route_id))) continue;
    if (!p.coord || !p.municipality_id || p.municipality_id === anchor.municipality_id) continue;
    if (p.evidence === 'baja') continue; // reliable information only
    const cm = opt.municipalities.get(p.municipality_id);
    if (!cm) continue;
    const sim = similarity(anchor, p);
    if (sim.value < MIN_SIMILARITY) continue;
    if (opt.interests?.length && !p.interests.some((i) => opt.interests!.includes(i))) continue;
    const gap = am.exposure_proxy - cm.exposure_proxy;
    if (gap < MIN_EXPOSURE_GAP) continue; // not a less exposed municipality: not a redistribution
    if (cm.infrastructure_index < MIN_INFRASTRUCTURE) continue; // nowhere registered to eat or sleep: not a fair suggestion
    const km = haversineKm(anchor.coord, p.coord);
    const detour = opt.detourOf?.(p) ?? null;
    if (detour ? detour.extraMin > ALT_MAX_DETOUR_MIN : km > ALT_REACH_KM[opt.mode]) continue;

    const season = p.recommended_months ? (p.recommended_months.includes(opt.month) ? 1 : 0.3) : null;
    const newRegion = !!p.region && p.region !== anchor.region && !opt.routeRegions?.has(p.region);
    const values: Record<DosComponent, number | null> = {
      similarity: sim.value,
      cost: detour ? clamp01(1 - detour.extraMin / ALT_MAX_DETOUR_MIN) : clamp01(1 - km / ALT_REACH_KM[opt.mode]),
      exposureGap: clamp01(gap / 0.5),
      infrastructure: cm.infrastructure_index,
      novelty: newRegion ? 1 : 0.6,
      season,
      evidence: p.evidence === 'alta' ? 1 : 0.7,
    };
    const components = (Object.keys(DOS_WEIGHTS) as DosComponent[]).map((id) => ({ id, value: values[id], weight: DOS_WEIGHTS[id] }));
    const withData = components.filter((c) => c.value !== null);
    const score = (100 * withData.reduce((s, c) => s + c.weight * (c.value as number), 0)) / withData.reduce((s, c) => s + c.weight, 0);

    const sharedText = list([...sim.shared.map((i) => INTEREST_LABEL[i]), ...(sim.sameRegion ? [`la región ${REGION_LABEL[p.region!]}`] : [])]);
    const cost = detour ? `añade ≈ ${Math.round(detour.extraMin)} min ${detour.measured ? 'por carretera' : 'estimados'} a tu recorrido` : `queda a ${Math.round(km)} km en línea recta de ${anchor.name}`;
    const where = p.region && !sim.sameRegion ? `, en la región ${REGION_LABEL[p.region]}` : '';
    const reasons = [
      `Comparte con ${anchor.name}: ${sharedText}`,
      detour ? `Añade ≈ ${Math.round(detour.extraMin)} min ${detour.measured ? 'por carretera' : 'estimados por distancia a tu ruta'}` : `A ${Math.round(km)} km en línea recta de ${anchor.name}${p.coord_confidence === 'approximate' ? ' (ubicación aproximada)' : ''}`,
      `${cm.name} tiene menor exposición turística estimada que ${am.name} (proxy ${cm.exposure_proxy.toFixed(2)} frente a ${am.exposure_proxy.toFixed(2)}; no mide afluencia)`,
      `Hay servicios registrados en ${cm.name}: ${cm.counts.lodging} de hospedaje y ${cm.counts.food} de alimentos (no confirma disponibilidad)`,
    ];
    if (season === 1) reasons.push('Está en la temporada que recomienda la fuente oficial');
    if (newRegion) reasons.push(`Suma una región distinta a tu viaje: ${REGION_LABEL[p.region!]}`);
    out.push({
      place: p, anchor, score: Math.round(score), components, shared: sim.shared, km, detour,
      exposure: { anchor: am.exposure_proxy, candidate: cm.exposure_proxy },
      sentence: `Te interesa ${anchor.name}. También puedes explorar ${p.name}, en ${cm.name}${where}: comparte ${sharedText}; ${cost}.`,
      reasons,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.km - b.km);
}

/**
 * Alternatives for a whole trip: the best one per anchor, anchors taken from
 * the most exposed municipality down, no place offered twice.
 */
export function diversifyTrip(anchors: IntelPlace[], places: IntelPlace[], opt: DiversifyOptions, limit = 3): Alternative[] {
  const exposure = (p: IntelPlace) => (p.municipality_id ? opt.municipalities.get(p.municipality_id)?.exposure_proxy ?? 0 : 0);
  const used = new Set<string>();
  const usedMuni = new Set<string>();
  const out: Alternative[] = [];
  for (const a of [...anchors].sort((x, y) => exposure(y) - exposure(x))) {
    const best = alternativesFor(a, places, opt).find((alt) => !used.has(alt.place.id) && !usedMuni.has(alt.place.municipality_id!));
    if (!best) continue;
    used.add(best.place.id);
    usedMuni.add(best.place.municipality_id!);
    out.push(best);
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => b.score - a.score);
}
