/**
 * Key-holding proxy for the external tourism signals and the planner's LLM, as
 * a Cloudflare Worker. NOT deployed: deploying it, creating provider accounts
 * and setting secrets are decisions of the project owner (README.md here).
 *
 *   browser ──GET /v1/tomtom/flow?corridor=acceso-xilitla──▶ worker ──(+ key)──▶ api.tomtom.com
 *
 * The static site (GitHub Pages) cannot hold a secret, so every keyed call
 * goes through here. What this worker enforces, in this order:
 *
 *   1. origin allow-list (CORS is not a security boundary: a script can send any
 *      Origin, so steps 2–6 do the real work)
 *   2. route allow-list: only the endpoints below, GET (POST for the planner)
 *   3. parameter allow-list: venues, corridors and the airport come from
 *      catalog.json; the browser sends an id, never a free address or coordinate
 *   4. kill switch per provider (SIGNALS_ENABLED) and LLM_MODE, both off by default
 *   5. budgets counted in KV: per provider per day and per month, and per client
 *      per day. No KV binding → every live call is refused (fail closed)
 *   6. response cache in KV with a TTL per endpoint, so repeated views cost nothing
 *
 * Nothing is logged with coordinates or free text. Errors never echo upstream
 * bodies, which could contain the key in a URL.
 *
 * Vars / secrets:
 *   ALLOWED_ORIGINS           "https://elgueraai.github.io,http://localhost:4321"
 *   SIGNALS_ENABLED           "" (default) | "tomtom" | "besttime,tomtom,fr24"
 *   BESTTIME_API_KEY_PRIVATE  secret
 *   TOMTOM_API_KEY            secret
 *   FR24_API_TOKEN            secret (sandbox token while FR24_SANDBOX is "true")
 *   FR24_SANDBOX              "true" (default) | "false"
 *   LLM_MODE                  "disabled" (default) | "mock" | "live"
 *   LLM_PROVIDER              "gemini" | "anthropic" | "openai"
 *   LLM_MODEL                 model id for that provider
 *   LLM_API_KEY               secret
 *   LIMIT_<PROVIDER>_DAY / LIMIT_<PROVIDER>_MONTH   integers; defaults in BUDGETS
 *   LIMIT_CLIENT_DAY          requests one client may cause per day (default 40)
 *   BUDGET                    KV namespace binding (counters and cache)
 */
import catalog from './catalog.json';

export const BUDGETS = {
  // conservative defaults, far below every free allowance read on 2026-10-13
  besttime: { day: 20, month: 100 },   // credits; trial credits are limited and unstated
  tomtom: { day: 300, month: 2000 },   // free: 20,000 flow + 2,500 incident requests per month
  fr24: { day: 20, month: 200 },       // sandbox costs no credits; kept low for when it is switched to live
  llm: { day: 60, month: 600 },        // requests
};
export const TTL_S = { 'besttime/forecast': 7 * 86400, 'besttime/live': 900, 'tomtom/flow': 300, 'tomtom/incidents': 600, 'fr24/movements': 3600 };
export const LLM_LIMITS = { maxBodyBytes: 12_000, maxOutputTokens: 900, perSessionDay: 6 };
/** Server-side breaker: after a provider 429 (its Retry-After) or 5xx (60 s, the KV minimum), nobody calls it. */
export const COOLDOWN_S = { error: 60, quotaDefault: 900, max: 6 * 3600 };

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(body?.error ? { 'X-Signal-Error': body.error } : {}), ...headers } });
const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const int = (v, d) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };

export function cors(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    // Retry-After and the error code are not CORS-safelisted: without this the browser cannot read them
    'Access-Control-Expose-Headers': 'Retry-After, X-Signal-Error, X-Signal-Cache',
    Vary: 'Origin',
  };
}

/** Day and month buckets in UTC. */
export const buckets = (now) => { const d = new Date(now).toISOString(); return { day: d.slice(0, 10), month: d.slice(0, 7) }; };

/**
 * Budget check and spend. KV is not transactional: two simultaneous requests
 * can both pass the check, so a limit can be exceeded by the number of
 * concurrent requests. The defaults leave that margin; an exact ceiling needs
 * a Durable Object and is listed as future work.
 */
