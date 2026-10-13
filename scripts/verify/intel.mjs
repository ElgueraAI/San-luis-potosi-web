// Functional checks for the smart tourism layer against a served build:
// profile → recommendations, location (granted / denied / unavailable),
// weather failure, adding to Mi Ruta, route-aware suggestions, alternatives,
// optimizer comparison, privacy controls, offline and provider-down states,
// and horizontal overflow at phone, tablet and desktop widths.
//   npm run build && npx astro preview --port 4321   (other terminal)
//   node scripts/verify/intel.mjs --url http://127.0.0.1:4321 [--base /repo/] [--out scrollcraft/lab/intel] [--only name]
//
// Routing (FOSSGIS OSRM) and weather (Open-Meteo) are answered with fixtures,
// so no public service is hit by the suite.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '') + ('/' + arg('--base', '').replace(/^\/|\/$/g, '')).replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/intel'));
const ONLY = arg('--only', null);
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---- fixtures ----------------------------------------------------------------------------
const hav = (a, b) => { const R = 6371008.8, r = Math.PI / 180; const dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r; const s = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
const parseCoords = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop()).split(';').map((s) => s.split(',').map(Number));
function line(a, b) { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * 0.02]); } return pts; }
function osrmRoute(url) {
  const cs = parseCoords(url);
  const legs = cs.slice(1).map((c, i) => { const d = hav(cs[i], c) * 1.3; return { distance: d, duration: d / 19, steps: [], summary: '', weight: 0 }; });
  const geometry = { type: 'LineString', coordinates: cs.slice(1).flatMap((c, i) => line(cs[i], c).slice(i ? 1 : 0)) };
  const total = (k) => legs.reduce((s, l) => s + l[k], 0);
  return { code: 'Ok', routes: [{ geometry, legs, distance: total('distance'), duration: total('duration'), weight: 0, weight_name: 'routability' }], waypoints: cs.map((c) => ({ location: c })) };
}
function osrmTable(url) {
  const cs = parseCoords(url);
  const distances = cs.map((a) => cs.map((b) => hav(a, b) * 1.3));
  return { code: 'Ok', distances, durations: distances.map((r) => r.map((d) => d / 19)) };
}
const wxBody = (n, o = {}) => JSON.stringify(Array.from({ length: n }, () => ({ current: { temperature_2m: 24, apparent_temperature: 25, precipitation: 0, weather_code: 1, wind_speed_10m: 8, ...o }, daily: { temperature_2m_max: [29], temperature_2m_min: [17], precipitation_probability_max: [10] } })));

/** state.routing: 'ok' | '500' ; state.weather: 'ok' | 'rain' | 'fail' */
async function mock(ctx, state) {
  await ctx.route('https://routing.openstreetmap.de/**', async (route) => {
    const url = route.request().url();
    const kind = url.includes('/table/') ? 'table' : 'route';
    state.calls.push(kind);
    if (state.routing === '500') return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(kind === 'table' ? osrmTable(url) : osrmRoute(url)) });
  });
  await ctx.route('https://api.open-meteo.com/**', async (route) => {
    state.calls.push('weather');
    if (state.weather === 'fail') return route.abort();
    const n = new URL(route.request().url()).searchParams.get('latitude').split(',').length;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: wxBody(n, state.weather === 'rain' ? { precipitation: 4, weather_code: 63 } : {}) });
  });
}
async function ctxFor(w, h, extra = {}, state = { routing: 'ok', weather: 'ok', calls: [] }, seed = null) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', timezoneId: 'America/Mexico_City', ...extra });
  await c.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; Element.prototype.setPointerCapture = () => {}; });
  if (seed) await c.addInitScript((v) => { if (!sessionStorage.getItem('seeded')) { for (const [k, val] of Object.entries(v)) localStorage.setItem(k, JSON.stringify(val)); sessionStorage.setItem('seeded', '1'); } }, seed);
  await mock(c, state);
  return { c, state };
}
async function step(name, fn) { if (ONLY && !name.includes(ONLY)) return; try { await fn(); } catch (e) { ok(name, false, 'threw: ' + String(e.message).split('\n')[0]); } }
const watch = (p) => { const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/tiles\.openfreemap|Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text().slice(0, 160)); }); return errs; };
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const cards = (p, sel = '[data-results] [data-reco]') => p.$$eval(sel, (els) => els.map((e) => ({ id: e.dataset.reco, score: +e.dataset.score, text: e.textContent.replace(/\s+/g, ' ') })));
const ready = (p) => p.waitForFunction(() => document.querySelectorAll('[data-results] [data-reco]').length > 0 && !/consultando clima/.test(document.querySelector('[data-status]').textContent), null, { timeout: 15000 });
const shot = (p, name) => p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 72 });
const PROFILE = { 'slp:perfil:v1': { interests: ['agua', 'aventura'], duration: 'weekend', mode: 'car', budget: 'medio' } };

