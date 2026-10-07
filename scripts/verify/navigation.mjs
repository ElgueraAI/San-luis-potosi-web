// End-to-end check of live navigation on /mi-ruta/ against a served build.
//   npm run build && npx astro preview --port 4321   (other terminal)
//   node scripts/verify/navigation.mjs --url http://127.0.0.1:4321 --out scrollcraft/lab/navigation
//
// The routing provider (FOSSGIS OSRM) is answered with deterministic fixtures
// and every route served is recorded, so the visitor is "driven" along the
// exact geometry with Playwright geolocation overrides. Sequence:
// start → travel → progress → noisy GPS → hidden/visible tab → deviation →
// one reroute → offline (route kept, no requests) → online (no duplicate) →
// arrival → visited → next stop → refresh (visited kept) → resume → arrival →
// finish → privacy check → reset. Then a mobile pass for layout.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/navigation'));
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---- fixtures (same shape as scripts/verify/routing.mjs) ------------------------------
const hav = (a, b) => { const R = 6371008.8, r = Math.PI / 180; const dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r; const s = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
const parseCoords = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop()).split(';').map((s) => s.split(',').map(Number));
function bend(a, b) {
  const pts = [a];
  for (let i = 1; i < 12; i++) { const t = i / 12; pts.push([a[0] + (b[0] - a[0]) * t + Math.sin(t * Math.PI) * 0.01, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * 0.004]); }
  pts.push(b);
  return pts;
}
function osrmRoute(url) {
  const cs = parseCoords(url);
  const legs = cs.slice(1).map((c, i) => { const d = hav(cs[i], c) * 1.3; return { distance: d, duration: d / 19, steps: [], summary: '', weight: 0 }; });
  const coordinates = cs.slice(1).flatMap((c, i) => bend(cs[i], c).slice(i ? 1 : 0));
  const total = (k) => legs.reduce((s, l) => s + l[k], 0);
  return { code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates }, legs, distance: total('distance'), duration: total('duration') }], waypoints: cs.map((c) => ({ location: c })) };
}
async function mockRouting(ctx, state) {
  await ctx.route('https://routing.openstreetmap.de/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/table/')) return route.fulfill({ status: 404, body: '{}' });
    const body = osrmRoute(url);
    state.routes.push({ coords: parseCoords(url), geometry: body.routes[0].geometry.coordinates, at: Date.now() });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
}
// point at a fraction of a polyline's length
function at(line, f) {
  const seg = line.slice(1).map((c, i) => hav(line[i], c));
  let left = seg.reduce((a, b) => a + b, 0) * f;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i]) { const t = seg[i] ? left / seg[i] : 0; return [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t]; }
    left -= seg[i];
  }
  return line[line.length - 1];
}
const meters = (txt) => { const m = /([\d.,]+)\s*(km|m)\b/.exec(txt ?? ''); if (!m) return NaN; const v = +m[1].replace(',', ''); return m[2] === 'km' ? v * 1000 : v; };

const M02 = [-99.992923, 21.932378]; // Rioverde (verified point)
const H17 = [-99.018721, 21.986537]; // Ciudad Valles (verified point)
const START = [-100.04, 21.925];
// every position fed to the browser, to prove none of them reaches storage
const fed = [START];
const leaks = (dump) => fed.filter(([x, y]) => dump.includes(x.toFixed(4)) && dump.includes(y.toFixed(4)));

const watchErrors = (p) => { const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/tiles\.openfreemap|Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(m.text())) errs.push(m.text()); }); return errs; };
const seed = (ids) => ({ fn: (v) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('slp:mi-ruta:v1', JSON.stringify(v)); localStorage.removeItem('slp:mi-ruta:trip:v1'); sessionStorage.setItem('seeded', '1'); } }, arg: ids });
const text = (p, s) => p.textContent(s).then((t) => (t ?? '').replace(/\s+/g, ' ').trim());
const waitText = (p, sel, re, timeout = 10000) => p.waitForFunction(([s, src]) => new RegExp(src).test(document.querySelector(s)?.textContent ?? ''), [sel, re.source], { timeout });
const pause = (p, ms) => p.waitForTimeout(ms);

async function moveTo(ctx, p, c, accuracy = 10, wait = 450) {
  fed.push(c);
  await ctx.setGeolocation({ longitude: c[0], latitude: c[1], accuracy });
  await pause(p, wait);
}
const storageDump = (p) => p.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
async function setHidden(p, hidden) {
  await p.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await pause(p, 300);
}

