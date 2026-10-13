/**
 * Assembles the intelligence dataset from raw research/entities sets. Pure:
 * the site build (src/data/intel.ts) and the node report/tests call the same
 * function, so the numbers in the docs are the numbers the site uses.
 */
import { municipalityFeatures, type RawMunicipality } from './features';
import { normalizeEvent, normalizePlace, seasonIndex, type RawEntity, type RawSeasonRecord } from './normalize';
import type { IntelEvent, IntelPlace, MuniFeatures } from './types';

export interface RawSets {
  attractions: RawEntity[];
  archaeology: RawEntity[];
  museums: RawEntity[];
  venues: RawEntity[];
  recreation: RawEntity[];
  /** events + seasonal-experience records */
  events: RawEntity[];
  municipalities: RawMunicipality[];
  seasonRecords?: RawSeasonRecord[];
  /** research/destinations/index.json → { place_id, priority } */
  priorities?: { place_id: string; priority: string }[];
}

/**
 * Which records the recommender may suggest.
 *  - heritage declarations are context (several are intangible), not a point to visit;
 *  - DENUE balnearios: only public ones (a private club is not a tourism asset);
 *  - auditoriums, theatres and cultural centres are venues, filtered out by kindOf().
 */
export function isCandidate(p: IntelPlace, raw: RawEntity): boolean {
  if (p.kind === 'heritage') return false;
  if (p.kind === 'recreation') return /p[uú]blico|gruta|parque natural/i.test(raw.subcategory ?? '');
  return true;
}

export function buildDataset(raw: RawSets): { places: IntelPlace[]; municipalities: MuniFeatures[]; events: IntelEvent[] } {
  const season = seasonIndex(raw.events.filter((e) => e.entity_type === 'seasonal-experience'), raw.seasonRecords ?? []);
  const priority = new Map((raw.priorities ?? []).filter((p) => /^[ABC]$/.test(p.priority)).map((p) => [p.place_id, p.priority as 'A' | 'B' | 'C']));
  const places: IntelPlace[] = [];
  for (const e of [...raw.attractions, ...raw.archaeology, ...raw.museums, ...raw.venues, ...raw.recreation]) {
    const p = normalizePlace(e, { season, priority });
    if (p && isCandidate(p, e)) places.push(p);
  }
  const events = raw.events.map(normalizeEvent).filter((e): e is IntelEvent => !!e);
  return { places, municipalities: municipalityFeatures(raw.municipalities, places), events };
}
