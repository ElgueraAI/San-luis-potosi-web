/**
 * Minimal key-holding proxy for openrouteservice (HeiGIT), as a Cloudflare
 * Worker (any serverless runtime with fetch() works the same way).
 *
 *   browser ──POST /v2/directions/{profile}/geojson──▶ this worker ──(+ Authorization: ORS_API_KEY)──▶ api.heigit.org/openrouteservice
 *
 * Why: the portal is a static GitHub Pages site, so a key in browser code is
 * public; HeiGIT asks that keys are not used client-side.
 *
 * Secrets / vars (set in the Cloudflare dashboard or with `wrangler secret put`):
 *   ORS_API_KEY      secret, from https://account.heigit.org/
 *   ALLOWED_ORIGINS  comma-separated, e.g. "https://<user>.github.io,http://localhost:4321"
 *
 * Only the two endpoints the site uses are forwarded, only POST, only small
 * JSON bodies. Rate-limit headers are passed back so the client can explain
 * a 429/403 honestly.
 */
const UPSTREAM = 'https://api.heigit.org/openrouteservice';
const ALLOWED_PATH = /^\/v2\/(directions\/(driving-car|foot-walking|cycling-regular)\/geojson|matrix\/(driving-car|foot-walking|cycling-regular))$/;
const MAX_BODY = 32 * 1024;
const PASS_HEADERS = ['x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-limit', 'retry-after', 'content-type'];

function cors(origin, allowed) {
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Expose-Headers': 'x-ratelimit-remaining, x-ratelimit-reset, retry-after',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    const allowed = String(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    const h = cors(origin, allowed);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (!origin || !allowed.includes(origin)) return json(403, { error: { code: 0, message: 'origin not allowed' } }, h);
    if (request.method !== 'POST') return json(405, { error: { code: 0, message: 'method not allowed' } }, h);
    if (!env.ORS_API_KEY) return json(503, { error: { code: 0, message: 'proxy without key' } }, h);

    const path = new URL(request.url).pathname.replace(/\/$/, '');
    if (!ALLOWED_PATH.test(path)) return json(404, { error: { code: 0, message: 'endpoint not proxied' } }, h);
    const body = await request.text();
    if (body.length > MAX_BODY) return json(413, { error: { code: 0, message: 'request too large' } }, h);

    const res = await fetch(UPSTREAM + path, {
      method: 'POST',
      headers: { Authorization: env.ORS_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json, application/geo+json' },
      body,
    });
    const out = new Headers(h);
    for (const k of PASS_HEADERS) { const v = res.headers.get(k); if (v) out.set(k, v); }
    return new Response(res.body, { status: res.status, headers: out });
  },
};