// ==== desktop: the full trip ===========================================================
{
  const state = { routes: [] };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', permissions: ['geolocation'], geolocation: { longitude: START[0], latitude: START[1], accuracy: 10 } });
  await ctx.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; Element.prototype.setPointerCapture = () => {}; });
  await ctx.addInitScript(seed(['M02', 'H17']).fn, ['M02', 'H17']);
  await mockRouting(ctx, state);
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  const errs = watchErrors(p);
  try {
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-nav]:not([hidden])', { timeout: 15000 });
    ok('live navigation card shown on /mi-ruta/', true);
    ok('location not requested on load', (await p.locator('.geo-me').count()) === 0);
    ok('«Iniciar recorrido» offered', /Iniciar recorrido/.test(await text(p, '[data-nav-view="idle"]')));
    await pause(p, 900);
    const before = state.routes.length;

    // ---- start ----
    await p.click('[data-nav-view="idle"] [data-nav-start]');
    await waitText(p, '[data-nav-status]', /En ruta/);
    ok('starting → navigating («En ruta»)', true);
    ok('next destination is the first stop', (await text(p, '[data-nav-dest]')) === 'Rioverde');
    const r1 = state.routes.at(-1);
    ok('route requested from the visitor position', state.routes.length === before + 1 && Math.abs(r1.coords[0][0] - START[0]) < 1e-5, `requests +${state.routes.length - before}`);
    ok('ETA shown, labelled without live traffic', /Llegada estimada \d{1,2}:\d{2}.*sin tráfico en tiempo real/.test(await text(p, '[data-nav-eta]')));
    ok('planner locked while navigating', await p.evaluate(() => document.querySelector('[data-planner]').inert === true));
    ok('visitor marker on the map', (await p.locator('.geo-me').count()) === 1);
    const k = r1.geometry.findIndex((c) => Math.abs(c[0] - M02[0]) < 1e-9 && Math.abs(c[1] - M02[1]) < 1e-9);
    const leg1 = r1.geometry.slice(0, k + 1);

    // ---- travel: progress grows, distance falls ----
    const d0 = meters(await text(p, '[data-nav-dist]'));
    const b0 = +(await p.getAttribute('[data-nav-bar]', 'aria-valuenow'));
    await moveTo(ctx, p, at(leg1, 0.2));
    await moveTo(ctx, p, at(leg1, 0.35));
    const d1 = meters(await text(p, '[data-nav-dist]'));
    const b1 = +(await p.getAttribute('[data-nav-bar]', 'aria-valuenow'));
    ok('remaining distance decreases while travelling', d1 < d0, `${d0} → ${d1} m`);
    ok('trip progress increases', b1 > b0, `${b0}% → ${b1}%`);
    ok('travelled part drawn muted («Tramo recorrido»)', await p.locator('[data-legend-done]').isVisible());
    ok('map location card and «Centrar en mí» give way to the trip card', !(await p.locator('[data-geo-card]').isVisible()) && !(await p.locator('[data-geo-locate]').isVisible()));
    await p.screenshot({ path: path.join(OUT, '00-live-desktop.png') });

    // ---- noisy GPS: one bad reading, one jump: no reroute ----
    const n0 = state.routes.length;
    const here = at(leg1, 0.4);
    await moveTo(ctx, p, [here[0], here[1] + 0.01], 900); // ±900 m
    await moveTo(ctx, p, [here[0], here[1] + 0.004], 10); // one precise reading 450 m off
    await moveTo(ctx, p, at(leg1, 0.45));
    await pause(p, 600);
    ok('noisy GPS does not reroute', state.routes.length === n0 && /En ruta/.test(await text(p, '[data-nav-status]')), `requests +${state.routes.length - n0}`);

    // ---- hidden tab pauses, visible resumes ----
    await setHidden(p, true);
    ok('hidden tab → paused, honest message', /segundo plano/.test(await text(p, '[data-nav-status]')) && /pueden detener la ubicación/.test(await text(p, '[data-nav-msg]')));
    await setHidden(p, false);
    await pause(p, 500);
    ok('visible again → resumes «En ruta»', /En ruta/.test(await text(p, '[data-nav-status]')));

    // ---- camera: a drag frees it, «Recentrar» follows again ----
    await p.locator('[data-map-canvas]').scrollIntoViewIfNeeded();
    const box = await p.locator('[data-map-canvas]').boundingBox();
    const vh = p.viewportSize().height;
    ok('desktop trip view: whole map inside the viewport', box.y >= 0 && box.y + box.height <= vh + 1, `map ${Math.round(box.y)}–${Math.round(box.y + box.height)} of ${vh}px`);
    const cx = box.x + box.width / 2, cy = box.y + Math.min(box.height, vh - box.y) / 2;
    await p.mouse.move(cx, cy);
    await p.mouse.down();
    await p.mouse.move(cx + 120, cy + 40, { steps: 6 });
    await p.mouse.up();
    await pause(p, 300);
    ok('dragging the map stops camera follow («Recentrar» appears)', await p.locator('[data-nav-recenter]').isVisible());
    await p.click('[data-nav-recenter]');
    await pause(p, 200);
    ok('«Recentrar» resumes follow', !(await p.locator('[data-nav-recenter]').isVisible()));

    // ---- intentional deviation: exactly one reroute ----
    const n1 = state.routes.length;
    const dev = at(leg1, 0.5);
    const off = [dev[0] - 0.006, dev[1] + 0.006]; // ~900 m from the road
    for (let i = 0; i < 3; i++) await moveTo(ctx, p, [off[0] + i * 0.0001, off[1]], 12, 350);
    await waitText(p, '[data-nav-status]', /En ruta/);
    await pause(p, 700);
    const r2 = state.routes.at(-1);
    ok('three off-route readings → exactly one reroute', state.routes.length === n1 + 1, `requests +${state.routes.length - n1}`);
    ok('reroute starts where the visitor is', hav(r2.coords[0], [off[0] + 0.0002, off[1]]) < 30);
    ok('automatic reroutes counted (1 de 6)', /1 de 6/.test(await text(p, '[data-nav-details]')));

    // ---- offline: route kept, progress continues, no request ----
    const k2 = r2.geometry.findIndex((c) => Math.abs(c[0] - M02[0]) < 1e-9 && Math.abs(c[1] - M02[1]) < 1e-9);
    const leg2 = r2.geometry.slice(0, k2 + 1);
    await ctx.setOffline(true);
    await pause(p, 300);
    const dOff0 = meters(await text(p, '[data-nav-dist]'));
    await moveTo(ctx, p, at(leg2, 0.4));
    const dOff1 = meters(await text(p, '[data-nav-dist]'));
    ok('offline: «Sin conexión. Seguimos mostrando tu última ruta.»', /Sin conexión\. Seguimos mostrando tu última ruta/.test(await text(p, '[data-nav-msg]')));
    ok('offline: progress still computed on the last route', dOff1 < dOff0, `${dOff0} → ${dOff1} m`);
    ok('offline: «Recalcular ruta» disabled', await p.locator('[data-nav-reroute]').isDisabled());
    const n2 = state.routes.length;
    const dv = at(leg2, 0.45);
    for (let i = 0; i < 3; i++) await moveTo(ctx, p, [dv[0] + 0.006, dv[1] - 0.006 + i * 0.0001], 12, 300);
    ok('offline: off route but no request', state.routes.length === n2);
    await ctx.setOffline(false);
    await pause(p, 1500);
    ok('back online: no immediate request', state.routes.length === n2, `requests +${state.routes.length - n2}`);
    await moveTo(ctx, p, at(leg2, 0.6));
    await pause(p, 600);
    ok('back on the road: «En ruta», still no duplicate request', /En ruta/.test(await text(p, '[data-nav-status]')) && state.routes.length === n2);

    // ---- arrival ----
    await moveTo(ctx, p, at(leg2, 0.9));
    await moveTo(ctx, p, [M02[0] - 0.0003, M02[1]]);
    await p.waitForSelector('[data-nav-view="arrived"]:not([hidden])', { timeout: 5000 });
    ok('arrival detected: «Has llegado a Rioverde»', /Has llegado a Rioverde/.test(await text(p, '[data-nav-arrived-title]')));
    ok('arrival does not remove the stop', (await p.evaluate(() => JSON.parse(localStorage.getItem('slp:mi-ruta:v1')))).includes('M02'));
    await p.screenshot({ path: path.join(OUT, '01-arrived-desktop.png') });
    await p.click('[data-nav-visited]');
    await pause(p, 200);
    const trip = await p.evaluate(() => JSON.parse(localStorage.getItem('slp:mi-ruta:trip:v1')));
    ok('«Marcar como visitado» stores the stop', !!trip?.stops?.M02?.visited && typeof trip.stops.M02.visitedAt === 'number');
    ok('stored trip has only id / startedAt / stops{visited, visitedAt}', JSON.stringify(Object.keys(trip)) === '["id","startedAt","stops"]' && JSON.stringify(Object.keys(trip.stops.M02)) === '["visited","visitedAt"]');
    ok('list shows «✓ Visitado»', /Visitado/.test(await text(p, '[data-mr-list]')));
    const n3 = state.routes.length;
    await p.click('[data-nav-continue]');
    await waitText(p, '[data-nav-dest]', /Ciudad Valles/);
    await pause(p, 900);
    const r3 = state.routes.at(-1);
    ok('next stop becomes active: Ciudad Valles', true);
    ok('route refreshed once from here, without the visited stop', state.routes.length === n3 + 1 && r3.coords.length === 2 && hav(r3.coords[1], H17) < 1);

    // ---- refresh mid-trip: visited kept, position forgotten ----
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-nav]:not([hidden])', { timeout: 15000 });
    await pause(p, 600);
    ok('refresh keeps visited stops («1 de 2»)', /1 de 2/.test(await text(p, '[data-nav-trip]')) && /Visitado/.test(await text(p, '[data-mr-list]')));
    ok('refresh offers «Reanudar recorrido» and «Restablecer recorrido»', /Reanudar recorrido/.test(await text(p, '[data-nav-view="idle"]')) && await p.locator('[data-nav-view="idle"] [data-nav-reset]').isVisible());
    const leak1 = leaks(await storageDump(p));
    ok('precise position not persisted (no visitor coordinates in storage)', leak1.length === 0, `${fed.length} positions checked, leaks=${leak1.length}`);
    await p.click('[data-nav-view="idle"] [data-nav-start]');
    await waitText(p, '[data-nav-status]', /En ruta/);
    ok('resume → navigating to Ciudad Valles', (await text(p, '[data-nav-dest]')) === 'Ciudad Valles');
    const r4 = state.routes.at(-1);
    await moveTo(ctx, p, at(r4.geometry, 0.5));
    await moveTo(ctx, p, at(r4.geometry, 0.97));
    await moveTo(ctx, p, [H17[0] - 0.0002, H17[1]]);
    await p.waitForSelector('[data-nav-view="arrived"]:not([hidden])', { timeout: 5000 });
    ok('arrival at the last stop', /Has llegado a Ciudad Valles/.test(await text(p, '[data-nav-arrived-title]')));
    await p.click('[data-nav-visited]');
    await p.waitForSelector('[data-nav-view="finished"]:not([hidden])', { timeout: 5000 });
    ok('final stop → finished with a summary', /Visitaste 2 lugares/.test(await text(p, '[data-nav-sum-title]')) && /Rioverde/.test(await text(p, '[data-nav-sum]')));
    await p.screenshot({ path: path.join(OUT, '02-finished-desktop.png') });
    const leak2 = leaks(await storageDump(p));
    ok('no visitor coordinates in storage at the end', leak2.length === 0, `${fed.length} positions checked`);

    // ---- reset ----
    await p.click('[data-nav-view="finished"] [data-nav-reset]');
    await pause(p, 300);
    ok('«Restablecer recorrido» clears visited stops', (await p.evaluate(() => localStorage.getItem('slp:mi-ruta:trip:v1'))) === null && !/Visitado/.test(await text(p, '[data-mr-list]')));
    ok('saved places untouched by reset', (await p.evaluate(() => JSON.parse(localStorage.getItem('slp:mi-ruta:v1')))).length === 2);
    ok('no console errors (desktop trip)', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) {
    ok('desktop trip ran to the end', false, String(e.message).split('\n')[0]);
    await p.screenshot({ path: path.join(OUT, '00-failure.png') }).catch(() => {});
  }
  await ctx.close();
}

