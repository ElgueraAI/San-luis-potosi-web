// Browser checks for /inteligencia-turistica/senales/ and the signals proxy.
//
//   mock build (default):  npm run build && npx astro preview --port 4321
//                          node scripts/verify/signals.mjs --expect mock
//   live build (proxy):    PUBLIC_SIGNALS_BESTTIME=live PUBLIC_SIGNALS_TOMTOM=live PUBLIC_SIGNALS_FR24=live \
//                          PUBLIC_SIGNALS_PROXY_URL=http://127.0.0.1:8787 npm run build   (then preview)
//                          node scripts/verify/signals.mjs --expect live
//
// In live mode this script runs the REAL worker (serverless/signals-proxy/worker.js)
// on 127.0.0.1:8787 with an in-memory KV and FAKE keys, and answers its upstream
// calls itself with payloads in each provider's documented shape. No external
// service is contacted and no credit is spent: "live" here means "through the
// proxy", not "real data". Never ship a build made with the live variables above.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const EXPECT = arg('--expect', 'mock');
const PROXY_PORT = 8787;
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
const FAKE = { TOMTOM_API_KEY: 'FAKE-TOMTOM-KEY', BESTTIME_API_KEY_PRIVATE: 'FAKE-BESTTIME-KEY', FR24_API_TOKEN: 'FAKE-FR24-TOKEN' };
const PROVIDER_HOSTS = /besttime\.app|api\.tomtom\.com|fr24api\.flightradar24\.com|generativelanguage|api\.anthropic|api\.openai/;

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = [], requests = [], pending = new Set();
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('request', (r) => { requests.push(r.url()); pending.add(r); });
  p.on('requestfinished', (r) => pending.delete(r));
  p.on('requestfailed', (r) => pending.delete(r));
  p.pending = pending;
  return { ctx, p, errs, requests };
};
const open = async (p) => {
  try {
    await p.goto(`${BASE}/inteligencia-turistica/senales/`, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) {
    console.log(`  pending requests: ${[...p.pending].map((r) => r.url()).join(' | ') || 'none'}`);
    console.log(`  last proxy answers:\n    ${(globalThis.__serverLog ?? []).slice(-8).join('\n    ')}`);
    throw e;
  }
  await p.waitForSelector('[data-sgl-venue-out]:not([aria-busy])'); await p.waitForTimeout(300);
};
const text = async (p, s) => ((await p.textContent(s)) ?? '').replace(/\s+/g, ' ').trim();

// ======================================================================== mock ==
if (EXPECT === 'mock') {
  const { ctx, p, errs, requests } = await page();
  await open(p);
  const modes = await p.$$eval('[data-sgl-mode]', (els) => els.map((e) => [e.dataset.sglMode, e.textContent]));
  ok('mock: keyed providers are declared simulated, Open-Meteo active', modes.filter(([id]) => id !== 'open-meteo').every(([, t]) => /Solo simulada/.test(t)) && /consulta directa desde el navegador, sin clave ni servicio intermedio/.test(modes.find(([id]) => id === 'open-meteo')[1]), JSON.stringify(modes));
  ok('mock: the proxy is reported as not configured', /No configurado/.test(await text(p, '[data-sgl-proxy]')));
  const venues = await p.$$eval('[data-sgl-venue] option', (o) => o.map((x) => x.textContent));
  ok('mock: only example venues are offered, never a real museum', venues.length === 3 && venues.every((v) => /de ejemplo/.test(v)), venues.join(' | '));
  ok('mock: the busyness chart carries the simulation label', /Datos simulados para demostración académica/.test(await text(p, '[data-sgl-venue-out]')));
  ok('mock: 24 hourly bars, relative unit stated', (await p.$$eval('.sgl__h', (e) => e.length)) === 24 && /máximo semanal del propio establecimiento/.test(await text(p, '[data-sgl-venue-out]')));
  await p.selectOption('[data-sgl-venue]', 'demo-recinto-sin-datos');
  await p.waitForTimeout(300);
  ok('mock: a venue without coverage shows the no-data message, no chart', /Sin información de concurrencia para este establecimiento/.test(await text(p, '[data-sgl-venue-out]')) && (await p.$$eval('.sgl__h', (e) => e.length)) === 0);
  await p.click('[data-sgl-roads-load]');
  await p.waitForSelector('.sgl__road');
  const roads = await p.$$eval('.sgl__road', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
  ok('mock: three example corridors, each labelled simulated', roads.length === 3 && roads.every((r) => /Datos simulados/.test(r) && /de ejemplo/.test(r)));
  ok('mock: the closed example road reads «Cerrado» and its incident is listed', /Cerrado/.test(roads[2]) && /Camino cerrado/.test(roads[2]));
  await p.click('[data-sgl-air-load]');
  await p.waitForTimeout(300);
  const air = await text(p, '[data-sgl-air]');
  ok('mock: flights are counted as flights and the sample is labelled', /Llegadas en la respuesta\s*3/.test(air) && /Salidas en la respuesta\s*2/.test(air) && /no son pasajeros ni turistas/.test(air) && /no corresponde a ningún aeropuerto/.test(air));
  ok('mock: no request leaves for a provider or a proxy', !requests.some((u) => PROVIDER_HOSTS.test(u) || u.includes(':8787')), requests.filter((u) => PROVIDER_HOSTS.test(u)).join(' '));
  ok('mock: no quota is counted in the browser', /0 · no se hacen solicitudes/.test(await text(p, '[data-sgl-used="tomtom"]')));
  ok('mock: no console errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

// ======================================================================== live ==
if (EXPECT === 'live') {
  // bundle and import the real worker (it imports catalog.json)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slp-worker-'));
  await build({ entryPoints: [path.resolve('serverless/signals-proxy/worker.js')], bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'w.mjs'), logLevel: 'warning' });
  const worker = await import(pathToFileURL(path.join(dir, 'w.mjs')).href);
  const catalog = JSON.parse(fs.readFileSync('serverless/signals-proxy/catalog.json', 'utf8'));

  // fake upstream, controlled per provider: ok | error | 429
  const upstreamMode = { besttime: 'ok', tomtom: 'ok', fr24: 'ok' };
  const upstreamCalls = [];
  const day = (i) => Array.from({ length: 24 }, (_, h) => { const hour = (6 + h) % 24; return hour < 9 || hour > 18 ? 0 : Math.round(100 * Math.exp(-((hour - 12) ** 2) / 8) * (i >= 5 ? 1 : 0.7)); });
  const fakeFetch = async (url) => {
    const u = String(url);
    upstreamCalls.push(u);
    const provider = u.includes('besttime') ? 'besttime' : u.includes('tomtom') ? 'tomtom' : 'fr24';
    const mode = upstreamMode[provider];
    if (mode === '429') return new Response('{"error":"quota"}', { status: 429, headers: { 'Retry-After': '120' } });
    if (mode === 'error') return new Response('{"error":"internal"}', { status: 500 });
    let body;
    if (u.includes('/forecasts/live')) body = { status: 'OK', analysis: { venue_live_busyness: 48, venue_live_busyness_available: true, venue_forecasted_busyness: 60, venue_live_forecasted_delta: -12, hour_start: 13 }, venue_info: { venue_id: 'ven_x' } };
    else if (u.includes('/forecasts')) body = { status: 'OK', epoch_analysis: 1760000000, venue_info: { venue_id: 'ven_x' }, analysis: Array.from({ length: 7 }, (_, i) => ({ day_info: { day_int: i }, day_raw: day(i) })) };
    else if (u.includes('flowSegmentData')) body = { flowSegmentData: { frc: 'FRC1', currentSpeed: 52, freeFlowSpeed: 80, confidence: 0.82, roadClosure: false } };
    else if (u.includes('incidentDetails')) body = { incidents: [] };
    else body = { data: [{ orig_icao: 'MMMX', dest_icao: 'MMSP' }, { orig_icao: 'MMSP', dest_icao: 'KDFW' }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const store = new Map();
  const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) };
  const env = { ALLOWED_ORIGINS: BASE, SIGNALS_ENABLED: 'besttime,tomtom,fr24', BUDGET: kv, LIMIT_CLIENT_DAY: '500', LIMIT_TOMTOM_DAY: '14', ...FAKE };
  const proxyCalls = [], serverLog = [];
  globalThis.__serverLog = serverLog;
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(`http://127.0.0.1:${PROXY_PORT}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    proxyCalls.push(`${req.method} ${req.url}`);
    const t0 = Date.now();
    res.on('finish', () => serverLog.push(`${req.method} ${req.url} -> ${res.statusCode} in ${Date.now() - t0} ms`));
    try {
      const out = await worker.handle(request, env, { fetch: fakeFetch });
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
    } catch (e) {
      console.log(`HARNESS: worker threw on ${req.method} ${req.url}: ${e?.stack ?? e}`);
      res.writeHead(500); res.end('{"error":"harness"}');
    }
  });
  await new Promise((r) => server.listen(PROXY_PORT, '127.0.0.1', r));

  const bodies = [];
  const { ctx, p, errs } = await page();
  p.on('response', async (r) => { if (r.url().includes(':8787')) bodies.push(await r.text().catch(() => '')); });
  await open(p);
  const modes = await p.$$eval('[data-sgl-mode]', (els) => els.map((e) => e.textContent));
  ok('live: keyed providers report «Activa a través del servicio intermedio»', modes.filter((t) => /^Activa a través del servicio intermedio$/.test(t)).length === 3, modes.join(' | '));
  const venues = await p.$$eval('[data-sgl-venue] option', (o) => o.map((x) => x.value));
  ok('live: the venue list is the proxy catalogue (official SIC museums)', venues.length === catalog.venues.length && venues.every((v) => catalog.venues.some((c) => c.id === v)));
  const out = await text(p, '[data-sgl-venue-out]');
  ok('live: a forecast through the proxy is labelled «Previsión», not simulated', /Previsión/.test(out) && !/Datos simulados/.test(out) && (await p.$$eval('.sgl__h', (e) => e.length)) === 24, out.slice(0, 120));
  ok('live: the observed-now value and its gap to the forecast are shown', /48 % observado · 60 % previsto \(-12\)/.test(out));
  ok('live: the browser sends ids only; addresses and keys are added by the proxy', proxyCalls.every((c) => !/address|point=|bbox=|key=/i.test(c)) && upstreamCalls.some((u) => u.includes('FAKE-BESTTIME-KEY')), proxyCalls.slice(0, 2).join(' '));
  const before = upstreamCalls.length;
  await p.selectOption('[data-sgl-day]', '5');
  await p.waitForTimeout(300);
  ok('live: changing the day reuses the cached forecast (no new request)', upstreamCalls.length === before);

  await p.click('[data-sgl-roads-load]');
  await p.waitForSelector('.sgl__road');
  const roads = await p.$$eval('.sgl__road', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
  ok('live: six corridors from the catalogue, flow labelled «En vivo»', roads.length === catalog.corridors.length && roads.every((r) => /En vivo/.test(r) && /52 km\/h/.test(r) && /65 % de la velocidad de flujo libre/.test(r)), roads[0]?.slice(0, 140));
  ok('live: the provider confidence is shown as reported', roads.every((r) => /confianza del proveedor 0.82/.test(r)));
  ok('live: no incidents reported is said as such', roads.every((r) => /Sin incidentes reportados/.test(r)));

  await p.click('[data-sgl-air-load]');
  await p.waitForTimeout(400);
  const air = await text(p, '[data-sgl-air]');
  ok('live: Flightradar24 goes to the sandbox and is still labelled simulated', /Datos simulados/.test(air) && /entorno de pruebas/.test(air) && upstreamCalls.some((u) => u.includes('/api/sandbox/')), air.slice(0, 160));
  ok('live: no key reaches the browser in any proxy response', bodies.length > 0 && bodies.every((b) => !Object.values(FAKE).some((k) => b.includes(k))));
  ok('live: the browser never calls a provider directly', !(await p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name))).some((u) => /besttime\.app|api\.tomtom|fr24api/.test(u)));
  ok('live: browser-side usage is counted', /de 60 en este navegador/.test(await text(p, '[data-sgl-used="besttime"]')));
  ok('live: no console errors on the happy path', errs.length === 0, errs.join(' | '));
  await ctx.close();

  // ---- failures: each one is shown as such, the page keeps working ----------------------
  {
    store.clear(); upstreamMode.tomtom = 'error';
    const { ctx, p } = await page();
    await open(p);
    const n0 = upstreamCalls.length;
    await p.click('[data-sgl-roads-load]');
    await p.waitForSelector('.sgl__road');
    const roads = await p.$$eval('.sgl__road', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
    ok('error: an upstream 500 reads «El proveedor no respondió», nothing invented', roads.length === 6 && roads.every((r) => /no respondió|pausaron las consultas/.test(r) && !/km\/h/.test(r)), JSON.stringify(roads));
    const errCalls = upstreamCalls.slice(n0).filter((u) => u.includes('tomtom')).length;
    ok('error: a failing provider is called at most twice for the whole module', errCalls <= 2, `${errCalls} upstream calls`);
    ok('error: the rest of the page still works (busyness chart intact)', (await p.$$eval('.sgl__h', (e) => e.length)) === 24);
    await ctx.close();
  }
  {
    store.clear(); upstreamMode.tomtom = '429';
    const { ctx, p } = await page();
    await open(p);
    const n = upstreamCalls.length;
    await p.click('[data-sgl-roads-load]');
    await p.waitForSelector('.sgl__road');
    const roads = await p.$$eval('.sgl__road', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
    ok('429: the provider quota message is shown', roads.every((r) => /límite de consultas|pausaron las consultas/.test(r)), roads[0]);
    const tomtomCalls = upstreamCalls.slice(n).filter((u) => u.includes('tomtom')).length;
    ok('429: the browser stops after the first refusal instead of hammering the proxy', tomtomCalls <= 2, `${tomtomCalls} upstream calls`);
    await ctx.close();
  }
  {
    store.clear(); upstreamMode.tomtom = 'ok';
    const { ctx, p } = await page();
    await open(p);
    await p.click('[data-sgl-roads-load]');
    await p.waitForSelector('.sgl__road');
    await ctx.close();
    // a second visitor, new browser: the proxy cache answers, no upstream call
    const n = upstreamCalls.length;
    const v2 = await page();
    await open(v2.p);
    await v2.p.click('[data-sgl-roads-load]');
    await v2.p.waitForSelector('.sgl__road');
    ok('cache: a second visitor is served from the proxy cache', upstreamCalls.slice(n).filter((u) => u.includes('tomtom')).length === 0);
    await v2.ctx.close();
    // the provider budget (LIMIT_TOMTOM_DAY=14) is now spent: 12 calls above + earlier ones
    const used = Number(store.get(`q:tomtom:d:${new Date().toISOString().slice(0, 10)}`) ?? 0);
    ok('budget: the proxy counted every upstream call against the daily ceiling', used >= 12 && used <= 14, `${used} of 14`);
  }
  {
    store.forEach((_, k) => { if (k.startsWith('r:')) store.delete(k); }); // drop the cache, keep the counters
    const today = new Date().toISOString().slice(0, 10);
    store.set(`q:tomtom:d:${today}`, '14');
    const { ctx, p } = await page();
    await open(p);
    const n = upstreamCalls.length;
    await p.click('[data-sgl-roads-load]');
    await p.waitForSelector('.sgl__road');
    const roads = await p.$$eval('.sgl__road', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ')));
    ok('budget: over the ceiling the proxy refuses and nothing reaches the provider', upstreamCalls.length === n && roads.every((r) => /límite de consultas|pausaron/.test(r)), roads[0]);
    await ctx.close();
  }
  {
    env.SIGNALS_ENABLED = 'tomtom,fr24'; // BestTime switched off in the proxy
    const nBt = proxyCalls.filter((c) => c.includes('besttime')).length;
    const { ctx, p } = await page();
    await open(p);
    const out = await text(p, '[data-sgl-venue-out]');
    ok('kill switch: a provider disabled in the proxy reads «desactivada», no value, no retry', !/Previsión/.test(out) && /Integración desactivada/.test(out) && proxyCalls.filter((c) => c.includes('besttime')).length === nBt + 2, out.slice(0, 140));
    await ctx.close();
  }
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed (${EXPECT})`);
process.exit(failed.length ? 1 : 0);
