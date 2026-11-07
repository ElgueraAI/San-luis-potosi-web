/**
 * Feature engineering per municipality. Observed counts come straight from
 * research/entities; the four indices are DERIVED by this project and are
 * documented with formula, range and limits in
 * docs/tourism-redistribution-methodology.md.
 *
 * None of them measures visitors, occupancy or crowding: there is no source
 * for that. `exposure_proxy` is a supply-side and editorial proxy and is
 * always named as a proxy in the UI.
 */
import type { Coord, IntelPlace, MuniFeatures, RegionId } from './types';
import { asRegion } from './normalize';
import { validMunicipalityKey } from '../municipality';

export interface RawMunicipality {
  /** INEGI key; null for a municipality the 2020 census does not list yet (Villa de Pozos, created in 2024). */
  id: string | null; canonical_name: string; slug?: string; region?: string | null; population_2020?: number | null;
  seat?: { latitude: number; longitude: number } | null;
  counts?: Partial<Record<'destinations' | 'museums' | 'venues' | 'archaeology' | 'events' | 'lodging' | 'food' | 'protected_areas', number | null>>;
}

export const EXPOSURE_WEIGHTS = { lodging: 0.5, flagship: 0.3, puebloMagico: 0.2 } as const;
export const POTENTIAL_WEIGHTS = { assets: 0.6, infrastructure: 0.4 } as const;
const ASSET_KINDS = new Set(['destination', 'museum', 'archaeology', 'protected-area']);
const COUNT_KEYS = ['destinations', 'museums', 'venues', 'archaeology', 'events', 'lodging', 'food', 'protected_areas'] as const;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

export function municipalityFeatures(munis: RawMunicipality[], places: IntelPlace[]): MuniFeatures[] {
  // Unknown territorial keys/counts do not become zero-valued analytical rows.
  munis = munis.filter((m) => validMunicipalityKey(m.id) && COUNT_KEYS.every((k) => {
    const value = m.counts?.[k];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }));
  const byMuni = new Map<string, IntelPlace[]>();
  const key = (m: RawMunicipality) => m.id as string;
  const known = new Set(munis.map(key));
  for (const p of places) {
    const k = p.municipality_id;
    if (validMunicipalityKey(k) && known.has(k)) byMuni.set(k, [...(byMuni.get(k) ?? []), p]);
  }
  const c = (m: RawMunicipality, k: keyof NonNullable<RawMunicipality['counts']>) => m.counts![k] as number;
  const maxLodging = Math.max(1, ...munis.map((m) => c(m, 'lodging')));
  const maxInfra = Math.max(1, ...munis.map((m) => c(m, 'lodging') + c(m, 'food')));
  const assetsOf = (m: RawMunicipality) => (byMuni.get(key(m)) ?? []).filter((p) => ASSET_KINDS.has(p.kind)).length;
  const totalAssets = Math.max(1, munis.reduce((s, m) => s + assetsOf(m), 0));

  return munis.map((m) => {
    const ps = byMuni.get(key(m)) ?? [];
    const flagship = ps.filter((p) => p.priority === 'A').length;
    const pm = ps.filter((p) => p.pueblo_magico).length;
    const assets = assetsOf(m);
    const infrastructure = Math.log1p(c(m, 'lodging') + c(m, 'food')) / Math.log1p(maxInfra);
    const exposure = EXPOSURE_WEIGHTS.lodging * (Math.log1p(c(m, 'lodging')) / Math.log1p(maxLodging))
      + EXPOSURE_WEIGHTS.flagship * clamp01(flagship / 3)
      + EXPOSURE_WEIGHTS.puebloMagico * (pm > 0 ? 1 : 0);
    const attraction = clamp01(Math.log1p(assets + c(m, 'events') / 2) / Math.log1p(8));
    const potential = assets + c(m, 'events') === 0 ? 0 : (1 - exposure) * (POTENTIAL_WEIGHTS.assets * attraction + POTENTIAL_WEIGHTS.infrastructure * infrastructure);
    const present = [c(m, 'destinations') > 0, c(m, 'museums') + c(m, 'venues') > 0, c(m, 'events') > 0, c(m, 'lodging') > 0, c(m, 'food') > 0, c(m, 'protected_areas') + c(m, 'archaeology') > 0];
    const coord: Coord | null = m.seat ? [m.seat.longitude, m.seat.latitude] : null;
    return {
      id: key(m), name: m.canonical_name, slug: m.slug ?? null, region: asRegion(m.region) as RegionId | null, coord, population: m.population_2020 ?? null,
      counts: {
        destinations: c(m, 'destinations'), museums: c(m, 'museums'), venues: c(m, 'venues'), archaeology: c(m, 'archaeology'), events: c(m, 'events'),
        lodging: c(m, 'lodging'), food: c(m, 'food'), protected_areas: c(m, 'protected_areas'), flagship, pueblo_magico: pm,
      },
      assets,
      asset_share: round(assets / totalAssets),
      infrastructure_index: round(clamp01(infrastructure)),
      exposure_proxy: round(clamp01(exposure)),
      diversification_potential: round(clamp01(potential)),
      coverage_index: round(present.filter(Boolean).length / present.length),
    };
  });
}

/** Herfindahl–Hirschman concentration of a set of shares (0–1; 1 = everything in one place). */
export function concentration(values: number[]): number {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  return round(values.reduce((s, v) => s + (v / total) ** 2, 0));
}

/** Share of the total held by the top n values (0–1). */
export function topShare(values: number[], n: number): number {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  return round([...values].sort((a, b) => b - a).slice(0, n).reduce((s, v) => s + v, 0) / total);
}
