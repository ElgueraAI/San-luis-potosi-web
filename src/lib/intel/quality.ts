/**
 * Data quality controls over research/entities. Pure: takes the raw records,
 * returns issues and coverage figures. scripts/intel/report.mjs writes them to
 * docs/tourism-data-quality.md; tests/intel pins each check on fixtures.
 *
 * A check reports; it never repairs. Fixing a record is a research decision
 * and belongs in the research layer.
 */
import { inSlp, validCoord, type RawEntity } from './normalize';

export type Severity = 'error' | 'warning' | 'info';
export interface Issue { check: string; severity: Severity; set: string; id: string; detail: string }

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

// "todo" and "pendiente" are ordinary Spanish words: they count only when they are the whole value
const PLACEHOLDER = /\b(lorem ipsum|placeholder|xxx+|por definir|sin nombre)\b|^\s*(tbd|todo|pendiente|n\/a)\s*$/i;
const URL_OK = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export interface QualityInput {
  /** set name → records */
  sets: Record<string, RawEntity[]>;
  /** valid INEGI municipality ids */
  municipalityIds: Set<string>;
  /** municipality id → region, to detect records filed under another region */
  municipalityRegion: Map<string, string | null>;
  /** production media ids, when known (image references are checked against it) */
  mediaIds?: Set<string>;
  /** sets where a record is expected to carry a point (missing = warning) */
  geoExpected?: string[];
  /** sets too large for the near-duplicate name scan (register dumps) */
  skipNearDuplicates?: string[];
}

