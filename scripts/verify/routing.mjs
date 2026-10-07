// Functional checks for geolocation + road routing + Mi Ruta against a served build.
//   npm run build && npx astro preview --port 4321   (other terminal)
//   node scripts/verify/routing.mjs --url http://127.0.0.1:4321 --out scrollcraft/lab/routing [--live]
//
// Routing requests to the keyless provider (FOSSGIS OSRM) are answered with
// deterministic fixtures (a bent road-like polyline + per-leg totals), so the
// public service is not hit by the test suite. --live adds ONE real request.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/routing'));
const LIVE = argv.includes('--live');
const ONLY = arg('--only', null);
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---- fixtures -----------------------------------------------------------------------
const hav = (a, b) => { const R = 6371008.8, r = Math.PI / 180; const dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r; const s = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
const parseCoords = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop()).split(';').map((s) => s.split(',').map(Number));
function bend(a, b) { // road-like: 6 intermediate vertices offset from the chord
  const pts = [a];
  for (let i = 1; i < 7; i++) { const t = i / 7; pts.push([a[0] + (b[0] - a[0]) * t + Math.sin(t * Math.PI) * 0.04, a[1] + (b[1] - a[1]) * t + Math.cos(t * Math.PI * 2) * 0.02]); }
  pts.push(b);
  return pts;
}
function osrmRoute(url) {
  const cs = parseCoords(url);
  const legs = cs.slice(1).map((c, i) => { const d = hav(cs[i], c) * 1.3; return { distance: d, duration: d / 19, steps: [], summary: '', weight: 0 }; });
  const geometry = { type: 'LineString', coordinates: cs.slice(1).flatMap((c, i) => bend(cs[i], c).slice(i ? 1 : 0)) };
  const total = (k) => legs.reduce((s, l) => s + l[k], 0);
  const routes = [{ geometry, legs, distance: total('distance'), duration: total('duration'), weight: 0, weight_name: 'routability' }];
  if (/alternatives=2/.test(url) && cs.length === 2) routes.push({ geometry: { type: 'LineString', coordinates: bend(cs[0], cs[1]).map(([x, y]) => [x - 0.03, y]) }, legs: [{ ...legs[0], distance: legs[0].distance * 1.12, duration: legs[0].duration * 1.2 }], distance: legs[0].distance * 1.12, duration: legs[0].duration * 1.2 });
  return { code: 'Ok', routes, waypoints: cs.map((c) => ({ location: c })) };
}
function osrmTable(url) {
  const cs = parseCoords(url);
  const distances = cs.map((a) => cs.map((b) => hav(a, b) * 1.3));
  return { code: 'Ok', distances, durations: distances.map((r) => r.map((d) => d / 19)) };
}

/** mode: 'ok' | '429' | '500' | 'noroute'; returns counters */
async function mockRouting(ctx, state) {
  await ctx.route('https://routing.openstreetmap.de/**', async (route) => {
    const url = route.request().url();
    const kind = url.includes('/table/') ? 'table' : 'route';
    state.calls.push({ kind, url });
    if (state.mode === '429') return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ message: 'Too Many Requests' }) });
    if (state.mode === '500') return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' });
    if (state.mode === 'noroute') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'NoRoute', message: 'Impossible route between points' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(kind === 'table' ? osrmTable(url) : osrmRoute(url)) });
  });
}

async function ctxFor(w, h, extra = {}, init) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', ...extra });
  await c.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; Element.prototype.setPointerCapture = () => {}; });
  if (init) await c.addInitScript(init.fn, init.arg);
  return c;
}
const seed = (ids) => ({ fn: (v) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('slp:mi-ruta:v1', JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } }, arg: ids });
async function step(name, fn) { if (ONLY && !name.includes(ONLY)) return; try { await fn(); } catch (e) { ok(name, false, 'threw: ' + String(e.message).split('\n')[0]); } }
const watchErrors = (p) => { const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/tiles\.openfreemap|Failed to load resource/.test(m.text())) errs.push(m.text()); }); return errs; };
const summary = (p) => p.textContent('[data-plan-summary]');
const settle = async (p, re = /km|No fue posible|desactivado|hacen falta/) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector('[data-plan-summary]')?.textContent ?? ''), re.source, { timeout: 15000 });

// stops: C01 SLP (verified) · H17 Ciudad Valles (verified) · M02 Rioverde (verified) · H01 Tamul (approximate) · C12 (no point)
const BAD_ORDER = ['C01', 'H17', 'M02'];