// ==== a failed reroute keeps the previous route (provider 503 after the first route) =====
{
  const state = { routes: [], fail: false };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-MX', permissions: ['geolocation'], geolocation: { longitude: START[0], latitude: START[1], accuracy: 10 } });
  await ctx.addInitScript(seed(['M02']).fn, ['M02']);
  await ctx.route('https://routing.openstreetmap.de/**', async (route) => {
    const url = route.request().url();
    if (state.fail) { state.routes.push({ failed: true }); return route.fulfill({ status: 503, contentType: 'text/html', body: 'down' }); }
    const body = osrmRoute(url);
    state.routes.push({ coords: parseCoords(url), geometry: body.routes[0].geometry.coordinates });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  });
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  try {
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-nav]:not([hidden])', { timeout: 15000 });
    await p.click('[data-nav-view="idle"] [data-nav-start]');
    await waitText(p, '[data-nav-status]', /En ruta/);
    const r = state.routes.at(-1);
    state.fail = true;
    const dev = at(r.geometry, 0.4);
    for (let i = 0; i < 3; i++) await moveTo(ctx, p, [dev[0] - 0.006, dev[1] + 0.006 + i * 0.0001], 12, 350);
    await waitText(p, '[data-nav-msg]', /No se pudo recalcular/);
    ok('failed reroute: honest message, previous route kept', /Seguimos con tu ruta anterior/.test(await text(p, '[data-nav-msg]')) && (await text(p, '[data-nav-dest]')) === 'Rioverde');
    ok('failed reroute: line still drawn (legend)', await p.locator('[data-legend-route]').isVisible());
    const n = state.routes.length;
    for (let i = 0; i < 4; i++) await moveTo(ctx, p, [dev[0] - 0.006, dev[1] + 0.0062 + i * 0.0001], 12, 350);
    ok('failed reroute: cooldown, no retry loop while moving', state.routes.length === n, `requests +${state.routes.length - n}`);
    ok('manual «Recalcular ruta» still available', await p.locator('[data-nav-reroute]').isEnabled());
    ok('no uncaught errors (failed reroute)', errs.length === 0, errs.slice(0, 2).join(' | '));
  } catch (e) {
    ok('failed-reroute scenario ran', false, String(e.message).split('\n')[0]);
  }
  await ctx.close();
}

