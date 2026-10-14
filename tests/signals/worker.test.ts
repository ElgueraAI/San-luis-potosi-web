/**
 * The signals proxy (serverless/signals-proxy/worker.js) run in node with a
 * fake KV and a fake upstream: kill switches, allow-lists, budgets, cache and
 * the planner endpoint. No network. Run: npm run test:signals
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain JavaScript module without type declarations
import { handle, upstream, validatePlanRequest, spend, BUDGETS, LLM_LIMITS, COOLDOWN_S } from '../../serverless/signals-proxy/worker.js';
import catalog from '../../serverless/signals-proxy/catalog.json';

const ORIGIN = 'https://elgueraai.github.io';
const NOW = Date.UTC(2026, 9, 13, 12);
function kvStore() {
  const m = new Map<string, string>();
  return { m, get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) };
}
function upstreamOk(payload: unknown, status = 200) {
  const calls: string[] = [];
  const fetch = async (url: string) => { calls.push(String(url)); return new Response(JSON.stringify(payload), { status, headers: status === 429 ? { 'Retry-After': '77' } : {} }); };
  return { fetch, calls };
}
const env = (o: Record<string, unknown> = {}) => ({ ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4321`, ...o });
const req = (path: string, init: RequestInit & { origin?: string | null; ip?: string } = {}) => new Request(`https://proxy.example/v1/${path}`, { ...init, headers: { ...(init.origin === null ? {} : { Origin: init.origin ?? ORIGIN }), 'CF-Connecting-IP': init.ip ?? '203.0.113.7', ...(init.headers ?? {}) } });
const corridor = catalog.corridors[0].id, venue = catalog.venues[0].id;
const liveEnv = (kv: unknown, o: Record<string, unknown> = {}) => env({ SIGNALS_ENABLED: 'tomtom,besttime,fr24', TOMTOM_API_KEY: 'tt-secret', BESTTIME_API_KEY_PRIVATE: 'bt-secret', FR24_API_TOKEN: 'fr-secret', BUDGET: kv, ...o });

test('worker: off by default; nothing is forwarded without an explicit switch, a key and a budget store', async () => {
  const up = upstreamOk({});
  let r = await handle(req(`tomtom/flow?corridor=${corridor}`), env({ TOMTOM_API_KEY: 'k', BUDGET: kvStore() }), { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'provider-disabled');
  assert.equal(r.headers.get('X-Signal-Error'), 'provider-disabled');
  assert.match(r.headers.get('Access-Control-Expose-Headers') ?? '', /Retry-After/, 'the browser can read Retry-After');
  r = await handle(req(`tomtom/flow?corridor=${corridor}`), env({ SIGNALS_ENABLED: 'tomtom', BUDGET: kvStore() }), { fetch: up.fetch, now: NOW });
  assert.equal((await r.json()).error, 'provider-not-configured');
  r = await handle(req(`tomtom/flow?corridor=${corridor}`), env({ SIGNALS_ENABLED: 'tomtom', TOMTOM_API_KEY: 'k' }), { fetch: up.fetch, now: NOW });
  assert.equal((await r.json()).error, 'no-budget-store', 'no counter store means no spending: fail closed');
  assert.equal(up.calls.length, 0);
});

test('worker: origin, method and route allow-lists', async () => {
  const kv = kvStore(), up = upstreamOk({});
  assert.equal((await handle(req(`tomtom/flow?corridor=${corridor}`, { origin: 'https://evil.example' }), liveEnv(kv), { fetch: up.fetch, now: NOW })).status, 403);
  assert.equal((await handle(req(`tomtom/flow?corridor=${corridor}`, { origin: null }), liveEnv(kv), { fetch: up.fetch, now: NOW })).status, 403);
  assert.equal((await handle(req(`tomtom/flow?corridor=${corridor}`, { method: 'POST' }), liveEnv(kv), { fetch: up.fetch, now: NOW })).status, 405);
  assert.equal((await handle(req('tomtom/routing?corridor=x'), liveEnv(kv), { fetch: up.fetch, now: NOW })).status, 404);
  const pre = await handle(req('tomtom/flow', { method: 'OPTIONS' }), liveEnv(kv), { fetch: up.fetch, now: NOW });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(up.calls.length, 0);
});

test('worker: the browser can only name catalogue entries, never an address or a coordinate', async () => {
  const kv = kvStore(), up = upstreamOk({});
  for (const path of ['tomtom/flow?corridor=../../etc', 'tomtom/flow?point=22.1,-100.9', 'besttime/forecast?venue=unknown', 'besttime/forecast?venue_name=Louvre&venue_address=Paris', 'fr24/movements?day=yesterday', 'tomtom/incidents?bbox=-180,-90,180,90']) {
    const r = await handle(req(path), liveEnv(kv), { fetch: up.fetch, now: NOW });
    assert.equal(r.status, 404, path);
  }
  assert.equal(up.calls.length, 0);
  assert.equal(upstream('tomtom/flow', new URLSearchParams({ corridor }), {}).cacheKey, `tomtom/flow:${corridor}`);
});

test('worker: forwards with the secret, caches the answer, and the key never reaches the client', async () => {
  const kv = kvStore(), up = upstreamOk({ flowSegmentData: { currentSpeed: 50, freeFlowSpeed: 60 } });
  const r1 = await handle(req(`tomtom/flow?corridor=${corridor}`), liveEnv(kv), { fetch: up.fetch, now: NOW });
  const body = await r1.text();
  assert.equal(r1.status, 200); assert.equal(r1.headers.get('X-Signal-Cache'), 'miss');
  assert.match(up.calls[0], /key=tt-secret/);
  assert.ok(!body.includes('tt-secret') && ![...r1.headers.values()].join().includes('tt-secret'));
  assert.equal(JSON.parse(body).payload.flowSegmentData.currentSpeed, 50);
  const r2 = await handle(req(`tomtom/flow?corridor=${corridor}`, { ip: '198.51.100.9' }), liveEnv(kv), { fetch: up.fetch, now: NOW + 1000 });
  assert.equal(r2.headers.get('X-Signal-Cache'), 'hit');
  assert.equal(up.calls.length, 1, 'the second visitor costs nothing');
  assert.equal(kv.m.get('q:tomtom:m:2026-10'), '1');
});

test('worker: provider budget is a hard ceiling per day and per month', async () => {
  const kv = kvStore(), up = upstreamOk({ ok: true });
  const e = liveEnv(kv, { LIMIT_TOMTOM_DAY: '2', LIMIT_TOMTOM_MONTH: '3', LIMIT_CLIENT_DAY: '1000' });
  const hit = (id: string, now = NOW) => handle(req(`tomtom/flow?corridor=${id}`), e, { fetch: up.fetch, now });
  assert.equal((await hit(catalog.corridors[0].id)).status, 200);
  assert.equal((await hit(catalog.corridors[1].id)).status, 200);
  const third = await hit(catalog.corridors[2].id);
  assert.equal(third.status, 429); assert.deepEqual(await third.json(), { error: 'budget', scope: 'tomtom', reason: 'day' });
  assert.equal(up.calls.length, 2, 'the request over budget is not sent');
  assert.equal((await hit(catalog.corridors[2].id, NOW + 86400_000)).status, 200, 'next day');
  const month = await hit(catalog.corridors[3].id, NOW + 86400_000);
  assert.deepEqual(await month.json(), { error: 'budget', scope: 'tomtom', reason: 'month' });
  assert.equal(up.calls.length, 3);
});

test('worker: one client cannot drain the budget, and a BestTime forecast costs two credits', async () => {
  const kv = kvStore(), up = upstreamOk({ status: 'OK', analysis: [] });
  const e = liveEnv(kv, { LIMIT_CLIENT_DAY: '2' });
  const hit = (v: string, ip = '203.0.113.7') => handle(req(`besttime/forecast?venue=${v}`, { ip }), e, { fetch: up.fetch, now: NOW });
  assert.equal((await hit(catalog.venues[0].id)).status, 200);
  assert.equal((await hit(catalog.venues[1].id)).status, 200);
  const r = await hit(catalog.venues[2].id);
  assert.equal(r.status, 429); assert.equal((await r.json()).scope, 'client');
  assert.equal((await hit(catalog.venues[2].id, '198.51.100.1')).status, 200, 'another client is unaffected');
  assert.equal(kv.m.get('q:besttime:d:2026-10-13'), '6', 'three forecasts = six credits');
  assert.ok(![...kv.m.keys()].some((k) => k.includes('203.0.113.7')), 'no IP address is stored');
  assert.match(up.calls[0], /api_key_private=bt-secret/);
});

test('worker: upstream 429 and errors are reported without echoing upstream bodies', async () => {
  const kv = kvStore();
  let r = await handle(req(`tomtom/flow?corridor=${corridor}`), liveEnv(kv), { fetch: upstreamOk({ detailedError: 'key=tt-secret over quota' }, 429).fetch, now: NOW });
  assert.equal(r.status, 429); assert.equal(r.headers.get('Retry-After'), '77');
  assert.ok(!(await r.text()).includes('tt-secret'));
  kv.m.delete('cool:tomtom'); // each failure below is checked on its own, outside the cooldown of the previous one
  r = await handle(req(`tomtom/incidents?corridor=${corridor}`), liveEnv(kv), { fetch: upstreamOk({ secret: 'tt-secret' }, 500).fetch, now: NOW });
  assert.equal(r.status, 502); assert.ok(!(await r.text()).includes('tt-secret'));
  kv.m.delete('cool:tomtom');
  r = await handle(req(`tomtom/incidents?corridor=${catalog.corridors[1].id}`), liveEnv(kv), { fetch: async () => { throw new Error('boom tt-secret'); }, now: NOW });
  assert.equal(r.status, 502); assert.deepEqual(await r.json(), { error: 'upstream' });
});

test('worker: after a provider 429 or 5xx nobody calls it until the cooldown ends, and no budget is spent meanwhile', async () => {
  const kv = kvStore();
  let status = 429;
  const calls: string[] = [];
  const f = async (url: string) => { calls.push(url); return new Response('{}', { status, headers: status === 429 ? { 'Retry-After': '120' } : {} }); };
  const hit = (id: string, now: number, ip = '203.0.113.7') => handle(req(`tomtom/flow?corridor=${id}`, { ip }), liveEnv(kv), { fetch: f, now });
  let r = await hit(catalog.corridors[0].id, NOW);
  assert.equal(r.status, 429); assert.equal(r.headers.get('Retry-After'), '120');
  r = await hit(catalog.corridors[1].id, NOW + 1000, '198.51.100.4');
  assert.equal(r.status, 429); assert.equal((await r.json()).error, 'provider-quota');
  assert.equal(calls.length, 1, 'a second visitor does not reach the provider during the cooldown');
  assert.equal(kv.m.get('q:tomtom:d:2026-10-13'), '1', 'refusals during the cooldown cost nothing');
  status = 500;
  kv.m.delete('cool:tomtom');
  r = await hit(catalog.corridors[2].id, NOW + 2000);
  assert.equal(r.status, 502); assert.equal(r.headers.get('Retry-After'), String(COOLDOWN_S.error));
  r = await hit(catalog.corridors[3].id, NOW + 3000);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'provider-cooldown');
  assert.equal(calls.length, 2);
  status = 200;
  kv.m.delete('cool:tomtom'); // KV expires the key after its TTL; the test removes it by hand
  assert.equal((await hit(catalog.corridors[3].id, NOW + 61_000)).status, 200);
  assert.equal(calls.length, 3);
});

test('worker: Flightradar24 uses the sandbox unless switched, and the sandbox spends no budget', async () => {
  const kv = kvStore(), up = upstreamOk({ data: [] });
  const r = await handle(req('fr24/movements?day=2026-10-12'), liveEnv(kv), { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 200);
  assert.match(up.calls[0], /\/api\/sandbox\/flight-summary\/light/); assert.match(up.calls[0], /airports=both%3AMMSP/);
  assert.equal((await r.json()).sandbox, true);
  assert.equal(kv.m.get('q:fr24:m:2026-10'), undefined);
  assert.ok(!upstream('fr24/movements', new URLSearchParams({ day: '2026-10-12' }), { FR24_SANDBOX: 'false' }).url.includes('sandbox'));
});

test('worker: status reports modes and usage, never a secret', async () => {
  const kv = kvStore();
  const r = await handle(req('status'), liveEnv(kv, { LLM_API_KEY: 'llm-secret' }), { now: NOW });
  const text = await r.text(), j = JSON.parse(text);
  assert.equal(j.providers.tomtom.enabled, true); assert.equal(j.providers.tomtom.hasKey, true); assert.equal(j.providers.llm.mode, 'disabled');
  assert.deepEqual(j.providers.tomtom.limits, BUDGETS.tomtom);
  for (const s of ['tt-secret', 'bt-secret', 'fr-secret', 'llm-secret']) assert.ok(!text.includes(s));
});

// ------------------------------------------------------------------ planner --
const plan = (o: Record<string, unknown> = {}) => ({ session: 'abcdef123456', system: 'instrucciones', profile: { interests: ['agua'], duration: 'weekend', origin: 'Ciudad Valles' }, places: [{ id: 'H01', name: 'Cascada de Tamul', municipality: 'Aquismón' }], ...o });
const post = (body: unknown, ip?: string) => req('llm/plan', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), ip });

test('planner endpoint: disabled by default; mock mode calls no model', async () => {
  const up = upstreamOk({});
  let r = await handle(post(plan()), env({ BUDGET: kvStore() }), { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'llm-disabled');
  r = await handle(post(plan()), env({ LLM_MODE: 'mock', BUDGET: kvStore() }), { fetch: up.fetch, now: NOW });
  assert.deepEqual(await r.json(), { mode: 'mock', text: null });
  r = await handle(post(plan()), env({ LLM_MODE: 'live', BUDGET: kvStore() }), { fetch: up.fetch, now: NOW });
  assert.equal((await r.json()).error, 'llm-not-configured');
  assert.equal(up.calls.length, 0);
});

test('planner endpoint: rejects coordinates, personal data, unknown shapes and oversized bodies', async () => {
  assert.equal(validatePlanRequest(plan()), null);
  assert.equal(validatePlanRequest(plan({ places: [{ id: 'H01', name: 'x', latitude: 21.8 }] })), 'coordinates-not-accepted');
  assert.equal(validatePlanRequest(plan({ profile: { email: 'a@b.c' } })), 'personal-data-not-accepted');
  assert.equal(validatePlanRequest(plan({ profile: { gps: [1, 2] } })), 'personal-data-not-accepted');
  assert.equal(validatePlanRequest(plan({ places: [] })), 'places');
  assert.equal(validatePlanRequest(plan({ places: Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, name: 'x' })) })), 'places');
  assert.equal(validatePlanRequest(plan({ places: [{ id: 'bad id!', name: 'x' }] })), 'place.id');
  assert.equal(validatePlanRequest(plan({ session: 'x' })), 'session');
  const e = env({ LLM_MODE: 'live', LLM_API_KEY: 'k', LLM_MODEL: 'm', BUDGET: kvStore() });
  assert.equal((await handle(post('x'.repeat(LLM_LIMITS.maxBodyBytes + 1)), e, { now: NOW })).status, 413);
  assert.equal((await handle(post('{not json'), e, { now: NOW })).status, 400);
  assert.equal((await handle(req('llm/plan'), e, { now: NOW })).status, 405);
});

test('planner endpoint: per-session, per-client and total ceilings; the key stays in the worker', async () => {
  const kv = kvStore();
  const up = upstreamOk({ candidates: [{ content: { parts: [{ text: '{"tripTitle":"x"}' }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 300 } });
  const e = env({ LLM_MODE: 'live', LLM_PROVIDER: 'gemini', LLM_MODEL: 'gemini-test', LLM_API_KEY: 'llm-secret', LIMIT_LLM_DAY: '8', LIMIT_LLM_MONTH: '8', LIMIT_CLIENT_DAY: '7', BUDGET: kv });
  const first = await handle(post(plan()), e, { fetch: up.fetch, now: NOW });
  const text = await first.text();
  assert.equal(first.status, 200); assert.ok(!text.includes('llm-secret'));
  assert.deepEqual(JSON.parse(text).usage, { input: 900, output: 300 });
  assert.ok(!up.calls[0].includes('llm-secret'), 'the key travels in a header, not in the URL');
  for (let i = 1; i < LLM_LIMITS.perSessionDay; i++) assert.equal((await handle(post(plan()), e, { fetch: up.fetch, now: NOW })).status, 200);
  let r = await handle(post(plan()), e, { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 429); assert.equal((await r.json()).scope, 'session', 'repeated clicks in one session stop here');
  r = await handle(post(plan({ session: 'othersession1' })), e, { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 200);
  r = await handle(post(plan({ session: 'othersession2' })), e, { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 429); assert.equal((await r.json()).scope, 'client', 'new session ids from one client stop here');
  r = await handle(post(plan({ session: 'othersession3' }), '198.51.100.2'), e, { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 200);
  r = await handle(post(plan({ session: 'othersession4' }), '198.51.100.3'), e, { fetch: up.fetch, now: NOW });
  assert.equal(r.status, 429); assert.equal((await r.json()).scope, 'llm', 'the total budget is the last wall');
  assert.equal(up.calls.length, 8);
});

test('budget helper: fails closed without a store', async () => {
  assert.deepEqual(await spend(null, 'x', { day: 1, month: 1 }, NOW), { ok: false, reason: 'no-budget-store' });
});