// ============================================================================ /descubre/ ==
await step('descubre: profile → explained recommendations', async () => {
  const { c } = await ctxFor(1440, 900);
  const p = await c.newPage(); const errs = watch(p);
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  const before = await cards(p);
  await p.click('[data-int="agua"]');
  await p.click('[data-int="aventura"]');
  await p.check('input[name="duration"][value="weekend"]', { force: true });
  await p.selectOption('[data-origin-select]', { label: 'Ciudad Valles' });
  await p.waitForFunction(() => /Saliendo de Ciudad Valles/.test(document.querySelector('[data-origin-status]').textContent));
  const after = await cards(p);
  ok('descubre: recommendations render without a profile', before.length > 0, `${before.length} cards`);
  ok('descubre: choosing interests changes the list', after.length > 0 && after.map((x) => x.id).join() !== before.map((x) => x.id).join());
  ok('descubre: every card has a 0–100 score and a reason', after.every((x) => x.score >= 0 && x.score <= 100 && /Por qué te lo recomendamos/.test(x.text) && /Coincide con/.test(x.text)));
  ok('descubre: sorted by score', after.every((x, i) => i === 0 || after[i - 1].score >= x.score), after.map((x) => x.score).join(' '));
  ok('descubre: distance is stated as straight-line', after.some((x) => /km en línea recta/.test(x.text)));
  ok('descubre: evidence level on every card', after.every((x) => /Evidencia (alta|media|baja)/.test(x.text)));
  ok('descubre: weather included when the request succeeds', /clima actual incluido/.test(await p.textContent('[data-status]')));
  ok('descubre: never claims crowding, availability or live traffic', after.every((x) => !/saturad|ocupaci[oó]n|tr[aá]fico en tiempo real|tiempo de espera/i.test(x.text.replace(/no confirma disponibilidad/g, ''))));
  await p.click('[data-results] [data-reco] .rk__how summary');
  ok('descubre: «Cómo se calculó» lists the factors and sources', /Coincidencia con tus intereses/.test(await p.textContent('[data-results] [data-reco] .rk__how')) && /Fuentes:/.test(await p.textContent('[data-results] [data-reco] .rk__how')));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('slp:perfil:v1')));
  ok('descubre: only the four preferences are stored', JSON.stringify(Object.keys(stored).sort()) === JSON.stringify(['budget', 'duration', 'interests', 'mode']), JSON.stringify(stored));
  ok('descubre: no console errors', errs.length === 0, errs.join(' | '));
  await shot(p, 'descubre-desktop');
  await c.close();
});

await step('descubre: add a recommendation to Mi Ruta', async () => {
  const { c } = await ctxFor(1440, 900, {}, undefined, PROFILE);
  const p = await c.newPage();
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  const first = (await cards(p))[0];
  await p.click('[data-results] [data-reco] [data-route-add]');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('slp:mi-ruta:v1')));
  ok('add: the place is saved in Mi Ruta', saved.length === 1 && saved[0] === first.id, JSON.stringify(saved));
  ok('add: the button shows «En Mi Ruta»', (await p.textContent('[data-results] [data-reco] [data-route-add]')).includes('En Mi Ruta'));
  ok('add: header counter updated', (await p.textContent('.hdr__count')).trim() === '1');
  const log = await p.evaluate(() => JSON.parse(localStorage.getItem('slp:analitica:v1')));
  ok('add: local log has recommendation_added, without position keys', log.some((e) => e.name === 'recommendation_added') && !/lat|lon|coord/i.test(JSON.stringify(log.map((e) => Object.keys(e.props)))), log.map((e) => e.name).join(','));
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  ok('add: a saved place is not suggested again', !(await cards(p)).some((x) => x.id === first.id));
  await c.close();
});

