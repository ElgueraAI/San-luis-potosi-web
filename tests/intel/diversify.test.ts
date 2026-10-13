/**
 * Redistribution engine (Diversification Opportunity Score) and the trip
 * optimisation comparison. Run: npm run test:intel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternativesFor, diversifyTrip, similarity, DOS_WEIGHTS, MIN_SIMILARITY, ALT_REACH_KM, type DiversifyOptions } from '../../src/lib/intel/diversify';
import { savings, savingsSentence } from '../../src/lib/intel/trip';
import { optimizeOrder, pathCost, type CostMatrix } from '../../src/scripts/geo/route-optimizer';
import { buildDataset } from '../../src/lib/intel/dataset';
import type { Coord, IntelPlace, MuniFeatures } from '../../src/lib/intel/types';
import type { RawEntity } from '../../src/lib/intel/normalize';
import attractions from '../../research/entities/attractions/index.json';
import archaeology from '../../research/entities/archaeology/index.json';
import museums from '../../research/entities/museums/index.json';
import venues from '../../research/entities/cultural-venues/index.json';
import recreation from '../../research/entities/recreation/index.json';
import events from '../../research/entities/events/index.json';
import municipalities from '../../research/entities/municipalities/index.json';
import seasonal from '../../research/generated/seasonal-calendar.json';
import destIndex from '../../research/destinations/index.json';

const place = (id: string, muni: string, coord: Coord | null, o: Partial<IntelPlace> = {}): IntelPlace => ({
  id, name: `Lugar ${id}`, kind: 'destination', label: 'Pueblo', region: 'altiplano', municipality: `Municipio ${muni}`, municipality_id: muni,
  coord, coord_confidence: coord ? 'verified' : 'unknown', interests: ['historia', 'pueblos-magicos', 'fotografia'], derived_interests: [], recommended_months: null,
  season_source: null, caution_months: null, caution_note: null, outdoor: null, pueblo_magico: false, priority: 'B', description: 'x', url: null, image: null,
  official_url: null, source_ids: ['s'], source_confidence: 'verified', evidence: 'alta', route_id: id, ...o,
});
const muni = (id: string, exposure: number, o: Partial<MuniFeatures> = {}): MuniFeatures => ({
  id, name: `Municipio ${id}`, slug: id, region: 'altiplano', coord: null, population: 10000,
  counts: { destinations: 2, museums: 0, venues: 1, archaeology: 0, events: 2, lodging: 8, food: 15, protected_areas: 0, flagship: 0, pueblo_magico: 0 },
  assets: 2, asset_share: 0.02, infrastructure_index: 0.45, exposure_proxy: exposure, diversification_potential: 0.4, coverage_index: 0.67, ...o,
});
const munis = new Map([['famous', muni('famous', 0.8)], ['quiet', muni('quiet', 0.2)], ['hub', muni('hub', 0.85)], ['bare', muni('bare', 0.1, { infrastructure_index: 0.02 })]]);
const opt = (o: Partial<DiversifyOptions> = {}): DiversifyOptions => ({ month: 6, mode: 'car', municipalities: munis, ...o });
const anchor = place('anchor', 'famous', [-100.88, 23.69]);

test('DOS weights add up to 1', () => {
  assert.ok(Math.abs(Object.values(DOS_WEIGHTS).reduce((s, w) => s + w, 0) - 1) < 1e-9);
});

test('similarity is the Jaccard index of interests plus region; a region alone is not similarity', () => {
  const s = similarity(anchor, place('b', 'quiet', [-100.6, 23.6], { interests: ['historia', 'fotografia', 'naturaleza'] }));
  assert.equal(s.value, 0.6, '(2 interests + region) ÷ (4 interests + region)');
  assert.deepEqual(s.shared, ['historia', 'fotografia']);
  assert.equal(s.sameRegion, true);
  const elsewhere = similarity(anchor, place('d', 'quiet', [-100.6, 23.6], { interests: ['historia', 'fotografia', 'naturaleza'], region: 'huasteca' }));
  assert.equal(elsewhere.value, 2 / 6, 'another region: same interests, lower similarity');
  assert.equal(similarity(anchor, place('c', 'quiet', null, { interests: ['agua'] })).value, 0, 'same region, no shared interest');
});

test('redistribution: a similar place in a less exposed municipality, with its cost and its proxy stated', () => {
  const good = place('good', 'quiet', [-100.6, 23.6]);
  const [alt] = alternativesFor(anchor, [good], opt());
  assert.equal(alt.place.id, 'good');
  assert.ok(alt.score > 60 && alt.score <= 100);
  assert.match(alt.sentence, /^Te interesa Lugar anchor\. También puedes explorar Lugar good, en Municipio quiet.*comparte Historia, Pueblos Mágicos, Fotografía y la región Altiplano; queda a \d+ km en línea recta de Lugar anchor\.$/);
  assert.ok(alt.reasons.some((r) => /menor exposición turística estimada.*proxy 0\.20 frente a 0\.80; no mide afluencia/.test(r)));
  assert.ok(alt.reasons.some((r) => /no confirma disponibilidad/.test(r)));
  assert.ok(!JSON.stringify(alt).match(/saturad|lleno|abarrotad|ocupaci[oó]n/i), 'never a crowding claim');
});

test('redistribution gates: relevance first', () => {
  const ids = (list: IntelPlace[], o: Partial<DiversifyOptions> = {}) => alternativesFor(anchor, list, opt(o)).map((a) => a.place.id);
  assert.deepEqual(ids([place('same-muni', 'famous', [-100.87, 23.7])]), [], 'same municipality is not a redistribution');
  assert.deepEqual(ids([place('unlike', 'quiet', [-100.6, 23.6], { interests: ['agua', 'aventura'] })]), [], `similarity under ${MIN_SIMILARITY}: unknown is not a reason to recommend`);
  assert.deepEqual(ids([place('more-exposed', 'hub', [-100.6, 23.6])]), [], 'a more exposed municipality is not an alternative');
  assert.deepEqual(ids([place('no-point', 'quiet', null)]), [], 'no point: no geospatial comparison');
  assert.deepEqual(ids([place('weak', 'quiet', [-100.6, 23.6], { evidence: 'baja' })]), [], 'reliable information only');
  assert.deepEqual(ids([place('no-services', 'bare', [-100.6, 23.6])]), [], 'no registered food or lodging nearby: not suggested');
  assert.deepEqual(ids([place('too-far', 'quiet', [-99.0, 21.9])]), [], `beyond ${ALT_REACH_KM.car} km`);
  assert.deepEqual(ids([place('saved', 'quiet', [-100.6, 23.6])], { exclude: new Set(['saved']) }), []);
  assert.deepEqual(ids([place('off-profile', 'quiet', [-100.6, 23.6])], { interests: ['agua'] }), [], 'must share an interest with the visitor');
  assert.deepEqual(alternativesFor(place('lost', 'famous', null), [place('good', 'quiet', [-100.6, 23.6])], opt()), [], 'an anchor without a point has no alternatives');
});

test('redistribution: closer, more similar and less exposed rank higher; a route detour replaces distance', () => {
  const near = place('near', 'quiet', [-100.8, 23.65]);
  const far = place('far', 'quiet', [-100.2, 23.2]);
  const order = alternativesFor(anchor, [far, near], opt()).map((a) => a.place.id);
  assert.deepEqual(order, ['near', 'far']);
  const withRoute = alternativesFor(anchor, [near, far], opt({ detourOf: (p) => (p.id === 'far' ? { offRouteKm: 1, extraMin: 4, measured: false } : { offRouteKm: 20, extraMin: 44, measured: false }) }));
  assert.deepEqual(withRoute.map((a) => a.place.id), ['far', 'near'], 'on a route, the detour decides the cost');
  assert.match(withRoute[0].sentence, /añade ≈ 4 min estimados a tu recorrido/);
  assert.deepEqual(alternativesFor(anchor, [near], opt({ detourOf: () => ({ offRouteKm: 40, extraMin: 90, measured: false }) })), [], 'a long detour is not offered');
  const newRegion = alternativesFor(anchor, [place('other', 'quiet', [-100.8, 23.65], { region: 'centro' })], opt())[0];
  assert.ok(newRegion.reasons.some((r) => /Suma una región distinta a tu viaje: Centro/.test(r)));
});

test('diversifyTrip: one alternative per anchor, no place or municipality twice', () => {
  const a2 = place('anchor2', 'hub', [-100.9, 23.7]);
  const cands = [place('q1', 'quiet', [-100.8, 23.65]), place('q2', 'quiet', [-100.75, 23.6])];
  const out = diversifyTrip([anchor, a2], cands, opt());
  assert.equal(out.length, 1, 'both candidates are in the same municipality: one suggestion');
  assert.equal(new Set(out.map((a) => a.place.id)).size, out.length);
});

// --------------------------------------------------------- real research layer --
const built = buildDataset({
  attractions: attractions.records as unknown as RawEntity[], archaeology: archaeology.records as unknown as RawEntity[], museums: museums.records as unknown as RawEntity[],
  venues: venues.records as unknown as RawEntity[], recreation: recreation.records as unknown as RawEntity[], events: events.records as unknown as RawEntity[],
  municipalities: municipalities.records as never, seasonRecords: seasonal.records as never, priorities: destIndex.destinations,
});
const realMunis = new Map(built.municipalities.map((m) => [m.id, m]));

test('real data: Real de Catorce and Tamul get relevant, less exposed alternatives nearby', () => {
  for (const id of ['A01', 'H01']) {
    const a = built.places.find((p) => p.id === id)!;
    const alts = alternativesFor(a, built.places, { month: 1, mode: 'car', municipalities: realMunis });
    assert.ok(alts.length > 0, `${a.name} has alternatives`);
    for (const alt of alts) {
      assert.notEqual(alt.place.municipality_id, a.municipality_id);
      assert.ok(alt.exposure.candidate < alt.exposure.anchor);
      assert.ok(alt.shared.length > 0);
      assert.ok(alt.km <= ALT_REACH_KM.car);
    }
  }
});

test('real data: a place in a little exposed municipality is not pushed anywhere', () => {
  const quiet = built.places.find((p) => p.id === 'A08')!; // Guadalcázar
  const alts = alternativesFor(quiet, built.places, { month: 1, mode: 'car', municipalities: realMunis });
  assert.ok(alts.every((a) => a.exposure.candidate < a.exposure.anchor), 'alternatives only ever point to lower exposure');
});

// ------------------------------------------------------------ trip optimisation --
test('optimizer: the comparison reports only what the matrix says', () => {
  const s = savings({ distance: 300_000, duration: 5 * 3600 }, { distance: 250_000, duration: 4 * 3600 });
  assert.deepEqual([s.distance, s.duration, s.worthwhile], [50_000, 3600, true]);
  assert.equal(Math.round(s.share * 100), 20);
  assert.equal(savingsSentence(s), 'Con el orden optimizado: ≈ 1 h menos de traslado (20 %) y ≈ 50 km menos.');
  const longer = savings({ distance: 100_000, duration: 7200 }, { distance: 104_000, duration: 6600 });
  assert.match(savingsSentence(longer), /≈ 10 min menos de traslado \(8 %\), aunque recorres ≈ 4 km más/);
  assert.equal(savingsSentence(savings({ distance: 100_000, duration: 7200 }, { distance: 100_000, duration: 7190 })), 'El orden optimizado no mejora tu recorrido de forma apreciable.');
  assert.equal(savings({ distance: 0, duration: 0 }, { distance: 0, duration: 0 }).worthwhile, false);
});

test('optimizer: every stop is kept and the order is never worse than the original', () => {
  // five stops on a line visited in a zig-zag order: the optimum is the straight sweep
  const xs = [0, 40, 10, 30, 20];
  const m: CostMatrix = xs.map((a) => xs.map((b) => Math.abs(a - b) * 60));
  const res = optimizeOrder(m, true);
  assert.deepEqual([...res.order].sort(), [0, 1, 2, 3, 4], 'no stop removed, none repeated');
  assert.equal(res.order[0], 0, 'the origin stays first');
  assert.ok(res.cost < res.originalCost);
  assert.equal(res.cost, pathCost(m, [0, 2, 4, 3, 1]));
  const sv = savings({ distance: 0, duration: res.originalCost }, { distance: 0, duration: res.cost });
  assert.ok(sv.worthwhile && sv.duration === res.originalCost - res.cost);
  const unreachable: CostMatrix = [[0, null, 5], [null, 0, null], [5, null, 0]];
  assert.ok(!Number.isFinite(optimizeOrder(unreachable, true).cost), 'an unreachable stop is reported, not papered over');
});
