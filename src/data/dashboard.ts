/**
 * Build-time data of the tourism intelligence chapters
 * (src/pages/inteligencia-turistica). Everything here is read from the
 * intelligence dataset (src/data/intel.ts): no formula, weight or threshold is
 * defined in this file. Observed counts, derived indices and the simulated
 * scenario are exported separately and are never combined in one figure.
 */
import { intelPlaces, intelMunicipalities, intelEvents, intelClimate, intelDataset } from './intel';
import { museums, venues, lodging, eventsAll } from './portal';
import { concentration, topShare } from '@/lib/intel/features';
import { alternativesFor, DOS_LABEL, MIN_SIMILARITY, MIN_EXPOSURE_GAP, MIN_INFRASTRUCTURE, ALT_REACH_KM } from '@/lib/intel/diversify';
import { runScenario, SCENARIO_LABEL, SCENARIO_MONTHS, SCENARIO_ORIGINS } from '@/lib/intel/scenario';
import { LOW_EXPOSURE } from '@/lib/intel/scoring';
import { KIND_LABEL, REGION_LABEL, MONTHS_ES, INTEREST_LABEL, INTERESTS } from '@/lib/intel/taxonomy';
import type { IntelKind, MuniFeatures, RegionId } from '@/lib/intel/types';
import { muniHref } from '@/i18n/routes';

export { REGION_LABEL, MONTHS_ES, SCENARIO_LABEL, SCENARIO_MONTHS, SCENARIO_ORIGINS, LOW_EXPOSURE };
export const REGIONS = Object.keys(REGION_LABEL) as RegionId[];
export const fmt = (v: number) => v.toLocaleString('es-MX');
export const pct = (v: number) => `${Math.round(v * 100)} %`;

const munis = intelMunicipalities;
const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

// ------------------------------------------------------------------ observed --
const withAssets = munis.filter((m) => m.assets > 0);
const dated = intelEvents.filter((e) => e.date_confidence !== 'unknown' && e.months.length > 0);

export const observed = {
  municipalities: munis.length,
  places: intelPlaces.length,
  withAssets: withAssets.length,
  withoutAssets: munis.length - withAssets.length,
  /** municipalities with no scorable asset in the base that do record events */
  eventOnly: munis.filter((m) => m.assets === 0 && m.counts.events > 0).length,
  destinations: intelPlaces.filter((p) => p.kind === 'destination').length,
  museums: museums.length,
  venues: venues.length,
  lodging: lodging.length,
  events: eventsAll.length,
  eventsDated: dated.length,
  byRegion: REGIONS.map((r) => ({
    region: r,
    places: intelPlaces.filter((p) => p.region === r).length,
    destinations: intelPlaces.filter((p) => p.region === r && p.kind === 'destination').length,
    municipalities: munis.filter((m) => m.region === r).length,
    lodging: sum(munis.filter((m) => m.region === r).map((m) => m.counts.lodging)),
  })),
};

/** Chart 1: recommendable places by type (rows) and region (columns). */
const kinds = (Object.keys(KIND_LABEL) as IntelKind[]).filter((k) => intelPlaces.some((p) => p.kind === k));
export const kindMatrix = kinds
  .map((k) => ({ kind: k, label: KIND_LABEL[k], by: REGIONS.map((r) => intelPlaces.filter((p) => p.kind === k && p.region === r).length), total: intelPlaces.filter((p) => p.kind === k).length }))
  .sort((a, b) => b.total - a.total);
export const kindMatrixMax = Math.max(...kindMatrix.flatMap((r) => r.by));

