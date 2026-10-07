/**
 * Live navigation: route geometry + navigation engine + visited-stops store.
 * Deterministic: time, connectivity and side effects are injected (no network,
 * no browser). Run: npm run test:geo
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLine, snapToLine, legBoundaries, legAt, splitAt, progress, remaining, distanceFromRoute } from '../../src/scripts/geo/route-geometry';
import {
  NavigationEngine, MAX_AUTO_REROUTES, REROUTE_COOLDOWN_MS, OFF_ROUTE_MIN_M, ARRIVAL_RADIUS_M, type NavState,
} from '../../src/scripts/geo/navigation';
import { sanitize } from '../../src/scripts/geo/trip-store';
import { isOutlier, MAX_REJECTS } from '../../src/scripts/geo/location-service';
import { RouteError, type Coordinate, type GeoFix, type RouteResult } from '../../src/scripts/geo/types';

// ---- fixture: a 10.3 km road running east along 22° N, stops A (middle) and B (end) ----
const LAT = 22.0;
const LINE: Coordinate[] = Array.from({ length: 101 }, (_, i) => [-100 + i * 0.001, LAT]);
const A: Coordinate = [-99.95, LAT];
const B: Coordinate = [-99.9, LAT];
const NORTH_222M = 0.002; // ≈ 222 m off the road

let stamp = 0;
function routeFrom(start: Coordinate, geometry: Coordinate[], stops: { id: string; coord: Coordinate }[] = [{ id: 'A', coord: A }, { id: 'B', coord: B }]): RouteResult {
  const waypoints = [{ id: 'origin:gps', name: 'Tu ubicación', coord: start, role: 'origin' as const, approximate: false },
    ...stops.map((s, i) => ({ id: s.id, name: `Lugar ${s.id}`, coord: s.coord, role: (i === stops.length - 1 ? 'destination' : 'stop') as 'stop' | 'destination', approximate: false }))];
  const line = buildLine(geometry);
  return {
    provider: 'mock', profile: 'car', waypoints, geometry: { type: 'LineString', coordinates: geometry },
    distance: line.total, duration: stops.length * 600,
    legs: stops.map((s, i) => ({ from: waypoints[i].id, to: s.id, distance: line.total / stops.length, duration: 600 })),
    alternatives: [], attribution: 'mock', quota: null, computedAt: ++stamp,
  };
}

function harness(total = 2) {
  const h = { t: 1_000_000, online: true, reroutes: 0, visited: [] as string[], skipped: [] as string[] };
  const eng = new NavigationEngine({
    now: () => h.t, isOnline: () => h.online, reroute: () => { h.reroutes += 1; },
    markVisited: (id) => h.visited.push(id), skip: (id) => h.skipped.push(id),
  });
  eng.setTrip(total, []);
  const fix = (lon: number, lat = LAT, accuracy = 10, dt = 1000): NavState => {
    h.t += dt;
    const f: GeoFix = { coord: [lon, lat], accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null, timestamp: h.t };
    eng.update(f);
    return eng.get();
  };
  const start = () => { eng.start(); fix(-100); eng.setRoute(routeFrom([-100, LAT], LINE)); return eng.get(); };
  return { h, eng, fix, start };
}
const offRoute = (f: (lon: number, lat?: number, acc?: number, dt?: number) => NavState, lon = -99.99, n = 3, dt = 1000) => {
  let s!: NavState;
  for (let i = 0; i < n; i++) s = f(lon, LAT + NORTH_222M, 10, dt);
  return s;
};

// ------------------------------------------------------------------ geometry --
test('geometry: projection, distance from route, along, total, remaining, progress', () => {
  const line = buildLine(LINE);
  assert.ok(Math.abs(line.total - 10322) < 30, `total ${line.total}`);
  const s = snapToLine(line, [-99.975, LAT + NORTH_222M])!;
  assert.ok(Math.abs(s.distance - 222) < 3, `distance ${s.distance}`);
  assert.ok(Math.abs(s.along - line.total / 4) < 15, `along ${s.along}`);
  assert.ok(Math.abs(s.point[0] + 99.975) < 1e-9 && s.point[1] === LAT, 'closest point lies on the road');
  assert.ok(Math.abs(remaining(line, s.along) - (line.total * 3) / 4) < 15);
  assert.ok(Math.abs(progress(line, s.along) - 0.25) < 0.002);
  assert.ok(Math.abs(distanceFromRoute(line, [-99.95, LAT]) ) < 0.5);
});

test('geometry: bounded search near the previous snap equals the full search', () => {
  const line = buildLine(LINE);
  let hint = snapToLine(line, [-100, LAT])!;
  for (let lon = -100; lon <= -99.9; lon += 0.0037) {
    const p: Coordinate = [lon, LAT + 0.0002];
    const bounded = snapToLine(line, p, hint)!;
    const full = snapToLine(line, p)!;
    assert.ok(Math.abs(bounded.along - full.along) < 0.01 && Math.abs(bounded.distance - full.distance) < 0.01);
    hint = bounded;
  }
  // a jump far beyond the window falls back to a full search
  const far = snapToLine(line, [-99.905, LAT], snapToLine(line, [-100, LAT]))!;
  assert.ok(far.along > 9000);
});

test('geometry: leg boundaries pick the first pass on a route that loops back', () => {
  // out to the east, back west past the start, stop S sits on the road the route passes twice
  const out: Coordinate[] = Array.from({ length: 11 }, (_, i) => [-100 + i * 0.001, LAT]);
  const back: Coordinate[] = Array.from({ length: 11 }, (_, i) => [-99.99 - i * 0.001, LAT + 0.00002]);
  const line = buildLine([...out, ...back]);
  const b = legBoundaries(line, [[-100, LAT], [-99.995, LAT], [-100.0, LAT + 0.00002]]);
  assert.ok(b[1] < 700, `first pass (≈515 m), got ${b[1]}`);
  assert.equal(b[2], line.total);
  assert.equal(legAt(b, 100), 0);
  assert.equal(legAt(b, b[1] + 10), 1);
  const { done, rest } = splitAt(line, 1000);
  assert.ok(Math.abs(buildLine(done).total - 1000) < 1 && Math.abs(buildLine(rest).total - (line.total - 1000)) < 1);
});

// ------------------------------------------------------------- 1 · 2 · 3 --
test('1. starting on the route: navigating toward the first stop', () => {
  const { eng, start } = harness();
  assert.equal(eng.get().status, 'idle');
  const s = start();
  assert.equal(s.status, 'navigating');
  assert.equal(s.next?.id, 'A');
  assert.ok(s.progress!.distanceFromRoute < 1);
  assert.ok(s.progress!.along < 1);
  assert.ok(Math.abs(s.progress!.distanceToNext - 5161) < 30);
});

test('2–3. progress increases and remaining distance / time decrease; ETA = now + time', () => {
  const { h, fix, start } = harness();
  start();
  const a = fix(-99.99), b = fix(-99.98), c = fix(-99.96);
  assert.ok(a.progress!.routeFraction < b.progress!.routeFraction && b.progress!.routeFraction < c.progress!.routeFraction);
  assert.ok(a.progress!.tripFraction < b.progress!.tripFraction && b.progress!.tripFraction < c.progress!.tripFraction);
  assert.ok(a.progress!.distanceToNext > b.progress!.distanceToNext && b.progress!.distanceToNext > c.progress!.distanceToNext);
  assert.ok(a.progress!.remainingDistance > c.progress!.remainingDistance);
  assert.ok(a.progress!.timeToNext > c.progress!.timeToNext);
  assert.ok(Math.abs(c.progress!.timeToNext - 600 * (c.progress!.distanceToNext / 5161)) < 5, 'provider leg time scaled by what is left');
  assert.equal(c.progress!.etaNext, h.t + c.progress!.timeToNext * 1000);
  assert.ok(Math.abs(c.progress!.remainingTime - (c.progress!.timeToNext + 600)) < 1e-6);
});

// ----------------------------------------------------------------- 4 · 5 --
test('4. one inaccurate or isolated off-route reading never reroutes', () => {
  const { h, fix, start } = harness();
  start();
  let s = fix(-99.99, LAT + 0.01, 400); // 1 km away but ±400 m: ignored for decisions
  assert.equal(s.status, 'navigating');
  s = fix(-99.99, LAT + NORTH_222M, 10); // one good off-route reading
  assert.equal(s.status, 'navigating');
  s = fix(-99.989); // back on the road resets the evidence
  offRoute(fix, -99.988, 2);
  s = fix(-99.987);
  offRoute(fix, -99.986, 2);
  assert.equal(h.reroutes, 0);
  // inside max(60 m, 1.5 × accuracy): 100 m away with ±80 m accuracy is still "on route"
  for (let i = 0; i < 5; i++) s = fix(-99.985, LAT + 0.0009, 80);
  assert.equal(h.reroutes, 0);
  assert.equal(s.status, 'navigating');
  assert.ok(OFF_ROUTE_MIN_M === 60);
});

test('5. three consecutive off-route readings trigger exactly one reroute', () => {
  const { h, eng, fix, start } = harness();
  start();
  let s = offRoute(fix, -99.99, 2);
  assert.equal(h.reroutes, 0);
  s = offRoute(fix, -99.99, 1);
  assert.equal(s.status, 'rerouting');
  assert.equal(h.reroutes, 1);
  offRoute(fix, -99.99, 5); // still off while the request is in flight: no second request
  assert.equal(h.reroutes, 1);
  assert.equal(eng.get().autoReroutes, 1);
  // the new route arrives: navigating again
  eng.setRoute(routeFrom([-99.99, LAT + NORTH_222M], [[-99.99, LAT + NORTH_222M], ...LINE.slice(10)]));
  assert.equal(eng.get().status, 'navigating');
});

test('5b. ~15 s off route with only two readings also confirms', () => {
  const { h, fix, start } = harness();
  start();
  fix(-99.99, LAT + NORTH_222M, 10, 1000);
  fix(-99.99, LAT + NORTH_222M, 10, 16000);
  assert.equal(h.reroutes, 1);
});

// ----------------------------------------------------------------- 6 · 7 · 8 --
test('6. reroute cooldown (45 s) is respected', () => {
  const { h, eng, fix, start } = harness();
  start();
  offRoute(fix);
  assert.equal(h.reroutes, 1);
  eng.routeFailed(new RouteError('provider-down'));
  let s = offRoute(fix, -99.99, 10, 1000); // 10 s more off route
  assert.equal(h.reroutes, 1);
  assert.equal(s.status, 'off-route');
  assert.equal(s.rerouteBlock, 'cooldown');
  s = offRoute(fix, -99.99, 1, REROUTE_COOLDOWN_MS);
  assert.equal(h.reroutes, 2);
  assert.equal(s.status, 'rerouting');
});

test('7. at most 6 automatic reroutes per trip; then only «Recalcular ruta»', () => {
  const { h, eng, fix, start } = harness();
  start();
  for (let i = 0; i < MAX_AUTO_REROUTES; i++) {
    offRoute(fix, -99.99, 3, i === 0 ? 1000 : REROUTE_COOLDOWN_MS);
    eng.routeFailed(new RouteError('timeout'));
  }
  assert.equal(h.reroutes, MAX_AUTO_REROUTES);
  const s = offRoute(fix, -99.99, 3, REROUTE_COOLDOWN_MS);
  assert.equal(h.reroutes, MAX_AUTO_REROUTES);
  assert.equal(s.rerouteBlock, 'limit');
  assert.equal(s.status, 'off-route');
  assert.equal(eng.manualReroute(), true);
  assert.equal(h.reroutes, MAX_AUTO_REROUTES + 1);
  assert.equal(eng.get().autoReroutes, MAX_AUTO_REROUTES, 'manual reroutes are not counted as automatic');
  assert.equal(eng.manualReroute(), false, 'never two requests in flight');
});

test('8. a failed reroute keeps the previous route on screen', () => {
  const { eng, fix, start } = harness();
  const first = start().route;
  offRoute(fix);
  eng.routeFailed(new RouteError('rate-limit', 'Demasiadas solicitudes'));
  const s = eng.get();
  assert.equal(s.route, first);
  assert.ok(eng.line && eng.line.total > 10000);
  assert.equal(s.routeError?.code, 'rate-limit');
  assert.equal(s.status, 'off-route');
  assert.ok(fix(-99.97).progress, 'progress still computed on the kept route');
});

// --------------------------------------------------------------- 9 · 10 --
test('9. offline: last route kept, progress continues, no reroute', () => {
  const { h, eng, fix, start } = harness();
  const first = start().route;
  h.online = false;
  eng.setOnline(false);
  let s = fix(-99.98);
  assert.ok(s.progress && s.progress.distanceToNext < 3200);
  s = offRoute(fix);
  assert.equal(h.reroutes, 0);
  assert.equal(s.rerouteBlock, 'offline');
  assert.equal(s.route, first);
  assert.equal(s.online, false);
  assert.equal(eng.manualReroute(), false);
});

test('10. back online: no immediate request, then exactly one when still off route', () => {
  const { h, eng, fix, start } = harness();
  start();
  h.online = false; eng.setOnline(false);
  offRoute(fix, -99.99, 4);
  h.online = true; eng.setOnline(true);
  assert.equal(h.reroutes, 0, 'reconnecting alone does not reroute');
  assert.equal(eng.get().rerouteBlock, null);
  offRoute(fix, -99.99, 6);
  assert.equal(h.reroutes, 1);
});

// --------------------------------------------------------- 11 · 12 · 13 · 14 --
test('11–14. arrival, visited, next stop, finished', () => {
  const { h, eng, fix, start } = harness();
  start();
  fix(-99.96);
  let s = fix(-99.95, LAT, 400); // poor reading at the stop: no arrival yet
  assert.equal(s.status, 'navigating');
  s = fix(-99.9503); // ~31 m before A, within 80 m + accuracy
  assert.equal(s.status, 'arrived-stop');
  assert.equal(s.arrived?.id, 'A');
  assert.equal(s.arrived?.visited, false);
  offRoute(fix, -99.95, 5); // wandering around the stop never reroutes
  assert.equal(h.reroutes, 0);
  assert.equal(eng.get().status, 'arrived-stop');

  eng.markVisited();
  s = eng.get();
  assert.deepEqual(h.visited, ['A']);
  assert.equal(s.arrived?.visited, true);
  assert.equal(s.doneStops, 1);
  assert.equal(s.status, 'arrived-stop', 'the visitor decides when to go on');

  eng.continueNext();
  s = eng.get();
  assert.equal(s.status, 'navigating');
  assert.equal(s.next?.id, 'B');
  assert.deepEqual(h.skipped, []);
  // the routing layer refreshes the route from here without A
  eng.setRoute(routeFrom([-99.95, LAT], LINE.slice(50), [{ id: 'B', coord: B }]));
  s = fix(-99.93);
  assert.equal(s.next?.id, 'B');
  assert.ok(s.progress!.tripFraction > 0.5);

  s = fix(-99.9002);
  assert.equal(s.status, 'arrived-stop');
  eng.markVisited();
  s = eng.get();
  assert.equal(s.status, 'finished');
  assert.deepEqual(s.summary?.visited, ['A', 'B']);
  assert.ok(s.summary!.travelled > 9000, `travelled ${s.summary!.travelled}`);
  assert.equal(ARRIVAL_RADIUS_M.foot, 35);
});

test('continuing without marking skips the stop for this trip only', () => {
  const { h, eng, fix, start } = harness();
  start();
  fix(-99.9502);
  eng.continueNext();
  assert.deepEqual(h.skipped, ['A']);
  assert.deepEqual(h.visited, []);
  assert.equal(eng.get().next?.id, 'B');
  assert.equal(eng.get().doneStops, 1);
});

test('a first route that cannot be computed is an error; nothing to navigate', () => {
  const { eng, fix } = harness();
  eng.start();
  fix(-100);
  eng.routeFailed(new RouteError('no-route', 'Sin ruta'));
  assert.equal(eng.get().status, 'error');
  const none = harness(0);
  none.eng.start();
  assert.equal(none.eng.get().error?.kind, 'no-stops');
});

// ------------------------------------------------------------------- 16 · 17 --
test('16. visited-stops record keeps only place ids, visited and visitedAt', () => {
  const dirty = { id: 'trip-1', startedAt: 5, lat: 22.1, stops: { A: { visited: true, visitedAt: 9, coord: [-100, 22], speed: 3 }, B: { visited: false } }, trace: [[1, 2]] };
  const clean = sanitize(dirty)!;
  assert.deepEqual(clean, { id: 'trip-1', startedAt: 5, stops: { A: { visited: true, visitedAt: 9 } } });
  assert.ok(!/22\.1|coord|speed|trace|-100/.test(JSON.stringify(clean)));
  assert.equal(sanitize({ nope: 1 }), null);
});

test('17. page hidden pauses decisions; visible again resumes with fresh evidence', () => {
  const { h, eng, fix, start } = harness();
  start();
  offRoute(fix, -99.99, 2);
  eng.pause('background');
  assert.equal(eng.get().status, 'paused');
  assert.equal(eng.get().pauseReason, 'background');
  offRoute(fix, -99.99, 5); // readings while hidden do not count
  assert.equal(h.reroutes, 0);
  eng.resume('background');
  assert.equal(eng.get().status, 'navigating');
  offRoute(fix, -99.99, 1); // the two readings from before the pause were discarded
  assert.equal(h.reroutes, 0);
  // a pause chosen by the visitor is not lifted by the page becoming visible
  eng.pause('user');
  eng.pause('background');
  eng.resume('background');
  assert.equal(eng.get().status, 'paused');
  eng.resume('user');
  assert.equal(eng.get().status, 'navigating');
});

test('GPS: silent signal is flagged as lost by the periodic tick', () => {
  const { h, eng, start } = harness();
  start();
  h.t += 31000;
  eng.tick();
  assert.equal(eng.get().gps, 'lost');
});

test('location filter: drops a jump with worse accuracy, never more than 3 in a row, no smoothing', () => {
  const base: GeoFix = { coord: [-100, LAT], accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, timestamp: 0 };
  const jump: GeoFix = { ...base, coord: [-99.99, LAT], accuracy: 300, timestamp: 2000 }; // 1 km in 2 s
  assert.equal(isOutlier(base, jump, 0), true);
  assert.equal(isOutlier(base, jump, MAX_REJECTS), false, 'accepted after repeated readings: the visitor moved');
  assert.equal(isOutlier(base, { ...jump, accuracy: 12 }, 0), false, 'a precise reading is never filtered here (off-route rules decide)');
  assert.equal(isOutlier(base, { ...base, coord: [-99.9995, LAT], timestamp: 5000 }, 0), false, 'normal driving passes');
  assert.equal(isOutlier(base, { ...base, timestamp: -1 }, 0), true, 'out-of-order reading');
});