await step('descubre: location granted (simulated)', async () => {
  const { c } = await ctxFor(1440, 900, { geolocation: { latitude: 22.0312, longitude: -99.1532, accuracy: 20 }, permissions: ['geolocation'] }, undefined, PROFILE);
  const p = await c.newPage();
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  ok('geo: nothing is requested on load', /Sin punto de partida/.test(await p.textContent('[data-origin-status]')));
  await p.click('[data-origin-locate]');
  await p.waitForFunction(() => /Usando tu ubicación actual/.test(document.querySelector('[data-origin-status]').textContent), null, { timeout: 15000 });
  const list = await cards(p);
  ok('geo: recommendations use the position', list.some((x) => /km en línea recta de tu punto de partida/.test(x.text)));
  const store = await p.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  ok('geo: the position is in no storage', !/22\.03|99\.15/.test(store));
  await c.close();
});

await step('descubre: location denied → manual origin', async () => {
  const { c } = await ctxFor(390, 844, { permissions: [], isMobile: true, hasTouch: true }, undefined, PROFILE);
  const p = await c.newPage(); const errs = watch(p);
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  await p.click('[data-origin-locate]');
  await p.waitForFunction(() => /elige un municipio de partida/.test(document.querySelector('[data-origin-status]').textContent), null, { timeout: 15000 });
  ok('denied: the page says so and offers a municipality', true, (await p.textContent('[data-origin-status]')).trim());
  ok('denied: recommendations still listed', (await cards(p)).length > 0);
  await p.selectOption('[data-origin-select]', { label: 'Rioverde' });
  await p.waitForFunction(() => /Saliendo de Rioverde/.test(document.querySelector('[data-origin-status]').textContent));
  ok('denied: manual origin gives distances', (await cards(p)).some((x) => /km en línea recta/.test(x.text)));
  ok('denied: no horizontal overflow at 390 px', (await overflow(p)) <= 0, String(await overflow(p)));
  ok('denied: no console errors', errs.length === 0, errs.join(' | '));
  await shot(p, 'descubre-phone');
  await c.close();
});

await step('descubre: position unavailable', async () => {
  const { c } = await ctxFor(1440, 900, {}, undefined, PROFILE);
  await c.addInitScript(() => { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_ok, err) => setTimeout(() => err({ code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }), 30), watchPosition: () => 1, clearWatch: () => {} } }); });
  const p = await c.newPage();
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  await p.click('[data-origin-locate]');
  await p.waitForFunction(() => /No fue posible obtener tu ubicación|elige un municipio/.test(document.querySelector('[data-origin-status]').textContent), null, { timeout: 20000 });
  ok('unavailable: calm message, list intact', (await cards(p)).length > 0, (await p.textContent('[data-origin-status]')).trim());
  await c.close();
});

await step('descubre: weather fails → score without weather', async () => {
  const { c } = await ctxFor(1440, 900, {}, { routing: 'ok', weather: 'fail', calls: [] }, PROFILE);
  const p = await c.newPage(); const errs = watch(p);
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  const list = await cards(p);
  ok('no weather: status says it is not used', /clima actual no disponible: no se usa en el puntaje/.test(await p.textContent('[data-status]')));
  ok('no weather: recommendations still ranked', list.length > 0 && list.every((x) => x.score > 0));
  ok('no weather: no card mentions current weather', list.every((x) => !/clima actual (compatible|puede)/i.test(x.text)));
  ok('no weather: no console errors', errs.length === 0, errs.join(' | '));
  await c.close();
});

await step('descubre: rain changes outdoor suggestions and says why', async () => {
  const { c } = await ctxFor(1440, 900, {}, { routing: 'ok', weather: 'rain', calls: [] }, PROFILE);
  const p = await c.newPage();
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  ok('rain: outdoor cards carry the weather warning', (await cards(p)).some((x) => /El clima actual puede afectar esta experiencia/.test(x.text)));
  await c.close();
});