/** Chart 2: documentary coverage. Which record types the base holds per municipality. */
export const COVERAGE_TYPES = ['Destinos', 'Museos y recintos', 'Fiestas', 'Hospedaje', 'Alimentos', 'Naturaleza o arqueología'] as const;
const presence = (m: MuniFeatures) => [m.counts.destinations > 0, m.counts.museums + m.counts.venues > 0, m.counts.events > 0, m.counts.lodging > 0, m.counts.food > 0, m.counts.protected_areas + m.counts.archaeology > 0];
export const coverageRows = [...munis]
  .sort((a, b) => b.coverage_index - a.coverage_index || b.assets - a.assets || a.name.localeCompare(b.name, 'es'))
  .slice(0, 14)
  .map((m) => ({ name: m.name, href: m.slug ? muniHref(m.slug) : null, region: m.region, assets: m.assets, coverage: m.coverage_index, present: presence(m) }));
export const coverageSpread = [6, 5, 4, 3, 2, 1, 0].map((k) => ({ types: k, municipalities: munis.filter((m) => presence(m).filter(Boolean).length === k).length }));

/** Chart 3: registered lodging by municipality, grouped by region (treemap input). */
export const lodgingByRegion = REGIONS.map((r) => {
  const rows = munis.filter((m) => m.region === r && m.counts.lodging > 0).map((m) => ({ name: m.name, value: m.counts.lodging })).sort((a, b) => b.value - a.value);
  return { region: r, total: sum(rows.map((x) => x.value)), rows };
});
export const lodgingTotal = sum(lodgingByRegion.map((r) => r.total));
export const lodgingUnassigned = lodging.length - lodgingTotal;

/** Chart 4: what kinds of experience the base holds (interest tags of recommendable places). */
export const interestCounts = INTERESTS
  .map((i) => ({ id: i, label: INTEREST_LABEL[i], declared: intelPlaces.filter((p) => p.interests.includes(i) && !p.derived_interests.includes(i)).length, derived: intelPlaces.filter((p) => p.derived_interests.includes(i)).length }))
  .map((x) => ({ ...x, total: x.declared + x.derived }))
  .sort((a, b) => b.total - a.total);

// ------------------------------------------------------------------- derived --
const lodgingVals = munis.map((m) => m.counts.lodging), assetVals = munis.map((m) => m.assets);
export const derived = {
  top5Assets: topShare(assetVals, 5),
  top5Lodging: topShare(lodgingVals, 5),
  hhiLodging: concentration(lodgingVals),
  lowExposureWithAssets: withAssets.filter((m) => m.exposure_proxy < LOW_EXPOSURE).length,
};
export const potentialRanking = [...munis].filter((m) => m.assets > 0).sort((a, b) => b.diversification_potential - a.diversification_potential).slice(0, 10)
  .map((m) => ({ name: m.name, href: m.slug ? muniHref(m.slug) : null, region: m.region, potential: m.diversification_potential, exposure: m.exposure_proxy, infrastructure: m.infrastructure_index, assets: m.assets, events: m.counts.events }));
export const scatter = munis.filter((m) => m.assets + m.counts.events > 0)
  .map((m) => ({ name: m.name, region: m.region, exposure: m.exposure_proxy, infrastructure: m.infrastructure_index, potential: m.diversification_potential, assets: m.assets }));

/** Real output of the redistribution engine for three flagship anchors, for the month of the build. */
export const CASE_MONTH = new Date().getMonth() + 1;
const muniMap = new Map(munis.map((m) => [m.id, m]));
export const cases = ['A01', 'H01', 'C01'].flatMap((id) => {
  const anchor = intelPlaces.find((p) => p.id === id);
  const am = anchor?.municipality_id ? muniMap.get(anchor.municipality_id) : undefined;
  if (!anchor || !am) return [];
  const alts = alternativesFor(anchor, intelPlaces, { month: CASE_MONTH, mode: 'car', municipalities: muniMap }).slice(0, 3);
  return [{
    id, name: anchor.name, url: anchor.url, municipality: am.name, region: anchor.region, exposure: am.exposure_proxy,
    alternatives: alts.map((a) => ({
      name: a.place.name, url: a.place.url, municipality: a.place.municipality, region: a.place.region, score: a.score, km: Math.round(a.km),
      exposure: a.exposure.candidate, shared: a.shared.map((i) => INTEREST_LABEL[i]),
      components: a.components.map((c) => ({ label: DOS_LABEL[c.id], weight: c.weight, value: c.value })),
    })),
  }];
});
export const gates = [
  { label: 'Se parece al lugar que ya te interesa', rule: `similitud de intereses y región ≥ ${MIN_SIMILARITY.toLocaleString('es-MX')}` },
  { label: 'Está en un municipio menos expuesto', rule: `brecha de exposición estimada ≥ ${MIN_EXPOSURE_GAP.toLocaleString('es-MX')} (proxy)` },
  { label: 'Hay dónde comer o dormir', rule: `índice de infraestructura ≥ ${MIN_INFRASTRUCTURE.toLocaleString('es-MX')}` },
  { label: 'La información es confiable', rule: 'nivel de evidencia medio o alto' },
  { label: 'Queda razonablemente cerca', rule: `hasta ${ALT_REACH_KM.car} km en línea recta, o 45 min de desvío medido` },
];

