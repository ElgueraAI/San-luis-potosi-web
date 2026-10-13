/**
 * Route-aware candidates, the redistribution engine and trip optimisation
 * savings. Run: npm run test:intel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corridorCandidates, estimateDetourMin, measuredDetours, detourMatrixPoints, insertionIndex, thinLine, CORRIDOR_KM, MAX_DETOUR_MIN } from '../../src/lib/intel/route-aware';
import { buildContext } from '../../src/lib/intel/context';
import { rank } from '../../src/lib/intel/scoring';
import type { Coord, IntelDataset, IntelPlace, TouristProfile } from '../../src/lib/intel/types';

const place = (id: string, coord: Coord | null, o: Partial<IntelPlace> = {}): IntelPlace => ({
  id, name: `Lugar ${id}`, kind: 'destination', label: 'Destino', region: 'zona-media', municipality: 'Rioverde', municipality_id: '24024',
  coord, coord_confidence: coord ? 'verified' : 'unknown', interests: ['naturaleza'], derived_interests: [], recommended_months: null, season_source: null,
  caution_months: null, caution_note: null, outdoor: true, pueblo_magico: false, priority: 'B', description: 'x', url: null, image: null, official_url: null,
  source_ids: ['s'], source_confidence: 'verified', evidence: 'alta', route_id: id, ...o,
});
// a west → east road along latitude 22.0, from -101.0 to -99.0 (about 206 km), one vertex every 0.05°
const LINE: Coord[] = Array.from({ length: 41 }, (_, i) => [-101 + i * 0.05, 22]);
const WAYPOINTS: Coord[] = [[-101, 22], [-100, 22], [-99, 22]];
const profile: TouristProfile = { interests: ['naturaleza'], duration: 'day', mode: 'car', budget: 'medio' };

test('corridor: distance is measured to the route geometry, not to the origin', () => {
  const nearEnd = place('near-end', [-99.2, 22.03]); // 190 km from the origin, 3 km from the road
  const nearOrigin = place('off-road', [-101, 22.6]); // on the meridian of the origin, 66 km from the road
  const c = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'car', places: [nearEnd, nearOrigin] });
  assert.deepEqual(c.map((x) => x.place.id), ['near-end'], 'far from the origin but beside the road is in; near the origin but far from the road is out');
  assert.ok(Math.abs(c[0].offRouteKm - 3.3) < 0.3, String(c[0].offRouteKm));
  assert.ok(Math.abs(c[0].alongKm - 185.5) < 3, String(c[0].alongKm));
  assert.equal(c[0].beforeStop, 2, 'it lies on the last leg: before the final stop');
  assert.ok(Math.abs(c[0].exit[0] + 99.2) < 0.01 && Math.abs(c[0].exit[1] - 22) < 0.001, 'the exit point is on the road');
});

test('corridor: places without a point never enter, and saved places are excluded', () => {
  const c = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'car', places: [place('nopoint', null), place('saved', [-100.5, 22.01]), place('ok', [-100.4, 22.02])], exclude: new Set(['saved']) });
  assert.deepEqual(c.map((x) => x.place.id), ['ok']);
});

test('corridor: width and detour depend on the travel mode; sorted by detour', () => {
  const places = [place('a', [-100.5, 22.09]), place('b', [-100.3, 22.01]), place('c', [-100.1, 22.05]), place('beyond', [-100.2, 22.3])];
  const car = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'car', places });
  assert.deepEqual(car.map((x) => x.place.id), ['b', 'c', 'a']);
  assert.ok(car.every((x) => x.detour.extraMin <= MAX_DETOUR_MIN && !x.detour.measured));
  const foot = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'foot', places });
  assert.deepEqual(foot.map((x) => x.place.id), ['b'], `on foot the corridor is ${CORRIDOR_KM.foot} km`);
  assert.ok(foot[0].detour.extraMin > car.find((x) => x.place.id === 'b')!.detour.extraMin);
  assert.equal(Math.round(estimateDetourMin(10, 'car')), 37, '2 × 10 km × 1.4 ÷ 45 km/h');
  assert.equal(estimateDetourMin(0, 'car'), 0);
  assert.deepEqual(corridorCandidates({ line: [LINE[0]], waypoints: WAYPOINTS, mode: 'car', places }), [], 'no geometry, no candidates');
});

test('corridor: which stop comes next, and where the new stop is inserted', () => {
  const [first] = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'car', places: [place('early', [-100.6, 22.02])] });
  assert.equal(first.beforeStop, 1);
  assert.equal(insertionIndex(first, true), 0, 'with an origin, before the first saved stop');
  assert.equal(insertionIndex(first, false), 1, 'without an origin the first waypoint is itself a saved stop');
  const [late] = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'car', places: [place('late', [-99.4, 22.02])] });
  assert.equal(insertionIndex(late, true), 1);
});

test('corridor: one matrix measures every detour; missing roads keep the estimate', () => {
  const cands = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'car', places: [place('a', [-100.5, 22.05]), place('b', [-99.8, 22.1])] });
  const pts = detourMatrixPoints(cands);
  assert.equal(pts.length, 4, 'exits first, then places: a single request');
  // matrix rows/cols: [exitA, exitB, a, b]
  const durations: (number | null)[][] = [[0, 9, 600, 9], [9, 0, 9, null], [540, 9, 0, 9], [9, 720, 9, 0]];
  const m = measuredDetours(cands, durations);
  assert.deepEqual(m.get(cands[0].place.id), { offRouteKm: cands[0].offRouteKm, extraMin: 19, measured: true });
  assert.equal(m.has(cands[1].place.id), false, 'no road found: nothing is measured, the estimate stays');
});

test('corridor: long geometries are thinned and keep both ends', () => {
  const long: Coord[] = Array.from({ length: 5000 }, (_, i) => [-101 + i * 0.0004, 22]);
  const t = thinLine(long, 800);
  assert.ok(t.length <= 801);
  assert.deepEqual(t[0], long[0]);
  assert.deepEqual(t[t.length - 1], long[long.length - 1]);
});

test('integration: route → nearby places, ranked with the profile and explained', () => {
  const places = [
    place('match-near', [-100.5, 22.03]),
    place('match-far', [-100.2, 22.1]),
    place('other-interest', [-100.4, 22.01], { interests: ['arte'] }),
    place('other-region', [-99.3, 22.04], { region: 'huasteca', municipality: 'Ciudad Valles', municipality_id: '24013' }),
  ];
  const dataset: IntelDataset = { generated: 't', places: [...places, place('stop', [-100, 22])], municipalities: [], events: [], climate: {}, sources: {} };
  const cands = corridorCandidates({ line: LINE, waypoints: WAYPOINTS, mode: 'car', places, exclude: new Set(['stop']) });
  const ctx = buildContext({ dataset, profile, routeIds: ['stop'], detours: new Map(cands.map((c) => [c.place.id, c.detour])) });
  const recs = rank(cands.map((c) => c.place), ctx, { limit: 5 });
  assert.deepEqual(recs.map((r) => r.place.id).sort(), ['match-far', 'match-near', 'other-region'], 'only places that match the interests');
  const near = recs.find((r) => r.place.id === 'match-near')!, far = recs.find((r) => r.place.id === 'match-far')!;
  assert.ok(near.score > far.score, 'a smaller detour ranks higher');
  assert.ok(near.reasons.some((x) => /Cerca de tu recorrido: ≈ \+\d+ min estimados por distancia a la ruta/.test(x)));
  assert.ok(far.warnings.some((x) => /desvío considerable/.test(x)));
  assert.ok(recs.find((r) => r.place.id === 'other-region')!.reasons.some((x) => /Añade una región distinta a tu viaje: Huasteca/.test(x)));
  assert.ok(recs.every((r) => r.distanceKm === null), 'no straight-line distance from the origin is used once there is a route');
});

test('integration: routing provider down → no corridor and no fabricated number', () => {
  // the session has no geometry when the provider fails: callers pass nothing, and nothing is produced
  assert.deepEqual(corridorCandidates({ line: [], waypoints: WAYPOINTS, mode: 'car', places: [place('x', [-100.5, 22.03])] }), []);
  const dataset: IntelDataset = { generated: 't', places: [place('x', [-100.5, 22.03])], municipalities: [], events: [], climate: {}, sources: {} };
  const [r] = rank(dataset.places, buildContext({ dataset, profile, detours: null, origin: null }));
  assert.equal(r.detour, null);
  assert.ok(!r.reasons.concat(r.warnings).some((t) => /min|km/.test(t)), 'without a route or an origin there is no distance or time on the card');
});