// ==== denied permission: honest error, planning still works ==============================
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-MX', permissions: [] });
  await ctx.addInitScript(seed(['M02', 'H17']).fn, ['M02', 'H17']);
  await ctx.addInitScript(() => {
    const g = { getCurrentPosition: (_ok, err) => setTimeout(() => err({ code: 1, message: 'denied' }), 30), watchPosition: () => 1, clearWatch: () => {} };
    Object.defineProperty(Navigator.prototype, 'geolocation', { get: () => g, configurable: true });
  });
  await mockRouting(ctx, { routes: [] });
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  try {
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-nav]:not([hidden])', { timeout: 15000 });
    await p.click('[data-nav-view="idle"] [data-nav-start]');
    await p.waitForSelector('[data-nav-view="error"]:not([hidden])', { timeout: 5000 });
    ok('permission denied: clear error, no navigation', /permiso/.test(await text(p, '[data-nav-err]')));
    await p.click('[data-nav-view="error"] [data-nav-close]');
    ok('back to planning, planner usable', await p.evaluate(() => document.querySelector('[data-planner]').inert === false));
    ok('no console errors (denied)', errs.length === 0, errs.slice(0, 2).join(' | '));
  } catch (e) {
    ok('denied scenario ran', false, String(e.message).split('\n')[0]);
  }
  await ctx.close();
}