// ------------------------------------------------------------------ calendar --
/**
 * Counting rule: an event counts once in every month it spans. Events that
 * run all year (12 months) and events with no known month are kept apart and
 * never enter the monthly grid.
 */
const allYear = intelEvents.filter((e) => e.months.length === 12);
const noMonth = intelEvents.filter((e) => e.months.length === 0 || e.date_confidence === 'unknown');
const monthly = dated.filter((e) => e.months.length < 12);
export const calendar = {
  grid: REGIONS.map((r) => ({ region: r, months: MONTHS_ES.map((_, i) => monthly.filter((e) => e.region === r && e.months.includes(i + 1)).length) })),
  totals: MONTHS_ES.map((_, i) => monthly.filter((e) => e.months.includes(i + 1)).length),
  monthlyEvents: monthly.length,
  allYear: allYear.map((e) => ({ name: e.name, url: e.url, municipality: e.municipality })),
  noMonth: noMonth.map((e) => ({ name: e.name, url: e.url, municipality: e.municipality })),
  rain: REGIONS.map((r) => ({ region: r, days: intelClimate[r].map((m) => Math.round(m.rain_days)), tmax: intelClimate[r].map((m) => Math.round(m.tmax)) })),
  /** Client payload: only what the interactive panel needs. */
  client: {
    events: monthly.map((e) => ({ n: e.name, u: e.url, r: e.region, m: e.months, mu: e.municipality, c: e.date_confidence })),
    seasons: intelPlaces.filter((p) => p.recommended_months?.length).map((p) => ({ n: p.name, u: p.url, r: p.region, m: p.recommended_months! })),
    rain: Object.fromEntries(REGIONS.map((r) => [r, intelClimate[r].map((m) => Math.round(m.rain_days))])),
  },
};
export const calendarMax = Math.max(...calendar.grid.flatMap((g) => g.months));
export const busiestMonths = calendar.totals.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, 3);

// ----------------------------------------------------------------------- map --
export const mapMunicipalities = munis.filter((m) => m.coord).map((m) => {
  const places = intelPlaces.filter((p) => p.municipality_id === m.id);
  return {
    id: m.id, n: m.name, u: m.slug ? muniHref(m.slug) : null, r: m.region, c: m.coord!,
    assets: m.assets, lodging: m.counts.lodging, food: m.counts.food, events: m.counts.events,
    infra: m.infrastructure_index, exposure: m.exposure_proxy, potential: m.diversification_potential, coverage: m.coverage_index,
    ev: { alta: places.filter((p) => p.evidence === 'alta').length, media: places.filter((p) => p.evidence === 'media').length, baja: places.filter((p) => p.evidence === 'baja').length },
    top: places.filter((p) => p.url).sort((a, b) => (a.priority ?? 'Z').localeCompare(b.priority ?? 'Z')).slice(0, 4).map((p) => ({ n: p.name, u: p.url! })),
  };
});
export const mapMissingSeat = munis.length - mapMunicipalities.length;

// ----------------------------------------------------------------- simulated --
export const scenario = runScenario(await intelDataset());