// ---- 1. route with several stops, legs, markers, no straight line -----------------
await step('several stops', async () => {
  const state = { mode: 'ok', calls: [] };
  const c = await ctxFor(1440, 900, {}, seed([...BAD_ORDER, 'H01', 'C12']));
  await mockRouting(c, state);
  const p = await c.newPage();
  const errs = watchErrors(p);
  await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
  await settle(p);
  const s = await summary(p);
  ok('road summary shows km and time', /\d+ km/.test(s) && /\d+ (h|min)/.test(s), s.replace(/\s+/g, ' ').slice(0, 120));
  ok('summary names start and end', /Inicio:.*Fin:/.test(s));
  ok('approximate stop flagged', /ubicación aproximada/.test(s));
  ok('stop without point excluded and named', /fuera del cálculo: Talleres de rebozo/.test(s));
  const routeCalls = state.calls.filter((x) => x.kind === 'route');
  ok('exactly one routing request for the page', routeCalls.length === 1, `calls=${routeCalls.length}`);
  ok('request keeps the saved order (4 routable points)', parseCoords(routeCalls[0].url).length === 4);
  const legs = await p.locator('.mr__leg').count();
  ok('per-leg distance/time in the list', legs === 3, `legs=${legs}`);
  await p.waitForSelector('.wp', { timeout: 10000 });
  ok('start / stop / end markers', (await p.locator('.wp--start').count()) === 1 && (await p.locator('.wp--end').count()) === 1 && (await p.locator('.wp--stop').count()) === 2);
  ok('end marker labelled «Fin», start «Inicio»', (await p.locator('.wp--end .wp__tag').textContent()) === 'Fin' && (await p.locator('.wp--start .wp__tag').textContent()) === 'Inicio');
  ok('route legend visible', await p.locator('[data-legend-route]').isVisible());
  ok('provider attribution shown', /OSRM.*OpenStreetMap/.test(await p.textContent('[data-route-attr]')));
  await p.screenshot({ path: path.join(OUT, '01-mi-ruta-desktop.png'), fullPage: false });

  // reorder: move Ciudad Valles down → recalculated, focus kept
  await p.click('button[data-id="H17"][data-mv="1"]');
  await p.waitForTimeout(900);
  await settle(p);
  const ids = await p.evaluate(() => JSON.parse(localStorage.getItem('slp:mi-ruta:v1')));
  ok('reorder persists in the existing store', ids.slice(0, 3).join() === 'C01,M02,H17', ids.join());
  ok('reorder triggers one new routing request', state.calls.filter((x) => x.kind === 'route').length === 2);
  ok('keyboard focus stays on the moved control', await p.evaluate(() => document.activeElement?.dataset?.id === 'H17'));

  // back to the bad order, then optimize: keep, then apply
  await p.click('button[data-id="H17"][data-mv="-1"]');
  await p.waitForTimeout(900);
  await settle(p);
  await p.click('[data-opt-run]');
  await p.waitForSelector('[data-opt-apply], [data-plan-opt] .small', { timeout: 15000 });
  const optText = await p.textContent('[data-plan-opt]');
  ok('optimize proposes and shows the change', /Tu orden.*Propuesto.*Cambio/s.test(optText) && /−/.test(optText), optText.replace(/\s+/g, ' ').slice(0, 160));
  ok('one matrix request for optimization', state.calls.filter((x) => x.kind === 'table').length === 1);
  const before = await p.evaluate(() => localStorage.getItem('slp:mi-ruta:v1'));
  await p.click('[data-opt-keep]');
  ok('«Conservar mi orden» leaves the order untouched', before === (await p.evaluate(() => localStorage.getItem('slp:mi-ruta:v1'))));
  await p.click('[data-opt-run]');
  await p.waitForSelector('[data-opt-apply]');
  ok('second optimize reuses the cached matrix', state.calls.filter((x) => x.kind === 'table').length === 1);
  await p.click('[data-opt-apply]');
  await p.waitForTimeout(900);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('slp:mi-ruta:v1')));
  ok('applied order: Rioverde before Ciudad Valles', after.indexOf('M02') < after.indexOf('H17'), after.join());
  await settle(p);

  // remove stops down to two → alternatives offered
  await p.click('button[data-rm="H01"]');
  await p.click('button[data-rm="C12"]');
  await p.click('button[data-rm="M02"]');
  await p.waitForTimeout(900);
  await settle(p);
  const alt = await p.locator('input[name="alt"]').count();
  ok('origin → one destination offers provider alternatives', alt === 2, `alts=${alt}`);
  if (alt === 2) {
    await p.locator('input[name="alt"]').nth(1).check();
    await p.waitForTimeout(200);
    ok('choosing an alternative updates the totals', /Alternativa 1/.test(await summary(p)));
  }

  // refresh: order persisted, route served from cache (no new request)
  const n = state.calls.length;
  await p.reload({ waitUntil: 'domcontentloaded' });
  await settle(p);
  ok('refresh keeps Mi Ruta', (await p.locator('[data-mr-list] li').count()) === 2);
  ok('refresh reuses the cached route (no request)', state.calls.length === n && /reutilizado/.test(await summary(p)), `calls ${n}→${state.calls.length}`);
  ok('no console errors (several stops)', errs.length === 0, errs.slice(0, 2).join(' | '));
  await c.close();
});