await step('descubre: privacy controls', async () => {
  const { c } = await ctxFor(1440, 900, {}, undefined, PROFILE);
  const p = await c.newPage();
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  ok('privacy: saved profile is restored', (await p.getAttribute('[data-int="agua"]', 'aria-pressed')) === 'true');
  await p.click('[data-clear-profile]');
  ok('privacy: «Borrar mis preferencias» removes the profile', (await p.evaluate(() => localStorage.getItem('slp:perfil:v1'))) === null && (await p.getAttribute('[data-int="agua"]', 'aria-pressed')) === 'false');
  await p.click('[data-clear-log]');
  ok('privacy: «Borrar el registro local» empties the log', (await p.evaluate(() => localStorage.getItem('slp:analitica:v1'))) === null);
  await c.close();
});

await step('descubre: keyboard', async () => {
  const { c } = await ctxFor(1440, 900);
  const p = await c.newPage();
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  await p.focus('[data-int="naturaleza"]');
  await p.keyboard.press('Space');
  ok('keyboard: an interest toggles with Space', (await p.getAttribute('[data-int="naturaleza"]', 'aria-pressed')) === 'true');
  const outline = await p.evaluate(() => { const el = document.querySelector('[data-int="naturaleza"]'); const s = getComputedStyle(el); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; });
  ok('keyboard: focus is visible', outline);
  await c.close();
});

await step('descubre: tablet layout', async () => {
  const { c } = await ctxFor(820, 1180, {}, undefined, PROFILE);
  const p = await c.newPage();
  await p.goto(`${BASE}/descubre/`, { waitUntil: 'networkidle' });
  await ready(p);
  ok('tablet: no horizontal overflow at 820 px', (await overflow(p)) <= 0, String(await overflow(p)));
  await shot(p, 'descubre-tablet');
  await c.close();
});

// ============================================================================== Mi Ruta ==
const ROUTE = { 'slp:mi-ruta:v1': ['C01', 'H17'], ...PROFILE, 'slp:perfil:v1': { interests: ['naturaleza', 'agua', 'historia'], duration: 'weekend', mode: 'car', budget: 'medio' } };
const nearCards = (p) => cards(p, '[data-near-list] [data-reco]');
const nearReady = (p) => p.waitForFunction(() => document.querySelectorAll('[data-near-list] [data-reco]').length > 0, null, { timeout: 20000 });

await step('mi-ruta: route → places near the corridor', async () => {
  const { c, state } = await ctxFor(1440, 900, {}, undefined, ROUTE);
  const p = await c.newPage(); const errs = watch(p);
  await p.goto(`${BASE}/mi-ruta/`, { waitUntil: 'networkidle' });
  await nearReady(p);
  const list = await nearCards(p);
  ok('near: cards appear once a route exists', list.length > 0 && list.length <= 5, `${list.length} cards`);
  ok('near: each card states an estimated extra time and a distance to the route', list.every((x) => /≈ \+\d+ min estimados · a (menos de 1|\d+) km de tu ruta/.test(x.text)));
  ok('near: each card says why and how sure', list.every((x) => /Por qué te lo recomendamos/.test(x.text) && /Evidencia (alta|media|baja)/.test(x.text)));
  ok('near: saved stops are not suggested', !list.some((x) => x.id === 'C01' || x.id === 'H17'));
  ok('near: the lede says the time is an estimate', /es una estimación a partir de la distancia a la ruta/.test(await p.textContent('[data-near-lede]')));
  ok('near: rendering asked the provider for nothing extra', state.calls.filter((k) => k === 'table').length === 0 && state.calls.filter((k) => k === 'route').length === 1, state.calls.join(','));
  ok('near: the unscored «cerca de tu ruta» rows are replaced', (await p.$$eval('[data-recos-list] li[data-kind="near-route"]', (els) => els.filter((e) => getComputedStyle(e).display !== 'none').length)) === 0);
  ok('near: no console errors', errs.length === 0, errs.join(' | '));
  await p.locator('[data-near]').scrollIntoViewIfNeeded();
  await shot(p, 'mi-ruta-near-desktop');

  // ---- measure by road: exactly one matrix request --------------------------------------------
  await p.click('[data-near-measure]');
  await p.waitForFunction(() => /por carretera \(ida y vuelta/.test(document.querySelector('[data-near-list]').textContent), null, { timeout: 20000 });
  ok('measure: one matrix request for all cards', state.calls.filter((k) => k === 'table').length === 1, state.calls.join(','));
  ok('measure: cards now say «por carretera» and the note names the provider and no live traffic', /Sin tráfico en tiempo real/.test(await p.textContent('[data-near-note]')));

  // ---- add: the stop goes where the route passes ---------------------------------------------------
  const first = (await nearCards(p))[0];
  await p.click('[data-near-list] [data-reco] [data-route-add]');
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('slp:mi-ruta:v1')).length === 3);
  await p.waitForTimeout(100);
  const order = await p.evaluate(() => JSON.parse(localStorage.getItem('slp:mi-ruta:v1')));
  ok('add from route: inserted between the stops it lies between', order[0] === 'C01' && order[2] === 'H17' && order[1] === first.id, order.join(' → '));
  await p.waitForFunction(() => document.querySelectorAll('[data-mr-list] li[data-region]').length === 3, null, { timeout: 15000 });
  ok('add from route: Mi Ruta lists three stops', true);
  await c.close();
});

