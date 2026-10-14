/**
 * External signals: guards (cache, quota, breaker, client) and provider
 * adapters. Everything runs on fixtures and injected clocks: no network, no
 * credit. Run: npm run test:signals
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache, QuotaCounter, CircuitBreaker, SignalClient, ProviderError, memoryKV, type QuotaLimits } from '../../src/lib/signals/guard';
import { parseBestTimeForecast, parseBestTimeLive, parseTomTomFlow, parseTomTomIncidents, parseFr24Movements, openMeteoSignals, visitWindows, bboxAreaKm2, BESTTIME, TOMTOM } from '../../src/lib/signals/providers';
import { besttimeForecastFixture, besttimeLiveFixture, tomtomFlowFixture, tomtomIncidentsFixture, fr24MovementsFixture, fixtureFor, DEMO_VENUES, DEMO_CORRIDORS, DEMO_AIRPORT } from '../../src/lib/signals/fixtures';
import { isReal, unavailable, type ProviderId, type ProviderMode, type TourismSignal } from '../../src/lib/signals/types';
import catalog from '../../serverless/signals-proxy/catalog.json';

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0);
const at = new Date(T0), exp = new Date(T0 + 60_000);
const LIMITS: Record<ProviderId, QuotaLimits> = { besttime: { perDay: 4, perMonth: 6 }, tomtom: { perDay: 3, perMonth: 100 }, fr24: { perDay: 2, perMonth: 2 }, 'open-meteo': { perDay: 9, perMonth: 9 } };
const modes = (m: ProviderMode): Record<ProviderId, ProviderMode> => ({ besttime: m, tomtom: m, fr24: m, 'open-meteo': m });
function rig(mode: ProviderMode = 'live', opt: { maxRetries?: number } = {}) {
  let now = T0;
  const kv = memoryKV();
  const quota = new QuotaCounter(kv, LIMITS, () => now);
  const log: string[] = [];
  const client = new SignalClient({ modes: modes(mode), cache: new TtlCache(kv, () => now), quota, now: () => now, fixtures: fixtureFor, maxRetries: opt.maxRetries ?? 1, onEvent: (e) => log.push(`${e.kind}${e.detail ? ':' + e.detail : ''}`) });
  return { client, quota, log, tick: (ms: number) => { now += ms; }, now: () => now };
}
const flowReq = (fetcher: () => Promise<unknown>, id = 'demo-tramo-1') => ({ provider: 'tomtom' as const, signalType: 'road-speed' as const, placeId: id, key: `flow:${id}`, ttlMs: 300_000, fetcher: fetcher as () => Promise<never>, parse: parseTomTomFlow(id) });

// ------------------------------------------------------------------- guards --
test('cache: fresh until the TTL, then only reachable as stale', () => {
  let now = 0; const c = new TtlCache(memoryKV(), () => now);
  c.set('k', { a: 1 }, 1000);
  assert.deepEqual(c.get<{ a: number }>('k')?.value, { a: 1 });
  now = 1000;
  assert.equal(c.get('k'), null);
  assert.deepEqual(c.peek<{ a: number }>('k')?.value, { a: 1 });
  assert.equal(c.get('missing'), null);
});

test('quota: daily and monthly ceilings, counted per provider, reset with the calendar', () => {
  let now = T0; const q = new QuotaCounter(memoryKV(), LIMITS, () => now);
  assert.ok(q.canSpend('besttime', 2)); q.spend('besttime', 2); q.spend('besttime', 2);
  assert.equal(q.canSpend('besttime', 1), false, 'daily limit of 4 reached');
  assert.ok(q.canSpend('tomtom'), 'another provider is unaffected');
  now += 24 * 3600_000;
  assert.ok(q.canSpend('besttime', 2), 'a new day');
  q.spend('besttime', 2);
  assert.equal(q.canSpend('besttime', 1), false, 'monthly limit of 6 reached on day two');
  assert.equal(q.snapshot('besttime').usedMonth, 6);
  assert.equal(q.snapshot('besttime').shareOfMonth, 1);
  now = Date.UTC(2026, 10, 1);
  assert.ok(q.canSpend('besttime', 2), 'a new month');
});

test('breaker: opens after repeated failures and closes after the cooldown', () => {
  let now = 0; const b = new CircuitBreaker(3, 1000, () => now);
  b.failure(); b.failure(); assert.equal(b.open, false);
  b.failure(); assert.equal(b.open, true); assert.equal(b.retryInMs, 1000);
  now = 1000; assert.equal(b.open, false);
  b.failure(); b.success(); b.failure(); b.failure(); assert.equal(b.open, false, 'a success resets the count');
  b.trip(5000); assert.equal(b.open, true);
});

// ------------------------------------------------------------------- client --
test('client off: no request, no quota, an explained unavailable signal', async () => {
  const { client, quota } = rig('off');
  let calls = 0;
  const [s] = await client.get(flowReq(async () => { calls++; return tomtomFlowFixture('demo-tramo-1'); }));
  assert.equal(calls, 0);
  assert.equal(s.status, 'unavailable'); assert.match(s.note!, /desactivada/);
  assert.equal(quota.snapshot('tomtom').usedMonth, 0);
});

test('client mock: fixtures only, relabelled as simulated, never counted as real', async () => {
  const { client, quota } = rig('mock');
  let calls = 0;
  const out = await client.get(flowReq(async () => { calls++; return {}; }));
  assert.equal(calls, 0, 'the network fetcher is never called in mock mode');
  assert.ok(out.length === 4 && out.every((s) => s.status === 'simulated' && s.evidenceType === 'simulated' && s.confidence === null));
  assert.ok(out.every((s) => !isReal(s)));
  assert.equal(quota.snapshot('tomtom').usedMonth, 0, 'fixtures cost nothing');
  const [none] = await client.get({ provider: 'besttime', signalType: 'relative-busyness-forecast', placeId: 'x', key: 'forecast:demo-recinto-sin-datos', ttlMs: 1, fetcher: async () => ({}), parse: parseBestTimeForecast('x') });
  assert.equal(none.status, 'unavailable', 'a venue without coverage stays without data, also in the demo');
});

test('client live: caches, de-duplicates and counts one request', async () => {
  const { client, quota, tick } = rig('live');
  let calls = 0;
  const fetcher = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return tomtomFlowFixture('demo-tramo-1'); };
  const [a, b] = await Promise.all([client.get(flowReq(fetcher)), client.get(flowReq(fetcher))]);
  assert.equal(calls, 1, 'two simultaneous requests for the same key share one call');
  assert.deepEqual(a, b);
  assert.equal(a[0].status, 'live');
  await client.get(flowReq(fetcher));
  assert.equal(calls, 1, 'served from cache inside the TTL');
  tick(300_001);
  await client.get(flowReq(fetcher));
  assert.equal(calls, 2, 'refetched after the TTL');
  assert.equal(quota.snapshot('tomtom').usedMonth, 2);
});

test('client live: the quota ceiling stops requests before they leave', async () => {
  const { client, log } = rig('live');
  let calls = 0;
  const f = async () => { calls++; return tomtomFlowFixture('demo-tramo-1'); };
  for (const id of ['a', 'b', 'c']) await client.get(flowReq(f, id));
  const [s] = await client.get(flowReq(f, 'd'));
  assert.equal(calls, 3, 'the fourth request of the day is not sent');
  assert.equal(s.status, 'unavailable'); assert.match(s.note!, /límite de consultas/);
  assert.ok(log.includes('blocked:quota'));
});

test('client live: HTTP 429 opens the breaker at once and is never retried', async () => {
  const { client, tick } = rig('live');
  let calls = 0;
  const f = async () => { calls++; throw new ProviderError('HTTP 429', 429, 120); };
  const [s] = await client.get(flowReq(f));
  assert.equal(calls, 1, 'no retry after 429');
  assert.equal(s.status, 'unavailable');
  assert.equal(client.breaker('tomtom').open, true);
  await client.get(flowReq(f, 'other'));
  assert.equal(calls, 1, 'no request while the breaker is open');
  tick(120_001);
  assert.equal(client.breaker('tomtom').open, false, 'Retry-After is respected');
});

test('client live: bounded retries on 5xx and network errors, none on 4xx', async () => {
  let r = rig('live'), calls = 0;
  await r.client.get(flowReq(async () => { calls++; throw new ProviderError('HTTP 503', 503); }));
  assert.equal(calls, 2, 'one retry');
  r = rig('live'); calls = 0;
  await r.client.get(flowReq(async () => { calls++; throw new ProviderError('HTTP 403', 403); }));
  assert.equal(calls, 1, 'a 4xx is not retried');
  r = rig('live'); calls = 0;
  const out = await r.client.get(flowReq(async () => { calls++; if (calls === 1) throw new Error('network'); return tomtomFlowFixture('demo-tramo-1'); }));
  assert.equal(calls, 2); assert.equal(out[0].status, 'live', 'recovers on the retry');
});

test('client live: a failing provider serves the last value as stale, and never throws', async () => {
  const { client, tick } = rig('live');
  let fail = false;
  const f = async () => { if (fail) throw new ProviderError('HTTP 500', 500); return tomtomFlowFixture('demo-tramo-2'); };
  const first = await client.get(flowReq(f, 'demo-tramo-2'));
  fail = true; tick(300_001);
  const second = await client.get(flowReq(f, 'demo-tramo-2'));
  assert.equal(second[0].status, 'stale'); assert.equal(second[0].value, first[0].value); assert.equal(second[0].retrievedAt, first[0].retrievedAt, 'the original time is kept');
  const broken = await rig('live').client.get({ ...flowReq(async () => ({ unexpected: true })), key: 'flow:zzz' });
  assert.equal(broken[0].status, 'unavailable'); assert.match(broken[0].note!, /no coincide con su documentación/);
});

test('client live: a provider switched off at the proxy reads as off, without retry or breaker', async () => {
  const { client } = rig('live');
  let calls = 0;
  const [s] = await client.get(flowReq(async () => { calls++; throw new ProviderError('provider-disabled', 503); }));
  assert.equal(calls, 1, 'not retried'); assert.equal(s.status, 'unavailable'); assert.match(s.note!, /desactivada/);
  assert.equal(client.breaker('tomtom').open, false);
  const [c] = await client.get(flowReq(async () => { calls++; throw new ProviderError('provider-cooldown', 503, 45); }, 'cool'));
  assert.equal(calls, 2, 'a cooldown answer is not retried'); assert.equal(client.breaker('tomtom').open, true); assert.match(c.note!, /pausaron/);
});

test('client live: three failures in a row stop the calls for that provider only', async () => {
  const { client } = rig('live', { maxRetries: 0 });
  let calls = 0;
  const bad = async () => { calls++; throw new ProviderError('HTTP 500', 500); };
  for (const id of ['a', 'b', 'c']) await client.get({ ...flowReq(bad, id), provider: 'besttime' as const, parse: parseBestTimeForecast(id) });
  assert.equal(client.breaker('besttime').open, true);
  await client.get({ ...flowReq(bad, 'd'), provider: 'besttime' as const, parse: parseBestTimeForecast('d') });
  assert.equal(calls, 3);
  assert.equal(client.breaker('tomtom').open, false);
});

// ----------------------------------------------------------------- adapters --
test('BestTime forecast: hourly values relative to the venue, starting at 6 AM, closed hours kept as zero', () => {
  const out = parseBestTimeForecast('m1')(besttimeForecastFixture('demo-recinto-a') as never, at, exp);
  assert.equal(out.length, 7 * 24);
  assert.ok(out.every((s) => s.status === 'forecast' && s.evidenceType === 'estimated' && s.unit === BESTTIME.unit && s.confidence === null));
  assert.equal(out[0].meta!.hour, 6); assert.equal(out[23].meta!.hour, 5);
  assert.ok(out.every((s) => typeof s.value === 'number' && s.value >= 0 && s.value <= 100));
});

test('BestTime: no coverage means no data, never a filled-in value', () => {
  for (const p of [besttimeForecastFixture('demo-recinto-sin-datos'), { status: 'OK' }, { status: 'OK', analysis: [] }, { status: 'OK', analysis: [{ day_info: { day_int: 0 }, day_raw: [null, 'x', -1] }] }]) {
    const out = parseBestTimeForecast('m1')(p as never, at, exp);
    assert.equal(out.length, 1); assert.equal(out[0].status, 'unavailable'); assert.equal(out[0].note, 'Sin información de concurrencia para este establecimiento'); assert.equal(out[0].value, null);
  }
  assert.throws(() => parseBestTimeForecast('m1')(null as never, at, exp));
  const live = parseBestTimeLive('m1')(besttimeLiveFixture('demo-recinto-b') as never, at, exp);
  assert.equal(live[0].status, 'unavailable', 'a forecast without a live reading is not presented as live');
  const ok = parseBestTimeLive('m1')(besttimeLiveFixture('demo-recinto-a') as never, at, exp);
  assert.equal(ok[0].status, 'live'); assert.equal(ok[0].value, 64); assert.equal(ok[0].meta!.delta, 9);
});

test('visit windows: quiet and busy hours are defined inside one venue and one day', () => {
  const w = visitWindows(parseBestTimeForecast('m1')(besttimeForecastFixture('demo-recinto-a') as never, at, exp));
  assert.equal(w.length, 7);
  const sat = w.find((x) => x.day === 5)!;
  assert.equal(sat.peak, 13);
  assert.ok(sat.busy.includes(13) && sat.quiet.length > 0 && sat.quiet.every((h) => !sat.busy.includes(h)));
  assert.ok(sat.quiet.every((h) => h >= 9 && h <= 18), 'closed hours are not offered as quiet hours');
  assert.equal(sat.hours[0].hour, 6, 'ordered from the first hour of the provider window');
  assert.deepEqual(visitWindows([unavailable('besttime', 'relative-busyness-forecast', 'x', 'n')]), []);
});

test('TomTom flow: speeds, ratio, closure and the provider confidence; nothing is derived about routes', () => {
  const out = parseTomTomFlow('c1')(tomtomFlowFixture('demo-tramo-2') as never, at, exp);
  const by = Object.fromEntries(out.map((s) => [s.signalType, s]));
  assert.equal(by['road-speed'].value, 31); assert.equal(by['road-free-flow-speed'].value, 80);
  assert.equal(by['road-speed-ratio'].value, 0.39); assert.equal(by['road-closure'].value, false);
  assert.equal(by['road-speed'].confidence, 0.9); assert.equal(by['road-speed'].evidenceType, 'observed'); assert.equal(by['road-free-flow-speed'].evidenceType, 'estimated');
  assert.equal(parseTomTomFlow('c1')(tomtomFlowFixture('demo-tramo-3') as never, at, exp).find((s) => s.signalType === 'road-closure')!.value, true);
  assert.equal(parseTomTomFlow('c1')({ flowSegmentData: { currentSpeed: 'fast' } } as never, at, exp)[0].status, 'unavailable');
  assert.equal(parseTomTomFlow('c1')({ flowSegmentData: { currentSpeed: 40, freeFlowSpeed: 0, confidence: 7 } } as never, at, exp).find((s) => s.signalType === 'road-speed-ratio')!.value, null);
  assert.throws(() => parseTomTomFlow('c1')({} as never, at, exp));
});

test('TomTom incidents: categories, closures and null entries', () => {
  assert.deepEqual(parseTomTomIncidents('c1')(tomtomIncidentsFixture('demo-tramo-1') as never, at, exp), []);
  const out = parseTomTomIncidents('c1')(tomtomIncidentsFixture('demo-tramo-3') as never, at, exp);
  assert.equal(out.length, 1, 'null entries are dropped');
  assert.equal(out[0].value, 'Camino cerrado'); assert.equal(out[0].meta!.closed, true); assert.equal(out[0].meta!.delayS, null);
  assert.throws(() => parseTomTomIncidents('c1')({} as never, at, exp));
});

test('TomTom: every corridor of the catalogue respects the incident bounding-box limit', () => {
  for (const c of catalog.corridors) {
    assert.ok(bboxAreaKm2(c.bbox as [number, number, number, number]) < TOMTOM.maxBboxKm2, c.id);
    assert.ok(c.point[0] > -103 && c.point[0] < -98 && c.point[1] > 21 && c.point[1] < 25, 'inside San Luis Potosí');
  }
});

test('Flightradar24: flights are counted as flights; the sandbox is never presented as a real day', () => {
  const period = { from: '2026-10-12T00:00:00Z', to: '2026-10-12T23:59:59Z' };
  const sb = parseFr24Movements(DEMO_AIRPORT, period, true)(fr24MovementsFixture(), at, exp);
  assert.deepEqual(sb.map((s) => [s.meta!.direction, s.value]), [['arrivals', 3], ['departures', 2]]);
  assert.ok(sb.every((s) => s.status === 'simulated' && s.evidenceType === 'simulated' && /no son pasajeros ni turistas/.test(s.unit!)));
  const real = parseFr24Movements(DEMO_AIRPORT, period, false)(fr24MovementsFixture(), at, exp);
  assert.ok(real.every((s) => s.status === 'historical' && s.evidenceType === 'observed'));
  assert.ok(real.every((s) => !('passengers' in (s.meta ?? {}))));
  assert.throws(() => parseFr24Movements(DEMO_AIRPORT, period, true)({} as never, at, exp));
});

test('Open-Meteo: current values are modelled, the daily probability is a forecast', () => {
  const out = openMeteoSignals('huasteca', { temp: 28.4, code: 61, precip: 1.2, rainProb: 70 }, at);
  assert.deepEqual(out.map((s) => s.status), ['live', 'live', 'forecast']);
  assert.ok(out.every((s) => s.evidenceType === 'estimated'), 'a model output, not a station reading');
  assert.equal(openMeteoSignals('x', { temp: 20, code: 0, precip: 0, rainProb: null }, at).length, 2, 'no probability, no forecast signal');
});

test('fixtures and catalogue: demo ids are not real places, pilot venues are official records', () => {
  const real = new Set([...catalog.venues.map((v) => v.id), ...catalog.corridors.map((c) => c.id), catalog.airport.icao]);
  for (const id of [...DEMO_VENUES.map((v) => v.id), ...DEMO_CORRIDORS.map((c) => c.id), DEMO_AIRPORT]) assert.ok(/^demo|^DEMO/.test(id) && !real.has(id));
  assert.ok(catalog.venues.length >= 12 && catalog.venues.length <= 20);
  for (const r of ['altiplano', 'centro', 'zona-media', 'huasteca']) assert.ok(catalog.venues.filter((v) => v.region === r).length >= 3, r);
  assert.ok(catalog.venues.every((v) => v.coverage === 'unverified' && v.address.length > 10 && !/cerrado/i.test(v.name)));
  const signalsOf = (s: TourismSignal[]) => s.every((x) => x.sourceUrl.startsWith('https://') && x.retrievedAt <= x.expiresAt);
  assert.ok(signalsOf(parseTomTomFlow('c')(tomtomFlowFixture('demo-tramo-1') as never, at, exp)));
});