// ---- 2. geolocation granted (altitude null) --------------------------------------------
await step('geolocation granted', async () => {
  const state = { mode: 'ok', calls: [] };
  const c = await ctxFor(1440, 900, { permissions: ['geolocation'], geolocation: { latitude: 22.1565, longitude: -100.9855, accuracy: 20 } }, seed(['M02', 'H17']));
  await mockRouting(c, state);
  const p = await c.newPage();
  const errs = watchErrors(p);
  await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
  await settle(p);
  ok('location is not requested on load', !(await p.locator('.geo-me').count()) && !/Ubicación obtenida/.test(await p.textContent('[data-plan-geo]')));
  await p.check('input[name="origin"][value="gps"]', { force: true });
  await p.click('[data-plan-locate]');
  await p.waitForFunction(() => /Ubicación obtenida/.test(document.querySelector('[data-plan-geo]')?.textContent ?? ''));
  const geo = await p.textContent('[data-plan-geo]');
  ok('lat / lon / accuracy shown', /22\.15650° N/.test(geo) && /100\.98550° O/.test(geo) && /± 20 m/.test(geo), geo.replace(/\s+/g, ' ').slice(0, 140));
  ok('no invented altitude', !/Altitud/.test(geo) && /no reporta altitud/.test(await p.textContent('[data-origin-gps]')));
  await p.waitForTimeout(800);
  await settle(p);
  const last = state.calls.filter((x) => x.kind === 'route').pop();
  const first = parseCoords(last.url)[0];
  ok('route starts at the visitor position', Math.abs(first[0] + 100.9855) < 1e-4 && Math.abs(first[1] - 22.1565) < 1e-4, first.join());
  await p.waitForSelector('.geo-me');
  ok('visitor marker on the map', (await p.locator('.geo-me').count()) === 1);
  ok('location never written to storage', await p.evaluate(() => !JSON.stringify({ ...localStorage, ...sessionStorage }).includes('22.1565')));
  ok('summary «Inicio: Tu ubicación»', /Inicio: Tu ubicación/.test(await summary(p)));
  await p.click('[data-plan-follow]');
  ok('follow toggles watchPosition', (await p.getAttribute('[data-plan-follow]', 'aria-pressed')) === 'true');
  await p.click('[data-plan-follow]');
  ok('follow off', (await p.getAttribute('[data-plan-follow]', 'aria-pressed')) === 'false');
  await p.screenshot({ path: path.join(OUT, '02-mi-ruta-gps.png') });
  ok('no console errors (gps)', errs.length === 0, errs.slice(0, 2).join(' | '));
  await c.close();
});