// ==== mobile: navigating layout, no horizontal overflow =================================
for (const [label, w, h] of [['mobile', 375, 812], ['tablet', 820, 1180]]) {
  const state = { routes: [] };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: label === 'mobile', hasTouch: label === 'mobile', locale: 'es-MX', permissions: ['geolocation'], geolocation: { longitude: START[0], latitude: START[1], accuracy: 10 } });
  await ctx.addInitScript(seed(['M02', 'H17']).fn, ['M02', 'H17']);
  await mockRouting(ctx, state);
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  try {
    await p.goto(BASE + '/mi-ruta/', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-nav]:not([hidden])', { timeout: 15000 });
    await p.click('[data-nav-view="idle"] [data-nav-start]');
    await waitText(p, '[data-nav-status]', /En ruta/);
    await moveTo(ctx, p, at(state.routes.at(-1).geometry, 0.015));
    const cardTop = await p.evaluate(() => document.querySelector('[data-nav]').getBoundingClientRect().top);
    ok(`${label}: trip card brought into view on start`, cardTop >= -1 && cardTop < 200, `top=${Math.round(cardTop)}px`);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${label}: navigating card, no horizontal overflow`, overflow <= 0, `overflow=${overflow}px`);
    const tight = await p.evaluate(() => [...document.querySelectorAll('[data-nav] button:not([hidden])')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 34).length);
    ok(`${label}: touch targets ≥ 34 px`, tight === 0, `small=${tight}`);
    await p.screenshot({ path: path.join(OUT, `03-navigating-${label}.png`), fullPage: false });
    ok(`no console errors (${label})`, errs.length === 0, errs.slice(0, 2).join(' | '));
  } catch (e) {
    ok(`${label} pass ran`, false, String(e.message).split('\n')[0]);
  }
  await ctx.close();
}

// ==== /mapa/ is not a navigation screen ====================================================
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX' });
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  await p.goto(BASE + '/mapa/', { waitUntil: 'domcontentloaded' });
  await pause(p, 1500);
  ok('/mapa/ has no navigation card or recenter control', (await p.locator('[data-nav]').count()) === 0 && (await p.locator('[data-nav-recenter]').count()) === 0);
  ok('no console errors (/mapa/)', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