export function runQuality(input: QualityInput): Issue[] {
  const out: Issue[] = [];
  const add = (check: string, severity: Severity, set: string, id: string, detail: string) => out.push({ check, severity, set, id, detail });
  const seenIds = new Map<string, string>();

  for (const [set, records] of Object.entries(input.sets)) {
    const byKey = new Map<string, RawEntity[]>();
    for (const e of records) {
      // ---- identity -------------------------------------------------------------
      if (seenIds.has(e.id)) add('duplicate-id', 'error', set, e.id, `mismo id que un registro de «${seenIds.get(e.id)}»`);
      else seenIds.set(e.id, set);
      if (!e.canonical_name?.trim()) add('missing-name', 'error', set, e.id, 'registro sin nombre');
      if (PLACEHOLDER.test(e.canonical_name ?? '') || PLACEHOLDER.test(e.short_description ?? '')) add('placeholder', 'warning', set, e.id, 'texto con marcador de relleno');

      // ---- coordinates ------------------------------------------------------------
      const hasAny = e.latitude != null || e.longitude != null;
      if (hasAny && !validCoord(e.longitude, e.latitude)) add('impossible-coordinates', 'error', set, e.id, `lat ${e.latitude}, lon ${e.longitude}`);
      else if (hasAny && !inSlp([e.longitude as number, e.latitude as number])) add('outside-slp', 'error', set, e.id, `lat ${e.latitude}, lon ${e.longitude} fuera del rectángulo del estado`);
      else if (!hasAny && input.geoExpected?.includes(set)) add('no-coordinates', 'warning', set, e.id, `sin punto (${e.coordinate_status ?? 'sin estado'})`);

      // ---- territory ---------------------------------------------------------------
      if (e.municipality_id && !input.municipalityIds.has(e.municipality_id)) add('unknown-municipality', 'error', set, e.id, `municipio ${e.municipality_id} no existe en el catálogo INEGI`);
      else if (!e.municipality_id && e.entity_type !== 'route-set') add('no-municipality', 'info', set, e.id, 'sin municipio asignado');
      const mr = e.municipality_id ? input.municipalityRegion.get(e.municipality_id) : undefined;
      if (mr && e.region && mr !== e.region) add('region-mismatch', 'warning', set, e.id, `región «${e.region}», pero su municipio es de «${mr}»`);

      // ---- provenance --------------------------------------------------------------
      if (!(e.source_ids ?? []).filter(Boolean).length && e.entity_type !== 'route-set') add('no-source', 'warning', set, e.id, 'registro sin fuente');
      if (e.official_url && !URL_OK.test(e.official_url)) add('malformed-url', 'warning', set, e.id, String(e.official_url).slice(0, 80));
      if (input.mediaIds) for (const img of e.image_ids ?? []) if (!input.mediaIds.has(img)) add('image-not-in-production', 'info', set, e.id, `${img} no está en el conjunto de imágenes publicado`);

      // ---- dates (events) ----------------------------------------------------------
      const ev = e as RawEntity & { start_date?: string | null; end_date?: string | null };
      if (ev.start_date && ev.end_date && ev.start_date > ev.end_date) add('contradictory-dates', 'error', set, e.id, `${ev.start_date} posterior a ${ev.end_date}`);
      if (ev.start_date && e.months?.length && !e.months.includes(+ev.start_date.slice(5, 7))) add('date-month-mismatch', 'warning', set, e.id, `inicio ${ev.start_date} fuera de los meses ${e.months.join(',')}`);
      if ((e.months ?? []).some((m) => m < 1 || m > 12)) add('impossible-month', 'error', set, e.id, `meses ${e.months!.join(',')}`);

      const key = `${norm(e.canonical_name ?? '')}|${e.municipality_id ?? ''}`;
      byKey.set(key, [...(byKey.get(key) ?? []), e]);
    }

    // ---- duplicates inside a set ------------------------------------------------------
    for (const group of byKey.values()) {
      if (group.length > 1) add('duplicate-name', 'warning', set, group[0].id, `${group.length} registros «${group[0].canonical_name}» en el mismo municipio: ${group.map((g) => g.id).join(', ')}`);
    }
    if (!input.skipNearDuplicates?.includes(set)) {
      const perMuni = new Map<string, RawEntity[]>();
      for (const e of records) perMuni.set(e.municipality_id ?? '', [...(perMuni.get(e.municipality_id ?? '') ?? []), e]);
      for (const group of perMuni.values()) {
        for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
          const a = norm(group[i].canonical_name ?? ''), b = norm(group[j].canonical_name ?? '');
          if (a === b || Math.min(a.length, b.length) < 8) continue;
          if (levenshtein(a, b) <= 2) add('near-duplicate-name', 'info', set, group[i].id, `«${group[i].canonical_name}» ≈ «${group[j].canonical_name}» (${group[j].id})`);
        }
      }
    }
  }
  return out;
}

export interface CoverageRow { set: string; records: number; with_point: number; official_source: number; with_image: number; with_description: number; with_municipality: number }
const OFFICIAL = new Set(['verified', 'listed', 'official-directory', 'official', 'registry']);

/** Counts and shares per set (shares are 0–1). `imageOf` lets the caller decide what "has an image" means. */
export function coverage(sets: Record<string, RawEntity[]>, imageOf: (e: RawEntity) => boolean = (e) => (e.image_ids ?? []).length > 0): CoverageRow[] {
  return Object.entries(sets).map(([set, rs]) => {
    const n = rs.length || 1;
    const share = (f: (e: RawEntity) => boolean) => Math.round((rs.filter(f).length / n) * 1000) / 1000;
    return {
      set, records: rs.length,
      with_point: share((e) => validCoord(e.longitude, e.latitude)),
      official_source: share((e) => OFFICIAL.has(e.verification_status ?? '') && (e.source_ids ?? []).length > 0),
      with_image: share(imageOf),
      with_description: share((e) => !!e.short_description),
      with_municipality: share((e) => !!e.municipality_id),
    };
  });
}

export function summarize(issues: Issue[]): Record<string, { severity: Severity; count: number }> {
  const out: Record<string, { severity: Severity; count: number }> = {};
  for (const i of issues) out[i.check] = { severity: i.severity, count: (out[i.check]?.count ?? 0) + 1 };
  return out;
}