// ---- 3. location failure modes ---------------------------------------------------------------
const geoStub = (kind) => ({
  fn: (k) => {
    if (k === 'unsupported') { Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => undefined, configurable: true }); return; }
    const g = {
      getCurrentPosition: (ok, err) => setTimeout(() => {
        if (k === 'timeout') err({ code: 3, message: 'timeout' });
        else if (k === 'denied') err({ code: 1, message: 'denied' });
        else ok({ timestamp: Date.now(), coords: { latitude: 22.6, longitude: -100.4, accuracy: k === 'coarse' ? 4200 : 8, altitude: 1864.4, altitudeAccuracy: 6, heading: null, speed: null } });
      }, 50),
      watchPosition: () => 1, clearWatch: () => {},
    };
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => g, configurable: true });
  },
  arg: kind,
});
for (const [kind, expect] of [['denied', /Permiso denegado/], ['unsupported', /Geolocalización no disponible/], ['timeout', /Tiempo de espera agotado/], ['altitude', /Altitud1[,.]864 m \(± 6 m\)/], ['coarse', /Ubicación aproximada/]]) {
  await step(`geolocation ${kind}`, async () => {
    const state = { mode: 'ok', calls: [] };
    const c = await ctxFor(1440, 900, {}, seed(['M02', 'H17']));
    await c.addInitScript(geoStub(kind).fn, kind);
    await mockRouting(c, state);
    const p = await c.newPage();
    const errs = watchErrors(p);
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await settle(p);
    await p.check('input[name="origin"][value="gps"]', { force: true });
    await p.click('[data-plan-locate]');
    await p.waitForTimeout(400);
    const geo = await p.textContent('[data-plan-geo]');
    ok(`location ${kind}: state shown`, expect.test(geo), geo.replace(/\s+/g, ' ').slice(0, 120));
    if (kind === 'denied' || kind === 'unsupported' || kind === 'timeout') {
      await settle(p);
      ok(`location ${kind}: route still works from the first saved place`, /Inicio: Rioverde/.test(await summary(p)));
      ok(`location ${kind}: manual alternatives offered`, kind === 'timeout' || /municipio/.test(await p.textContent('[data-origin-note]')));
    }
    ok(`no console errors (${kind})`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await c.close();
  });
}

// ---- 4. manual origin: municipality ------------------------------------------------------------
await step('municipality origin', async () => {
  const state = { mode: 'ok', calls: [] };
  const c = await ctxFor(1440, 900, {}, seed(['M02', 'H17']));
  await mockRouting(c, state);
  const p = await c.newPage();
  await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
  await settle(p);
  await p.check('input[name="origin"][value="place"]', { force: true });
  const opts = await p.locator('[data-origin-select] option').count();
  ok('municipal seats listed', opts > 50, `options=${opts}`);
  await p.selectOption('[data-origin-select]', { label: 'Matehuala' });
  await p.waitForTimeout(800);
  await settle(p);
  ok('route starts at the chosen municipality', /Inicio: Matehuala/.test(await summary(p)));
  ok('start row in the list', /Matehuala/.test(await p.textContent('.mr__start')));
  await c.close();
});

// ---- 5. honest failures: 429, provider down, impossible, offline ------------------------------------
for (const [mode, re] of [['429', /demasiadas solicitudes/], ['500', /no está disponible/], ['noroute', /No existe un recorrido/]]) {
  await step(`failure ${mode}`, async () => {
    const state = { mode, calls: [] };
    const c = await ctxFor(1440, 900, {}, seed(['M02', 'H17', 'H01']));
    await mockRouting(c, state);
    const p = await c.newPage();
    const errs = watchErrors(p);
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await settle(p);
    const s = await summary(p);
    ok(`${mode}: honest message`, /No fue posible calcular el recorrido por carretera/.test(s) && re.test(s), s.replace(/\s+/g, ' ').slice(0, 140));
    ok(`${mode}: no line drawn, stops still on the map`, !(await p.locator('[data-legend-route]').isVisible()) && (await p.locator('.wp').count()) === 3);
    ok(`${mode}: saved places kept`, (await p.locator('[data-mr-list] li').count()) === 3);
    state.mode = 'ok';
    await p.click('[data-plan-retry]');
    await settle(p, /\d+ km/);
    ok(`${mode}: «Reintentar ruta» recovers`, /\d+ km/.test(await summary(p)));
    if (mode === '429') await p.screenshot({ path: path.join(OUT, '03-error-retry.png') });
    ok(`${mode}: no uncaught errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await c.close();
  });
}
await step('offline', async () => {
  const state = { mode: 'ok', calls: [] };
  const c = await ctxFor(1440, 900, {}, seed(['M02', 'H17']));
  await mockRouting(c, state);
  const p = await c.newPage();
  await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
  await settle(p);
  await c.setOffline(true);
  await p.waitForFunction(() => navigator.onLine === false);
  await p.check('input[name="profile"][value="foot"]', { force: true });
  await settle(p, /No fue posible|Recorrido a pie/);
  if (process.env.DEBUG_ROUTING) console.log(state.calls.map((x) => x.url.slice(30, 70)), await p.evaluate(() => navigator.onLine));
  const offS = await summary(p);
  ok('offline: says there is no connection', /Sin conexión/.test(offS), offS.replace(/\s+/g, ' ').slice(0, 120));
  await c.setOffline(false);
  await c.close();
});

// ---- 6. discovery map: locate + overlay + layers ----------------------------------------------------------
await step('mapa page', async () => {
  const state = { mode: 'ok', calls: [] };
  const c = await ctxFor(1440, 900, { permissions: ['geolocation'], geolocation: { latitude: 22.1565, longitude: -100.9855, accuracy: 35 } }, seed(['C01', 'M02']));
  await mockRouting(c, state);
  const p = await c.newPage();
  const errs = watchErrors(p);
  await p.goto(BASE + '/mapa/', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-map-list] button', { timeout: 20000 });
  ok('discovery list unchanged (49)', (await p.locator('[data-map-list] button').count()) === 49);
  ok('no routing request until asked', state.calls.length === 0);
  await p.click('[data-geo-locate]');
  await p.waitForSelector('.geo-me', { timeout: 10000 });
  const card = await p.textContent('[data-geo-card]');
  ok('map card: coordinates + accuracy', /22\.15650° N/.test(card) && /± 35 m/.test(card));
  ok('locate button becomes «Centrar en mí»', /Centrar en mí/.test(await p.textContent('[data-geo-locate]')));
  await p.click('[data-route-overlay]');
  await p.waitForFunction(() => /km/.test(document.querySelector('[data-route-bar]')?.textContent ?? ''), null, { timeout: 15000 });
  ok('Mi Ruta overlay: road totals on the map', /\d+ km/.test(await p.textContent('[data-route-bar]')));
  await p.click('[data-geo-start]');
  await p.waitForTimeout(1200);
  const last = state.calls.filter((x) => x.kind === 'route').pop();
  ok('«Iniciar Mi Ruta aquí» routes from the visitor', Math.abs(parseCoords(last.url)[0][1] - 22.1565) < 1e-4);
  await p.click('[data-layer="lodging"]');
  await p.click('[data-layer="seats"]');
  await p.waitForTimeout(600);
  ok('layer chips toggle', (await p.getAttribute('[data-layer="lodging"]', 'aria-pressed')) === 'true');
  await p.locator('[data-map-list] button', { hasText: 'Cascada de Tamul' }).click();
  await p.waitForSelector('[data-map-selected] [data-route-add]');
  ok('POI panel still adds to Mi Ruta', (await p.locator('[data-map-selected] [data-route-add]').count()) === 1);
  await p.screenshot({ path: path.join(OUT, '04-mapa-overlay.png') });
  ok('no console errors (mapa)', errs.length === 0, errs.slice(0, 2).join(' | '));
  await c.close();
});

// ---- 7. layout: mobile / tablet / desktop, no horizontal overflow ----------------------------------------
for (const [w, h, tag] of [[390, 844, 'mobile'], [820, 1180, 'tablet'], [1440, 900, 'desktop']]) {
  await step(`layout ${tag}`, async () => {
    const state = { mode: 'ok', calls: [] };
    const c = await ctxFor(w, h, { isMobile: w < 500, hasTouch: w < 900 }, seed([...BAD_ORDER, 'H01']));
    await mockRouting(c, state);
    const p = await c.newPage();
    for (const page of ['/mi-ruta/', '/mapa/', '/', '/destinos/', '/rutas/']) {
      await p.goto(BASE + page, { waitUntil: 'domcontentloaded' });
      if (page === '/mi-ruta/') await settle(p);
      await p.waitForTimeout(page === '/mi-ruta/' ? 300 : 800);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(`${tag} ${page}: no horizontal overflow`, over <= 0, `overflow=${over}px`);
    }
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await settle(p);
    await p.screenshot({ path: path.join(OUT, `05-mi-ruta-${tag}.png`), fullPage: true });
    await p.goto(BASE + '/mapa/', { waitUntil: 'networkidle' });
    await p.locator('[data-map]').scrollIntoViewIfNeeded();
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, `06-mapa-${tag}.png`) });
    await c.close();
  });
}

// ---- 8. one real request to the keyless provider (opt-in) -------------------------------------------------
if (LIVE) {
  await step('live FOSSGIS', async () => {
    const c = await ctxFor(1440, 900, {}, seed(['C01', 'M02']));
    const p = await c.newPage();
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await settle(p, /\d+ km|No fue posible/);
    const s = await summary(p);
    ok('live: real road route SLP → Rioverde', /\d+ km/.test(s), s.replace(/\s+/g, ' ').slice(0, 140));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, '07-live-route.png') });
    await c.close();
  });
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