export async function spend(kv, scope, limits, now, cost = 1) {
  if (!kv) return { ok: false, reason: 'no-budget-store' };
  const b = buckets(now), dk = `q:${scope}:d:${b.day}`, mk = `q:${scope}:m:${b.month}`;
  const [d, m] = (await Promise.all([kv.get(dk), kv.get(mk)])).map((v) => int(v, 0));
  if (d + cost > limits.day) return { ok: false, reason: 'day', used: d, limit: limits.day };
  if (m + cost > limits.month) return { ok: false, reason: 'month', used: m, limit: limits.month };
  await Promise.all([kv.put(dk, String(d + cost), { expirationTtl: 2 * 86400 }), kv.put(mk, String(m + cost), { expirationTtl: 40 * 86400 })]);
  return { ok: true, usedDay: d + cost, usedMonth: m + cost };
}
export async function usage(kv, scope, now) {
  if (!kv) return { day: null, month: null };
  const b = buckets(now);
  const [d, m] = await Promise.all([kv.get(`q:${scope}:d:${b.day}`), kv.get(`q:${scope}:m:${b.month}`)]);
  return { day: int(d, 0), month: int(m, 0) };
}
const limitsFor = (env, p) => ({ day: int(env[`LIMIT_${p.toUpperCase()}_DAY`], BUDGETS[p].day), month: int(env[`LIMIT_${p.toUpperCase()}_MONTH`], BUDGETS[p].month) });

/** A stable, non-reversible client bucket: no IP address is stored. */
export async function clientBucket(request, now) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const data = new TextEncoder().encode(`${ip}|${buckets(now).day}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ---- upstream requests: built only from the catalogue -------------------------------------
export function upstream(route, params, env) {
  const venue = catalog.venues.find((v) => v.id === params.get('venue'));
  const corridor = catalog.corridors.find((c) => c.id === params.get('corridor'));
  switch (route) {
    case 'besttime/forecast':
      if (!venue) return null;
      return { provider: 'besttime', cost: 2, cacheKey: `besttime/forecast:${venue.id}`, url: `https://besttime.app/api/v1/forecasts?${new URLSearchParams({ api_key_private: env.BESTTIME_API_KEY_PRIVATE ?? '', venue_name: venue.name, venue_address: venue.address })}`, init: { method: 'POST' } };
    case 'besttime/live':
      if (!venue) return null;
      return { provider: 'besttime', cost: 1, cacheKey: `besttime/live:${venue.id}`, url: `https://besttime.app/api/v1/forecasts/live?${new URLSearchParams({ api_key_private: env.BESTTIME_API_KEY_PRIVATE ?? '', venue_name: venue.name, venue_address: venue.address })}`, init: { method: 'POST' } };
    case 'tomtom/flow':
      if (!corridor) return null;
      return { provider: 'tomtom', cost: 1, cacheKey: `tomtom/flow:${corridor.id}`, url: `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?${new URLSearchParams({ key: env.TOMTOM_API_KEY ?? '', point: `${corridor.point[1]},${corridor.point[0]}`, unit: 'KMPH' })}`, init: { method: 'GET' } };
    case 'tomtom/incidents':
      if (!corridor) return null;
      return { provider: 'tomtom', cost: 1, cacheKey: `tomtom/incidents:${corridor.id}`, url: `https://api.tomtom.com/traffic/services/5/incidentDetails?${new URLSearchParams({ key: env.TOMTOM_API_KEY ?? '', bbox: corridor.bbox.join(','), language: 'es-ES', timeValidityFilter: 'present', fields: '{incidents{type,properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers,lastReportTime,probabilityOfOccurrence}}}' })}`, init: { method: 'GET' } };
    case 'fr24/movements': {
      const sandbox = String(env.FR24_SANDBOX ?? 'true') !== 'false';
      const base = `https://fr24api.flightradar24.com/api${sandbox ? '/sandbox' : ''}`;
      const day = params.get('day');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) return null;
      return { provider: 'fr24', cost: sandbox ? 0 : 1, sandbox, cacheKey: `fr24/movements:${sandbox ? 's' : 'l'}:${day}`, url: `${base}/flight-summary/light?${new URLSearchParams({ flight_datetime_from: `${day}T00:00:00`, flight_datetime_to: `${day}T23:59:59`, airports: `both:${catalog.airport.icao}`, limit: '200' })}`, init: { method: 'GET', headers: { Authorization: `Bearer ${env.FR24_API_TOKEN ?? ''}`, 'Accept-Version': 'v1', Accept: 'application/json' } } };
    }
    default: return null;
  }
}
const KEY_OF = { besttime: 'BESTTIME_API_KEY_PRIVATE', tomtom: 'TOMTOM_API_KEY', fr24: 'FR24_API_TOKEN' };

