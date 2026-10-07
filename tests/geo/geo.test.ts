/**
 * Unit tests for the routing layer (pure modules + providers with a stubbed
 * fetch). Run: npm run test:geo   (bundled by scripts/test-geo.mjs, node:test)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeOrder, pathCost, nearestNeighbour, localSearch, type CostMatrix } from '../../src/scripts/geo/route-optimizer';
import { fmtDistance, fmtDuration, fmtDelta, haversine } from '../../src/scripts/geo/format';
import { parseRoute, osrmError, createOsrmProvider } from '../../src/scripts/geo/providers/osrm';
import { parseDirections, orsError, createOrsProvider } from '../../src/scripts/geo/providers/ors';
import { quotaFrom, readConfig, type RouteRequest } from '../../src/scripts/geo/route-provider';
import { routeKey, cacheGet, cacheSet, TTL_MS } from '../../src/scripts/geo/route-cache';
import { distanceToLine, recommend } from '../../src/scripts/geo/recommend';
import { statusForFix, geoLocation, APPROX_ACCURACY_M, STALE_AFTER_MS } from '../../src/scripts/geo/location-service';
import { RouteError, type RouteWaypoint } from '../../src/scripts/geo/types';
import type { Place } from '../../src/scripts/geo/places';

// ------------------------------------------------------------------ optimizer --
function permutations(a: number[]): number[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296); }

test('optimizer: fixed start matches brute force on random asymmetric matrices', () => {
  const r = rng(7);
  for (let t = 0; t < 30; t++) {
    const n = 6;
    const m: CostMatrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Math.round(r() * 1000) + 10)));
    const best = Math.min(...permutations([1, 2, 3, 4, 5]).map((p) => pathCost(m, [0, ...p])));
    const res = optimizeOrder(m, true);
    assert.equal(res.order[0], 0, 'origin stays first');
    assert.equal(new Set(res.order).size, n, 'every stop exactly once');
    assert.equal(res.cost, best, 'exact (Held–Karp) for small routes');
    assert.ok(res.cost <= res.originalCost);
  }
});

test('optimizer: free start is exact too', () => {
  const r = rng(11);
  for (let t = 0; t < 20; t++) {
    const m: CostMatrix = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => (i === j ? 0 : Math.round(r() * 1000) + 10)));
    const best = Math.min(...permutations([0, 1, 2, 3, 4, 5]).map((p) => pathCost(m, p)));
    assert.equal(optimizeOrder(m, false).cost, best);
  }
});

test('optimizer: heuristic (large routes) stays close to optimum on road-like (metric) data', () => {
  const r = rng(3);
  for (let t = 0; t < 20; t++) {
    const pts = Array.from({ length: 8 }, () => [r() * 200, r() * 200]);
    // roads are ~1.3× the straight line, slightly asymmetric
    const m: CostMatrix = pts.map((a, i) => pts.map((b, j) => (i === j ? 0 : Math.hypot(a[0] - b[0], a[1] - b[1]) * (1.3 + (i < j ? 0.02 : 0)))));
    const best = Math.min(...permutations([1, 2, 3, 4, 5, 6, 7]).map((p) => pathCost(m, [0, ...p])));
    const tour = localSearch(m, nearestNeighbour(m, pts.map((_, i) => i), 0));
    assert.equal(tour[0], 0);
    assert.ok(pathCost(m, tour) <= best * 1.1, `${pathCost(m, tour)} vs ${best}`);
  }
});

test('optimizer: 20 stops uses the heuristic and returns every stop once', () => {
  const r = rng(5);
  const pts = Array.from({ length: 20 }, () => [r() * 300, r() * 300]);
  const m: CostMatrix = pts.map((a) => pts.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])));
  const res = optimizeOrder(m, true);
  assert.equal(new Set(res.order).size, 20);
  assert.equal(res.order[0], 0);
  assert.ok(res.cost <= res.originalCost);
});

test('optimizer: untangles an obviously bad order on a line', () => {
  // points on a line at 0, 30, 10, 20 km → best open path 0,10,20,30
  const x = [0, 30, 10, 20];
  const m: CostMatrix = x.map((a) => x.map((b) => Math.abs(a - b)));
  const res = optimizeOrder(m, true);
  assert.deepEqual(res.order, [0, 2, 3, 1]);
  assert.equal(res.cost, 30);
  assert.equal(res.originalCost, 30 + 20 + 10);
});

test('optimizer: free start may pick a different first stop', () => {
  const x = [20, 0, 30, 10];
  const m: CostMatrix = x.map((a) => x.map((b) => Math.abs(a - b)));
  const res = optimizeOrder(m, false);
  assert.equal(res.cost, 30);
});

test('optimizer: unreachable pairs are never preferred', () => {
  const m: CostMatrix = [[0, 5, null], [5, 0, 5], [null, 5, 0]];
  const res = optimizeOrder(m, true);
  assert.deepEqual(res.order, [0, 1, 2]);
  assert.ok(Number.isFinite(res.cost));
});

// ---------------------------------------------------------------------- format --
test('format: Mexican units', () => {
  assert.equal(fmtDistance(850), '850 m');
  assert.equal(fmtDistance(1234), '1.2 km');
  assert.equal(fmtDistance(90354.6), '90 km');
  assert.equal(fmtDuration(40), '1 min');
  assert.equal(fmtDuration(42 * 60), '42 min');
  assert.equal(fmtDuration(3900), '1 h 5 min');
  assert.equal(fmtDuration(7200), '2 h');
  assert.equal(fmtDelta(-12000, 'distance'), '−12 km');
  assert.equal(fmtDelta(10, 'duration'), 'sin cambio');
  const d = haversine([-100.9737, 22.1499], [-100.43, 22.2357]);
  assert.ok(d > 55000 && d < 57000, String(d));
});

// ------------------------------------------------------------------- providers --
const wp = (id: string, lon: number, lat: number, role: RouteWaypoint['role'] = 'stop'): RouteWaypoint => ({ id, name: id, coord: [lon, lat], role, approximate: false });
const req2: RouteRequest = { waypoints: [wp('a', -100.97, 22.15, 'origin'), wp('b', -100.43, 22.23, 'destination')], profile: 'car', alternatives: true };
const req3: RouteRequest = { waypoints: [wp('a', -100.97, 22.15, 'origin'), wp('b', -100.43, 22.23), wp('c', -99.0, 21.98, 'destination')], profile: 'car', alternatives: false };

test('osrm: parses legs, totals and alternatives', () => {
  const body = {
    code: 'Ok',
    routes: [
      { geometry: { type: 'LineString' as const, coordinates: [[-100.97, 22.15], [-100.7, 22.2], [-100.43, 22.23]] as [number, number][] }, distance: 90354.6, duration: 5996.1, legs: [{ distance: 90354.6, duration: 5996.1 }] },
      { geometry: { type: 'LineString' as const, coordinates: [[-100.97, 22.15], [-100.43, 22.23]] as [number, number][] }, distance: 88361.2, duration: 6403, legs: [{ distance: 88361.2, duration: 6403 }] },
    ],
  };
  const r = parseRoute(body, req2);
  assert.equal(r.distance, 90354.6);
  assert.equal(r.legs.length, 1);
  assert.equal(r.legs[0].from, 'a');
  assert.equal(r.alternatives.length, 1);
  assert.equal(r.geometry.coordinates.length, 3);
  assert.match(r.attribution, /OpenStreetMap/);
});

test('osrm: error codes are normalized', () => {
  assert.equal(osrmError(400, { code: 'NoRoute' }).code, 'no-route');
  assert.equal(osrmError(400, { code: 'NoSegment' }).code, 'out-of-coverage');
  assert.equal(osrmError(400, { code: 'TooBig' }).code, 'too-many-waypoints');
  assert.equal(osrmError(400, { code: 'InvalidQuery' }).code, 'invalid-coordinates');
  assert.equal(osrmError(429, null).code, 'rate-limit');
  assert.equal(osrmError(502, null).code, 'provider-down');
});

test('ors: parses segments into legs and keeps alternatives', () => {
  const f = (d: number, t: number, segs: { distance: number; duration: number }[]) => ({
    geometry: { type: 'LineString' as const, coordinates: [[-100.97, 22.15], [-100.5, 22.2], [-99.0, 21.98]] as [number, number][] },
    properties: { summary: { distance: d, duration: t }, segments: segs },
  });
  const r = parseDirections({ type: 'FeatureCollection', features: [f(250000, 12000, [{ distance: 90000, duration: 5000 }, { distance: 160000, duration: 7000 }])] }, req3, { remaining: 1999, reset: 1700000000 });
  assert.equal(r.legs.length, 2);
  assert.deepEqual(r.legs.map((l) => [l.from, l.to, l.distance]), [['a', 'b', 90000], ['b', 'c', 160000]]);
  assert.equal(r.distance, 250000);
  assert.equal(r.quota?.remaining, 1999);
});

test('ors: error mapping (codes and HTTP statuses)', () => {
  assert.equal(orsError(404, { error: { code: 2010, message: 'Could not find routable point within a radius of 350.0 meters' } }).code, 'out-of-coverage');
  assert.equal(orsError(404, { error: { code: 2009, message: 'Route could not be found' } }).code, 'no-route');
  assert.equal(orsError(429, { error: 'Rate Limit Exceeded' }).code, 'rate-limit');
  assert.equal(orsError(403, { error: 'Daily quota reached or API key unauthorized' }).code, 'quota');
  assert.equal(orsError(403, { error: 'Access to this API has been disallowed' }).code, 'unauthorized');
  assert.equal(orsError(401, null).code, 'unauthorized');
  assert.equal(orsError(503, null).code, 'provider-down');
});

test('ors: without a proxy the provider reports not-configured (no request made)', async () => {
  let called = false;
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => { called = true; return new Response('{}'); }) as typeof fetch;
  try {
    await assert.rejects(createOrsProvider(null).route(req2), (e: unknown) => e instanceof RouteError && e.code === 'not-configured');
    assert.equal(called, false);
  } finally { globalThis.fetch = orig; }
});

test('ors: 429 through the proxy becomes rate-limit with retry-after; quota headers are read', async () => {
  const orig = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ error: 'Rate Limit Exceeded' }), { status: 429, headers: { 'retry-after': '30', 'x-ratelimit-remaining': '0' } });
  }) as typeof fetch;
  try {
    await assert.rejects(createOrsProvider('/api/ors').route(req2), (e: unknown) => e instanceof RouteError && e.code === 'rate-limit' && e.retryAfter === 30);
    assert.equal(calls[0].url, '/api/ors/v2/directions/driving-car/geojson');
    const sent = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(sent.coordinates[0], [-100.97, 22.15]);
    assert.ok(sent.alternative_routes, 'alternatives requested for 2 points');
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, undefined, 'the client never sends a key');
  } finally { globalThis.fetch = orig; }
  const q = quotaFrom(new Headers({ 'x-ratelimit-remaining': '12', 'x-ratelimit-reset': '1700000000' }));
  assert.deepEqual(q, { remaining: 12, reset: 1700000000 });
  assert.equal(quotaFrom(new Headers()), null);
});

test('osrm: network failure becomes provider-down; foot profile uses routed-foot', async () => {
  const orig = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => { urls.push(url); throw new TypeError('Failed to fetch'); }) as typeof fetch;
  try {
    await assert.rejects(createOsrmProvider('https://example.test').route({ ...req2, profile: 'foot' }), (e: unknown) => e instanceof RouteError && e.code === 'provider-down');
    assert.match(urls[0], /^https:\/\/example\.test\/routed-foot\/route\/v1\/driving\/-100\.970000,22\.150000;-100\.430000,22\.230000\?/);
    assert.match(urls[0], /geometries=geojson/);
  } finally { globalThis.fetch = orig; }
});

test('providers: invalid coordinates are rejected before any request', async () => {
  const bad: RouteRequest = { ...req2, waypoints: [wp('a', -100.97, 22.15), wp('b', 200, 22.23)] };
  await assert.rejects(createOsrmProvider('https://example.test').route(bad), (e: unknown) => e instanceof RouteError && e.code === 'invalid-coordinates');
  await assert.rejects(createOsrmProvider('https://example.test').route({ ...req2, waypoints: [req2.waypoints[0]] }), (e: unknown) => e instanceof RouteError && e.code === 'invalid-coordinates');
});

test('config: default is auto without a proxy (keyless fallback)', () => {
  const c = readConfig();
  assert.equal(c.choice, 'auto');
  assert.equal(c.orsBase, null);
});

// ------------------------------------------------------------------------ cache --
test('cache: key rounds to ~1 m and separates provider/profile/order', () => {
  const a = routeKey('route', 'ors', 'car', [[-100.123456, 22.123456], [-100.5, 22.5]]);
  const b = routeKey('route', 'ors', 'car', [[-100.1234561, 22.1234559], [-100.5, 22.5]]);
  assert.equal(a, b);
  assert.notEqual(a, routeKey('route', 'ors', 'foot', [[-100.123456, 22.123456], [-100.5, 22.5]]));
  assert.notEqual(a, routeKey('route', 'osrm-fossgis', 'car', [[-100.123456, 22.123456], [-100.5, 22.5]]));
  assert.notEqual(a, routeKey('route', 'ors', 'car', [[-100.5, 22.5], [-100.123456, 22.123456]]));
  cacheSet(a, { v: 1 }, false, 1000);
  assert.deepEqual(cacheGet(a, 2000), { v: 1 });
  assert.equal(cacheGet(a, 1000 + TTL_MS + 1), null, 'expires');
});

// ------------------------------------------------------------------ recommend --
const place = (id: string, lon: number, lat: number, extra: Partial<Place> = {}): Place => ({
  id, name: id, region: 'centro', kind: 'Destino', municipality: null, description: null, url: `/d/${id}/`, coords: [lon, lat], status: 'ready',
  interests: [], image: null, weather: { key: 'x', name: 'x', lat, lon }, ...extra,
});

test('recommend: distance to line and corridor rule', () => {
  const line: [number, number][] = [[-101, 22], [-100, 22]];
  const d = distanceToLine([-100.5, 22.05], line);
  assert.ok(d > 5000 && d < 5800, String(d)); // 0.05° lat ≈ 5.5 km
  const a = place('a', -101, 22), b = place('b', -100, 22, { interests: ['cascadas'] });
  const near = place('near', -100.5, 22.02, { interests: ['cascadas'] });
  const far = place('far', -100.5, 22.5);
  const seat = place('seat', -100.5, 22.01, { layer: 'entity', group: 'seats' });
  const hotel = place('hotel', -100.01, 22.01, { layer: 'entity', group: 'lodging', status: 'provisional' });
  const recs = recommend({ stops: [a, b], line, profile: 'car', places: [a, b, near, far, seat, hotel], month: 10,
    context: { events: [{ id: 'e1', n: 'Fiesta', mk: 'xilitla', m: 'Xilitla', r: 'huasteca', mo: [10], ay: false, ds: 'Patrón oficial', cd: null, u: '/e/' }], dishes: { centro: ['Enchiladas potosinas'] } } });
  const ids = recs.map((r) => r.id);
  assert.ok(ids.includes('near:near'));
  assert.ok(!ids.includes('near:far'), 'outside the corridor');
  assert.ok(!ids.includes('near:seat'), 'municipal seats are not suggested as attractions');
  assert.ok(!ids.includes('near:a'), 'stops already in the route are never suggested');
  assert.ok(ids.includes('lodg:hotel'));
  assert.ok(!ids.some((i) => i.startsWith('ev:')), 'event in another municipality/region is not suggested');
  assert.match(recs.find((r) => r.id === 'near:near')!.reason, /en línea recta.*cascadas/);
  assert.ok(ids.includes('dish:centro'));
});

test('recommend: events match the stop municipality and month', () => {
  const a = place('a', -99.0, 21.4, { municipality: 'Xilitla', region: 'huasteca' });
  const recs = recommend({ stops: [a], line: null, profile: 'car', places: [a], month: 9,
    context: { events: [
      { id: 'e1', n: 'Fiesta de octubre', mk: 'xilitla', m: 'Xilitla', r: 'huasteca', mo: [10], ay: false, ds: 'Patrón oficial', cd: null, u: '/e1/' },
      { id: 'e2', n: 'Fiesta de marzo', mk: 'xilitla', m: 'Xilitla', r: 'huasteca', mo: [3], ay: false, ds: null, cd: null, u: '/e2/' },
    ], dishes: {} } });
  const ev = recs.filter((r) => r.kind === 'event');
  assert.equal(ev.length, 1);
  assert.match(ev[0].reason, /en octubre en Xilitla, tu parada 1/);
});

// --------------------------------------------------------------------- location --
test('location: ok / approximate / stale', () => {
  const now = 1_000_000_000;
  const fix = (accuracy: number, age: number) => ({ coord: [-100.97, 22.15] as [number, number], accuracy, altitude: null, altitudeAccuracy: null, timestamp: now - age });
  assert.equal(statusForFix(fix(30, 0), now), 'ok');
  assert.equal(statusForFix(fix(APPROX_ACCURACY_M + 1, 0), now), 'approximate');
  assert.equal(statusForFix(fix(30, STALE_AFTER_MS + 1), now), 'stale');
});

test('location: unsupported, denied, timeout and null altitude', async () => {
  const nav = globalThis.navigator as unknown as { geolocation?: unknown };
  const had = Object.getOwnPropertyDescriptor(globalThis.navigator, 'geolocation');
  const setGeo = (g: unknown) => Object.defineProperty(globalThis.navigator, 'geolocation', { value: g, configurable: true });
  try {
    setGeo(undefined);
    geoLocation.forget();
    assert.equal(await geoLocation.locate(), null);
    assert.equal(geoLocation.get().status, 'unsupported');

    setGeo({ getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }) });
    assert.equal(await geoLocation.locate(), null);
    assert.equal(geoLocation.get().status, 'denied');
    assert.match(geoLocation.get().message ?? '', /punto de partida/);

    setGeo({ getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) => err({ code: 3 }) });
    await geoLocation.locate();
    assert.equal(geoLocation.get().status, 'timeout');

    setGeo({ getCurrentPosition: (ok: (p: unknown) => void) => ok({ timestamp: Date.now(), coords: { latitude: 22.15, longitude: -100.97, accuracy: 25, altitude: null, altitudeAccuracy: null } }) });
    const fix = await geoLocation.locate();
    assert.ok(fix);
    assert.equal(fix!.altitude, null, 'altitude is never invented');
    assert.equal(geoLocation.get().status, 'ok');

    setGeo({ getCurrentPosition: (ok: (p: unknown) => void) => ok({ timestamp: Date.now(), coords: { latitude: 22.15, longitude: -100.97, accuracy: 9, altitude: 1864.4, altitudeAccuracy: 6 } }) });
    assert.equal((await geoLocation.locate())!.altitude, 1864.4);

    let cleared: number | null = null;
    setGeo({ watchPosition: () => 42, clearWatch: (id: number) => { cleared = id; } });
    geoLocation.follow();
    assert.equal(geoLocation.get().watching, true);
    geoLocation.stopFollowing();
    assert.equal(cleared, 42, 'clearWatch called with the watch id');
    geoLocation.forget();
    assert.equal(geoLocation.get().fix, null);
  } finally {
    if (had) Object.defineProperty(globalThis.navigator, 'geolocation', had); else delete nav.geolocation;
    geoLocation.dispose();
  }
});