await step('mi-ruta: routing provider down', async () => {
  const { c } = await ctxFor(1440, 900, {}, { routing: '500', weather: 'ok', calls: [] }, ROUTE);
  const p = await c.newPage(); const errs = watch(p);
  await p.goto(`${BASE}/mi-ruta/`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => /No fue posible calcular/.test(document.querySelector('[data-plan-summary]').textContent), null, { timeout: 20000 });
  await p.waitForFunction(() => /Sin una ruta calculada/.test(document.querySelector('[data-near-lede]').textContent), null, { timeout: 15000 });
  ok('provider down: saved places still listed', (await p.$$('[data-mr-list] li[data-region]')).length === 2);
  ok('provider down: no corridor cards and no fabricated detour', (await nearCards(p)).length === 0 && !/\+\d+ min/.test(await p.textContent('[data-near]')));
  ok('provider down: the page explains it', /no estimamos desvíos ni distancias por carretera/.test(await p.textContent('[data-near-lede]')));
  ok('provider down: no uncaught errors', errs.length === 0, errs.join(' | '));
  await c.close();
});

await step('mi-ruta: offline after the route was computed', async () => {
  const { c } = await ctxFor(1440, 900, {}, undefined, ROUTE);
  const p = await c.newPage();
  await p.goto(`${BASE}/mi-ruta/`, { waitUntil: 'networkidle' });
  await nearReady(p);
  const before = (await nearCards(p)).map((x) => x.id).join();
  await c.setOffline(true);
  await p.evaluate(() => window.dispatchEvent(new Event('offline')));
  await p.waitForTimeout(600);
  ok('offline: the route summary stays', /km/.test(await p.textContent('[data-plan-summary]')));
  ok('offline: the nearby places stay', (await nearCards(p)).map((x) => x.id).join() === before);
  await c.setOffline(false);
  await c.close();
});

await step('mi-ruta: phone', async () => {
  const { c } = await ctxFor(390, 844, { isMobile: true, hasTouch: true }, undefined, ROUTE);
  const p = await c.newPage(); const errs = watch(p);
  await p.goto(`${BASE}/mi-ruta/`, { waitUntil: 'networkidle' });
  await nearReady(p);
  ok('phone: no horizontal overflow at 390 px', (await overflow(p)) <= 0, String(await overflow(p)));
  const tap = await p.$$eval('[data-near] button, [data-near] a.arrow', (els) => els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)));
  ok('phone: touch targets in the section are at least 40 px', tap.every((h) => h >= 40), tap.join(' '));
  ok('phone: no console errors', errs.length === 0, errs.join(' | '));
  await p.locator('[data-near]').scrollIntoViewIfNeeded();
  await shot(p, 'mi-ruta-near-phone');
  await c.close();
});

// @@MORE@@

await browser.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED:\n' + failed.map((f) => `  ${f.name}  ${f.info}`).join('\n')); process.exitCode = 1; }
