/**
 * Normalization: research/entities records → IntelPlace, MuniFeatures inputs
 * and IntelEvent. Pure functions over plain JSON, so the same code feeds the
 * site build (src/data/intel.ts), the quality report (scripts/intel/report.mjs)
 * and the tests.
 *
 * Rules
 *  - A field the source does not give stays null; no default is invented.
 *  - Interests implied by an official type are kept apart as `derived_interests`.
 *  - Recommended months come only from official season statements
 *    (seasonal-experience records). A place without one has `null`, which the
 *    recommender treats as "no evidence", never as "out of season".
 *  - DENUE balnearios are register rows: evidence is never above "baja".
 */
import { isOutdoor, kindInterests, KIND_LABEL, TAG_MAP } from './taxonomy';
import type { Confidence, Coord, EvidenceLevel, IntelEvent, IntelKind, IntelPlace, ProfileInterest, Provenance, RegionId } from './types';

/** The fields of a research/entities record this layer reads. */
export interface RawEntity {
  id: string; canonical_name: string; entity_type: string; subcategory?: string | null;
  municipality?: string | null; municipality_id?: string | null; region?: string | null;
  latitude?: number | null; longitude?: number | null; coordinate_status?: string | null;
  short_description?: string | null; official_url?: string | null; source_ids?: string[];
  verification_status?: string | null; tags?: string[]; pueblo_magico?: boolean | null;
  image_ids?: string[]; related_entities?: string[]; months?: number[]; date_status?: string | null;
  access_status?: string; last_verified?: string | null; denue?: unknown; official_directory?: boolean;
}
export interface RawSeasonRecord { record_id: string; destination: string; months?: number[]; rain_dry_context?: string | null; source_id?: string | null; notes?: string | null }
export interface RawSource { source_id: string; institution?: string | null; title?: string | null; url?: string | null; source_type?: string | null; retrieval_date?: string | null; verification_status?: string | null }

const REGIONS = new Set(['altiplano', 'centro', 'zona-media', 'huasteca']);
export const asRegion = (r: string | null | undefined): RegionId | null => (r && REGIONS.has(r) ? (r as RegionId) : null);

/** San Luis Potosí bounding box (INEGI Marco Geoestadístico extremes, padded 0.05°). */
export const SLP_BBOX = { minLon: -102.35, maxLon: -98.28, minLat: 21.11, maxLat: 24.54 };
export const inSlp = (c: Coord) => c[0] >= SLP_BBOX.minLon && c[0] <= SLP_BBOX.maxLon && c[1] >= SLP_BBOX.minLat && c[1] <= SLP_BBOX.maxLat;
export const validCoord = (lon: unknown, lat: unknown): lon is number =>
  typeof lon === 'number' && typeof lat === 'number' && Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && !(lon === 0 && lat === 0);

export function coordConfidence(status: string | null | undefined): Confidence {
  switch (status) {
    case 'verified': return 'verified';
    case 'registry': return 'official'; // georeferenced by INEGI (DENUE)
    case 'approximate': case 'municipal-seat': return 'approximate';
    default: return 'unknown';
  }
}
export function sourceConfidence(status: string | null | undefined): Confidence {
  switch (status) {
    case 'verified': return 'verified';
    case 'listed': case 'official-directory': case 'official': case 'registry': return 'official';
    case 'partial': case 'documented': return 'approximate';
    default: return 'unknown';
  }
}

const KIND: Record<string, IntelKind> = {
  destination: 'destination', 'protected-area': 'protected-area', 'religious-landmark': 'religious-landmark',
  'heritage-declaration': 'heritage', 'archaeological-site': 'archaeology', museum: 'museum', recreation: 'recreation',
};
/** null = the record is not a visitable asset for the recommender (auditoriums, theatres, businesses…). */
export function kindOf(e: RawEntity): IntelKind | null {
  if (e.entity_type === 'cultural-venue') return e.subcategory === 'Galería' ? 'gallery' : /artesan/i.test(e.subcategory ?? '') ? 'craft' : null;
  return KIND[e.entity_type] ?? null;
}

/**
 * Evidence level of a record: how much of it is backed by something checkable.
 * points = source (verified 2, official 1) + point (verified 2, official 1.5,
 * approximate 1) + description (1). alta ≥ 4, media ≥ 2.5, baja below.
 * Register rows (DENUE) are capped at "baja": the register does not confirm
 * that the place operates today.
 */
export function evidenceLevel(source: Confidence, coord: Confidence, hasDescription: boolean, registerOnly = false): EvidenceLevel {
  const pts = (source === 'verified' ? 2 : source === 'official' ? 1 : 0)
    + (coord === 'verified' ? 2 : coord === 'official' ? 1.5 : coord === 'approximate' ? 1 : 0)
    + (hasDescription ? 1 : 0);
  if (registerOnly) return 'baja';
  return pts >= 4 ? 'alta' : pts >= 2.5 ? 'media' : 'baja';
}

export interface SeasonIndex { months: Map<string, { months: number[]; source: string }>; cautions: Map<string, { months: number[]; note: string }> }