// ---- planner: the model only words a selection the site already made -----------------------
export function validatePlanRequest(body) {
  if (!body || typeof body !== 'object') return 'body';
  const { places, profile, session } = body;
  if (typeof session !== 'string' || !/^[a-z0-9]{8,32}$/.test(session)) return 'session';
  if (!Array.isArray(places) || places.length < 1 || places.length > 12) return 'places';
  for (const p of places) {
    if (!p || typeof p.id !== 'string' || !/^[\w-]{1,40}$/.test(p.id)) return 'place.id';
    if (typeof p.name !== 'string' || p.name.length > 120) return 'place.name';
    for (const k of Object.keys(p)) if (/lat|lon|coord|gps/i.test(k)) return 'coordinates-not-accepted';
  }
  if (!profile || typeof profile !== 'object') return 'profile';
  for (const k of Object.keys(profile)) if (/lat|lon|coord|gps|name|email|phone|address/i.test(k)) return 'personal-data-not-accepted';
  return null;
}

async function callLlm(env, body, fetchImpl) {
  const provider = env.LLM_PROVIDER ?? 'gemini', model = env.LLM_MODEL ?? '';
  const system = body.system, user = JSON.stringify({ profile: body.profile, places: body.places, context: body.context ?? null });
  if (provider === 'gemini') {
    const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.LLM_API_KEY }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: LLM_LIMITS.maxOutputTokens, temperature: 0.4 } }) });
    if (!r.ok) return { status: r.status };
    const j = await r.json();
    return { status: 200, text: j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '', usage: { input: j?.usageMetadata?.promptTokenCount ?? null, output: j?.usageMetadata?.candidatesTokenCount ?? null } };
  }
  if (provider === 'anthropic') {
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.LLM_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: LLM_LIMITS.maxOutputTokens, system, messages: [{ role: 'user', content: user }] }) });
    if (!r.ok) return { status: r.status };
    const j = await r.json();
    return { status: 200, text: j?.content?.[0]?.text ?? '', usage: { input: j?.usage?.input_tokens ?? null, output: j?.usage?.output_tokens ?? null } };
  }
  if (provider === 'openai') {
    const r = await fetchImpl('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_API_KEY}` }, body: JSON.stringify({ model, max_completion_tokens: LLM_LIMITS.maxOutputTokens, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!r.ok) return { status: r.status };
    const j = await r.json();
    return { status: 200, text: j?.choices?.[0]?.message?.content ?? '', usage: { input: j?.usage?.prompt_tokens ?? null, output: j?.usage?.completion_tokens ?? null } };
  }
  return { status: 501 };
}