/** Official season statements per destination id, plus climate cautions (kept apart). */
export function seasonIndex(seasonalExperiences: RawEntity[], seasonRecords: RawSeasonRecord[] = []): SeasonIndex {
  const months = new Map<string, { months: number[]; source: string }>();
  for (const x of seasonalExperiences) {
    if (!x.months?.length) continue; // "en temporada de lluvias": a period, not months
    for (const id of x.related_entities ?? []) months.set(id, { months: [...x.months].sort((a, b) => a - b), source: (x.source_ids ?? [])[0] ?? x.id });
  }
  const cautions = new Map<string, { months: number[]; note: string }>();
  for (const r of seasonRecords) {
    // the research layer marks these explicitly: "Climate caution, not a recommendation."
    if (!/caution/i.test(r.notes ?? '') || !r.months?.length) continue;
    for (const id of r.destination.split('|')) cautions.set(id, { months: r.months, note: (r.rain_dry_context ?? '').split(' Supporting data')[0].replace(/\s*\(brochure\)\.?$/, '.').trim() });
  }
  return { months, cautions };
}

export interface NormalizeOptions {
  season?: SeasonIndex;
  /** Editorial priority per destination id (research/destinations/index.json). */
  priority?: Map<string, 'A' | 'B' | 'C'>;
}

export function normalizePlace(e: RawEntity, opt: NormalizeOptions = {}): IntelPlace | null {
  const kind = kindOf(e);
  if (!kind) return null;
  const stated = [...new Set((e.tags ?? []).flatMap((t) => TAG_MAP[t] ?? []))];
  if (e.pueblo_magico && !stated.includes('pueblos-magicos')) stated.push('pueblos-magicos');
  const derived = kindInterests(kind, e.subcategory ?? null).filter((i) => !stated.includes(i));
  const interests: ProfileInterest[] = [...stated, ...derived];
  const has = validCoord(e.longitude, e.latitude);
  const coord: Coord | null = has ? [e.longitude as number, e.latitude as number] : null;
  const cc = coord ? coordConfidence(e.coordinate_status) : 'unknown';
  const sc = sourceConfidence(e.verification_status);
  const s = opt.season?.months.get(e.id);
  const c = opt.season?.cautions.get(e.id);
  return {
    id: e.id,
    name: e.canonical_name,
    kind,
    label: kind === 'destination' ? (e.pueblo_magico ? 'Pueblo Mágico' : (e.subcategory ?? 'Destino').split('/')[0].trim()) : e.subcategory ?? KIND_LABEL[kind],
    region: asRegion(e.region),
    municipality: e.municipality ?? null,
    municipality_id: e.municipality_id ?? null,
    coord,
    coord_confidence: cc,
    interests,
    derived_interests: derived,
    recommended_months: s?.months ?? null,
    season_source: s?.source ?? null,
    caution_months: c?.months ?? null,
    caution_note: c?.note ?? null,
    outdoor: isOutdoor(kind, interests),
    pueblo_magico: !!e.pueblo_magico,
    priority: kind === 'destination' ? opt.priority?.get(e.id) ?? null : null,
    description: e.short_description ?? null,
    url: null,
    image: null,
    official_url: e.official_url && /^https?:/i.test(e.official_url) ? e.official_url : null,
    source_ids: (e.source_ids ?? []).filter(Boolean),
    source_confidence: sc,
    evidence: evidenceLevel(sc, cc, !!e.short_description, !!e.denue),
    route_id: null,
  };
}

export function normalizeEvent(e: RawEntity): IntelEvent | null {
  if (e.entity_type !== 'event') return null;
  const ds = e.date_status ?? null;
  return {
    id: e.id,
    name: e.canonical_name,
    municipality_id: e.municipality_id ?? null,
    municipality: e.municipality ?? null,
    region: asRegion(e.region),
    months: e.months ?? [],
    date_status: ds,
    date_confidence: ds === 'CONFIRMED_CURRENT_YEAR' ? 'confirmed' : ds === 'RECURRENT_OFFICIAL_PATTERN' ? 'pattern' : ds === 'HISTORICAL_LAST_CONFIRMED' ? 'past' : 'unknown',
    url: null,
  };
}

/** Source registry row → provenance. Unknown ids keep the id and say "unknown". */
export function provenance(id: string, registry: Map<string, RawSource>): Provenance {
  const s = registry.get(id);
  if (!s) {
    // brochures and the state urban plan are cited by short ids across the research layer
    if (id.startsWith('brochure-')) return { source_id: id, source_name: 'Folleto oficial regional, Secretaría de Turismo de SLP', source_url: null, source_type: 'official', retrieved_at: null, licence: null };
    if (id === 'pdu-slp') return { source_id: id, source_name: 'Plan Estatal de Desarrollo Urbano de SLP', source_url: null, source_type: 'official', retrieved_at: null, licence: null };
    return { source_id: id, source_name: null, source_url: null, source_type: 'unknown', retrieved_at: null, licence: null };
  }
  const v = s.verification_status ?? '';
  const type: Provenance['source_type'] = v === 'official' ? 'official' : /open-data|licence/.test(v) ? 'open-data' : /community/.test(v) ? 'community' : 'unknown';
  return {
    source_id: id, source_name: s.institution ?? s.title ?? null, source_url: s.url ?? null, source_type: type, retrieved_at: s.retrieval_date ?? null,
    licence: /sic-/.test(id) ? 'Libre uso con atribución (datos abiertos SIC)' : /denue|iter/.test(id) ? 'Términos de libre uso de INEGI' : /open-meteo/.test(id) ? 'CC BY 4.0' : /osm|openstreetmap/.test(id) ? 'ODbL' : null,
  };
}