/** The whole worker as a function of its inputs, so tests can run it in node. */
export async function handle(request, env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch, now = deps.now ?? Date.now();
  const allowed = list(env.ALLOWED_ORIGINS), origin = request.headers.get('Origin');
  const h = cors(origin, allowed);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (!origin || !allowed.includes(origin)) return json(403, { error: 'origin' }, h);
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/v1\//, '').replace(/\/$/, '');
  const enabled = list(env.SIGNALS_ENABLED);
  const kv = env.BUDGET ?? null;

  if (route === 'status' && request.method === 'GET') {
    const out = {};
    for (const p of ['besttime', 'tomtom', 'fr24']) out[p] = { enabled: enabled.includes(p), hasKey: !!env[KEY_OF[p]], limits: limitsFor(env, p), used: await usage(kv, p, now), ...(p === 'fr24' ? { sandbox: String(env.FR24_SANDBOX ?? 'true') !== 'false' } : {}) };
    out.llm = { mode: env.LLM_MODE ?? 'disabled', provider: env.LLM_PROVIDER ?? null, model: env.LLM_MODEL ?? null, limits: limitsFor(env, 'llm'), used: await usage(kv, 'llm', now) };
    return json(200, { budgetStore: !!kv, providers: out }, h);
  }

  if (route === 'llm/plan') {
    if (request.method !== 'POST') return json(405, { error: 'method' }, h);
    const mode = env.LLM_MODE ?? 'disabled';
    if (mode === 'disabled') return json(503, { error: 'llm-disabled' }, h);
    const raw = await request.text();
    if (raw.length > LLM_LIMITS.maxBodyBytes) return json(413, { error: 'too-large' }, h);
    let body; try { body = JSON.parse(raw); } catch { return json(400, { error: 'json' }, h); }
    const bad = validatePlanRequest(body);
    if (bad) return json(400, { error: 'invalid', field: bad }, h);
    if (mode === 'mock') return json(200, { mode: 'mock', text: null }, h);
    if (!env.LLM_API_KEY || !env.LLM_MODEL) return json(503, { error: 'llm-not-configured' }, h);
    const perSession = await spend(kv, `llm:s:${body.session}`, { day: LLM_LIMITS.perSessionDay, month: LLM_LIMITS.perSessionDay * 31 }, now);
    if (!perSession.ok) return json(429, { error: 'budget', scope: 'session', reason: perSession.reason }, h);
    const perClient = await spend(kv, `c:${await clientBucket(request, now)}`, { day: int(env.LIMIT_CLIENT_DAY, 40), month: int(env.LIMIT_CLIENT_DAY, 40) * 31 }, now);
    if (!perClient.ok) return json(429, { error: 'budget', scope: 'client', reason: perClient.reason }, h);
    const total = await spend(kv, 'llm', limitsFor(env, 'llm'), now);
    if (!total.ok) return json(429, { error: 'budget', scope: 'llm', reason: total.reason }, h);
    let res; try { res = await callLlm(env, body, fetchImpl); } catch { return json(502, { error: 'upstream' }, h); }
    if (res.status !== 200) return json(res.status === 429 ? 429 : 502, { error: res.status === 429 ? 'provider-quota' : 'upstream' }, h);
    return json(200, { mode: 'live', provider: env.LLM_PROVIDER ?? 'gemini', model: env.LLM_MODEL, text: res.text, usage: res.usage }, h);
  }

  if (request.method !== 'GET') return json(405, { error: 'method' }, h);
  const up = upstream(route, url.searchParams, env);
  if (!up) return json(404, { error: 'not-proxied' }, h);
  if (!enabled.includes(up.provider)) return json(503, { error: 'provider-disabled', provider: up.provider }, h);
  if (!env[KEY_OF[up.provider]]) return json(503, { error: 'provider-not-configured', provider: up.provider }, h);
  if (!kv) return json(503, { error: 'no-budget-store' }, h);

  const cached = await kv.get(`r:${up.cacheKey}`);
  if (cached) return new Response(cached, { status: 200, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8', 'X-Signal-Cache': 'hit' } });
  const cooling = await kv.get(`cool:${up.provider}`);
  if (cooling) {
    const [reason, until] = cooling.split('|');
    const wait = String(Math.max(1, Math.ceil((Number(until) - now) / 1000)));
    return json(reason === 'quota' ? 429 : 503, { error: reason === 'quota' ? 'provider-quota' : 'provider-cooldown', provider: up.provider }, { ...h, 'Retry-After': wait });
  }
  const cool = async (reason, seconds) => {
    const s = Math.min(COOLDOWN_S.max, Math.max(60, seconds));
    await kv.put(`cool:${up.provider}`, `${reason}|${now + s * 1000}`, { expirationTtl: s });
    return String(s);
  };

  const perClient = await spend(kv, `c:${await clientBucket(request, now)}`, { day: int(env.LIMIT_CLIENT_DAY, 40), month: int(env.LIMIT_CLIENT_DAY, 40) * 31 }, now);
  if (!perClient.ok) return json(429, { error: 'budget', scope: 'client', reason: perClient.reason }, { ...h, 'Retry-After': '3600' });
  if (up.cost > 0) {
    const s = await spend(kv, up.provider, limitsFor(env, up.provider), now, up.cost);
    if (!s.ok) return json(429, { error: 'budget', scope: up.provider, reason: s.reason }, { ...h, 'Retry-After': '3600' });
  }
  let res;
  try { res = await fetchImpl(up.url, up.init); } catch { return json(502, { error: 'upstream' }, { ...h, 'Retry-After': await cool('error', COOLDOWN_S.error) }); }
  if (res.status === 429) return json(429, { error: 'provider-quota', provider: up.provider }, { ...h, 'Retry-After': await cool('quota', int(res.headers.get('Retry-After'), COOLDOWN_S.quotaDefault)) });
  if (res.status >= 500) return json(502, { error: 'upstream', status: res.status }, { ...h, 'Retry-After': await cool('error', COOLDOWN_S.error) });
  if (!res.ok) return json(502, { error: 'upstream', status: res.status }, h);
  let payload; try { payload = await res.json(); } catch { return json(502, { error: 'upstream-format' }, h); }
  const body = JSON.stringify({ provider: up.provider, sandbox: up.sandbox ?? false, retrievedAt: new Date(now).toISOString(), payload });
  await kv.put(`r:${up.cacheKey}`, body, { expirationTtl: Math.max(60, TTL_S[route]) });
  return new Response(body, { status: 200, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8', 'X-Signal-Cache': 'miss' } });
}

export default { fetch: (request, env) => handle(request, env) };
