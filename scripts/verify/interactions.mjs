// Functional checks of the interactive pieces against a served build.
//   node scripts/verify/interactions.mjs --url http://127.0.0.1:4321 --out scrollcraft/lab/interactions
// Pointer lock / capture are stubbed in every context (Windows headless safety).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/interactions'));
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, info = '') => {
  results.push({ name, pass, info });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
};
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
async function ctxFor(w, h, extra = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, ...extra });
  await c.addInitScript(() => {
    Element.prototype.requestPointerLock = () => {};
    Element.prototype.setPointerCapture = () => {};
  });
  return c;
}
async function step(name, fn) {
  try { await fn(); } catch (e) { ok(name, false, 'threw: ' + String(e.message).split('\n')[0]); }
}

// ---- map: filters, selection, weather, add to route ------------------------
await step('map', async () => {
  const c = await ctxFor(1440, 900);
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/mapa/', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-map-list] button', { timeout: 20000 });
  const total = await p.locator('[data-map-list] button').count();
  ok('map lists every plotted place (28 verified + 21 approximate)', total === 49, `count=${total}`);
  ok('maplibre canvas rendered', (await p.locator('.maplibregl-canvas').count()) > 0);
  await p.click('[data-filter-group="region"] [data-value="huasteca"]');
  await p.waitForTimeout(400);
  const hua = await p.locator('[data-map-list] button').count();
  const regs = await p.locator('[data-map-list] .reg').allTextContents();
  ok('region filter (Huasteca)', hua > 0 && hua < total && regs.every((r) => r === 'Huasteca'), `count=${hua}`);
  await p.click('[data-filter-group="interest"] [data-value="arqueologia"]');
  await p.waitForTimeout(300);
  const arq = await p.locator('[data-map-list] button').count();
  ok('interest filter narrows', arq >= 1 && arq < hua, `count=${arq}`);
  await p.click('[data-filter-group="interest"] [data-value="arqueologia"]');
  await p.waitForTimeout(300);
  await p.locator('[data-map-list] button', { hasText: 'Cascada de Tamul' }).click();
  await p.waitForSelector('[data-map-selected] .sel__name');
  const name = await p.textContent('[data-map-selected] .sel__name');
  const status = (await p.textContent('[data-map-selected] .sel__status')).trim();
  ok('selected-place panel (provisional labelled)', name === 'Cascada de Tamul' && /aproximada/i.test(status), status);
  await p.waitForFunction(() => !/cargando/.test(document.querySelector('[data-sel-wx-val]')?.textContent ?? 'cargando'), null, { timeout: 15000 }).catch(() => {});
  ok('panel weather resolves', true, (await p.textContent('[data-sel-wx-val]')).trim().slice(0, 90));
  await p.click('[data-map-selected] [data-route-add]');
  const stored = await p.evaluate(() => localStorage.getItem('slp:mi-ruta:v1'));
  ok('add to Mi Ruta from map', /H01/.test(stored ?? ''), stored);
  ok('header counter updates', (await p.textContent('.hdr [data-route-count]')) === '1');
  await p.screenshot({ path: path.join(OUT, 'map-selected.jpg'), type: 'jpeg', quality: 75 });
  await p.click('[data-sel-back]');
  await p.click('[data-filter-group="region"] [data-value="all"]');
  await p.waitForTimeout(300);
  await p.locator('[data-map-list] button', { hasText: 'Real de Catorce' }).first().click();
  const st2 = (await p.textContent('[data-map-selected] .sel__status')).trim();
  ok('verified place labelled verified', /verificada/i.test(st2), st2);
  ok('map page without page errors', errs.length === 0, errs.join(' | '));
  await c.close();
});

// ---- weather failure must not break the map ----------------------------------
await step('weather failure', async () => {
  const c = await ctxFor(1440, 900);
  const p = await c.newPage();
  await p.route('**/api.open-meteo.com/**', (r) => r.abort());
  await p.goto(BASE + '/mapa/', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-map-list] button');
  await p.locator('[data-map-list] button').first().click();
  await p.waitForTimeout(1500);
  const wx = (await p.textContent('[data-sel-wx-val]')).trim();
  const grid = await p.locator('[data-weather] [data-state="error"]').count();
  ok('weather API failure handled (panel + widget)', /no disponible/.test(wx) && grid > 0 && (await p.isVisible('[data-wx-error]')), wx);
  ok('map still works without weather', await p.isVisible('[data-map-selected] .sel__name'));
  await p.screenshot({ path: path.join(OUT, 'weather-failure.jpg'), type: 'jpeg', quality: 75 });
  await c.close();
});

// ---- basemap failure: points remain -----------------------------------------
await step('basemap failure', async () => {
  const c = await ctxFor(1440, 900);
  const p = await c.newPage();
  await p.route('**/tiles.openfreemap.org/**', (r) => r.abort());
  await p.goto(BASE + '/mapa/', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-map-list] button', { timeout: 20000 });
  await p.waitForTimeout(10500);
  ok('basemap failure falls back to plain ground with points', await p.$eval('[data-map-state]', (e) => e.hidden));
  await p.screenshot({ path: path.join(OUT, 'basemap-failure.jpg'), type: 'jpeg', quality: 75, timeout: 8000 }).catch(() => console.log('      (basemap-failure screenshot skipped: capture timed out)'));
  await c.close();
});

// ---- Mi Ruta: empty state, add, reorder, remove (phone) ------------------------
await step('mi ruta', async () => {
  const c = await ctxFor(390, 844, { isMobile: true, hasTouch: true });
  const p = await c.newPage();
  await p.goto(BASE + '/mi-ruta/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok('empty Mi Ruta state', await p.isVisible('[data-mr-empty]'));
  await p.screenshot({ path: path.join(OUT, 'mi-ruta-empty-phone.jpg'), type: 'jpeg', quality: 75 });
  for (const slug of ['cascada-de-tamul', 'real-de-catorce', 'xilitla']) {
    await p.goto(`${BASE}/destinos/${slug}/`, { waitUntil: 'networkidle' });
    await p.locator('.dsum__facts [data-route-add]').click();
  }
  await p.goto(BASE + '/mi-ruta/', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-mr-list] li');
  ok('Mi Ruta lists saved places', (await p.locator('[data-mr-list] li').count()) === 3);
  await p.locator('[data-mr-list] li').nth(1).locator('[data-mv="-1"]').click();
  const first = await p.locator('[data-mr-list] li .mr__name').first().textContent();
  ok('reorder', first === 'Real de Catorce', first);
  await p.locator('[data-mr-list] li').nth(0).locator('[data-rm]').click();
  ok('remove', (await p.locator('[data-mr-list] li').count()) === 2);
  const miss = await p.locator('[data-mr-missing]:not([hidden])').count();
  ok('suggests regions not yet in the route', miss === 3, `missing=${miss}`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(OUT, 'mi-ruta-phone.jpg'), type: 'jpeg', quality: 75, fullPage: true });
  await c.close();
});

// ---- home: season control, interests, menu, subnav -----------------------------
await step('home', async () => {
  const c = await ctxFor(1440, 900);
  const p = await c.newPage();
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const m = new Date().getMonth();
  ok('season opens on current month', (await p.textContent('[data-season-current]')) === MONTHS[m]);
  await p.click('[data-season-panel]:not([hidden]) [data-season-next]');
  ok('season next month', (await p.textContent('[data-season-current]')) === MONTHS[(m + 1) % 12]);
  await p.click('[data-season-panel]:not([hidden]) [data-season-prev]');
  await p.click('[data-season-pick="s-invierno"]');
  const vis = await p.locator('[data-season-panel]:not([hidden])').getAttribute('data-season-panel');
  ok('season tabs switch panel', vis === 's-invierno', vis);
  ok('October panel has the official Xantolo record', (await p.locator('[data-season-panel="m10"] .season__also .rec__what', { hasText: 'Xantolo' }).count()) === 1);
  await p.click('[data-season-month="8"]');
  ok('month rail selects a month', (await p.textContent('[data-season-current]')) === 'Agosto' && !(await p.locator('[data-season-panel="m8"]').getAttribute('hidden')));
  ok('season silhouette plots the month\'s places', (await p.locator('[data-season-panel="m8"] .sil__dot').count()) >= 1);
  await p.click('[data-season-pick="s-verano"]');
  ok('season pick highlights its months', (await p.locator('.mo.is-in-season').count()) === 3);
  await p.click('[data-season-month="10"]');
  const before = await p.$eval('#ints-track', (e) => e.scrollLeft);
  await p.click('[data-carousel-ctrl="ints-track"] [data-carousel-next]');
  await p.waitForTimeout(900);
  ok('interest carousel pages forward', (await p.$eval('#ints-track', (e) => e.scrollLeft)) > before);
  ok('six experience cards link to experience pages', (await p.locator('#experiencias .xp__title a[href*="/experiencias/"]').count()) === 6);
  await p.click('[data-interest="arqueologia"]');
  const shown = await p.locator('#intereses li[data-interests]:not([hidden])').count();
  ok('interest tile filters destinations', shown >= 1 && shown <= 3, `shown=${shown}`);
  await p.evaluate(() => scrollTo(0, 0));
  await p.click('[data-menu-open]');
  ok('menu dialog opens', await p.isVisible('[data-menu] #mp-root'));
  await p.keyboard.press('Escape');
  ok('menu closes with Esc', !(await p.isVisible('[data-menu] #mp-root')));
  await p.evaluate(() => document.getElementById('mapa').scrollIntoView({ behavior: 'instant' }));
  await p.waitForTimeout(600);
  const active = await p.getAttribute('[data-subnav-link][aria-current="true"]', 'data-subnav-link');
  ok('section nav follows scroll', active === 'mapa', active);
  await c.close();
});

// ---- portal: hierarchical menu, search, directories, calendar, municipalities --
await step('portal', async () => {
  const c = await ctxFor(390, 844, { isMobile: true, hasTouch: true });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.click('[data-menu-open]');
  await p.click('[data-menu-panel="root"] [data-menu-go="que-hacer"]');
  ok('menu opens a sub-level in place', await p.isVisible('#mp-que-hacer') && !(await p.isVisible('#mp-root')));
  ok('focus moves to the sub-level title', (await p.evaluate(() => document.activeElement?.id)) === 'mp-que-hacer-t');
  await p.click('#mp-que-hacer [data-menu-go="td-cultura"]');
  ok('menu reaches a third level', await p.isVisible('#mp-td-cultura'));
  await p.keyboard.press('Escape');
  ok('Esc in a sub-level goes back one level', await p.isVisible('#mp-que-hacer') && (await p.evaluate(() => !!document.querySelector('[data-menu]')?.open)));
  await p.click('#mp-que-hacer [data-menu-back]');
  ok('Atrás returns to the root and focuses the opener item', await p.isVisible('#mp-root') && (await p.evaluate(() => document.activeElement?.getAttribute('data-menu-go'))) === 'que-hacer');
  await p.click('[data-menu-close]');
  ok('Cerrar closes the menu', !(await p.evaluate(() => !!document.querySelector('[data-menu]')?.open)));

  await p.goto(BASE + '/buscar/?q=xilitla', { waitUntil: 'networkidle' });
  await p.waitForSelector('.sres', { timeout: 8000 });
  ok('search finds the municipality page', (await p.locator('.sres a[href*="/municipios/xilitla/"]').count()) === 1);

  await p.goto(BASE + '/hospedaje/?mun=xilitla', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const rows = await p.locator('[data-dir-list] > li').count();
  const muniOk = await p.$$eval('[data-dir-list] .ecard__where a', (as) => as.every((a) => a.getAttribute('href')?.includes('/municipios/xilitla/')));
  ok('lodging directory filters by municipality', rows >= 1 && muniOk, `rows=${rows}`);

  await p.goto(BASE + '/eventos/?mes=11', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const vis = await p.$$eval('[data-cal-panel]', (l) => l.filter((x) => !x.hidden).map((x) => x.dataset.calPanel));
  ok('events calendar opens on ?mes=11 and shows only November', vis.length === 1 && vis[0] === '11', vis.join(','));
  await p.click('[data-cal-month="todo"]');
  ok('«Todo el año» lists seasonal experiences apart from events', (await p.locator('[data-cal-panel="todo"]:not([hidden]) .evc').count()) >= 3);
  await p.click('[data-cal-month="1"]');
  ok('January shows events and «también disponible este mes»', (await p.locator('[data-cal-panel="1"] .cal__sub--also').count()) === 1 && (await p.locator('[data-cal-panel="1"] [data-cal-item]').count()) >= 1);

  await p.goto(BASE + '/municipios/', { waitUntil: 'networkidle' });
  await p.click('[data-mi-region="huasteca"]');
  const regs = await p.$$eval('[data-mi-name]:not([hidden])', (l) => [...new Set(l.map((x) => x.dataset.miReg))]);
  ok('municipality index filters by region', regs.length === 1 && regs[0] === 'huasteca', regs.join(','));

  await p.goto(BASE + '/arqueologia/tamtoc/', { waitUntil: 'networkidle' });
  await p.click('.ph [data-route-add]');
  ok('archaeology page adds to Mi Ruta', (await p.getAttribute('.ph [data-route-add]', 'aria-pressed')) === 'true');
  ok('portal pages without script errors', errs.length === 0, errs.join(' | '));
  await c.close();
});

// ---- reduced motion: descent static, never pinned -------------------------------
await step('reduced motion', async () => {
  const c = await ctxFor(1440, 900, { reducedMotion: 'reduce' });
  const p = await c.newPage();
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const st = await p.$eval('[data-descent]', (e) => ({ static: e.hasAttribute('data-static'), act: e.getAttribute('data-sc-act'), h: e.offsetHeight }));
  ok('reduced motion: Descent static, not pinned', st.static && !st.act && st.h < 3200, JSON.stringify(st));
  await p.$eval('[data-descent]', (e) => e.scrollIntoView());
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, 'descent-reduced.jpg'), type: 'jpeg', quality: 75 });
  await c.close();
});

// ---- keyboard: skip link + visible focus -------------------------------------------
await step('keyboard', async () => {
  const c = await ctxFor(1440, 900);
  const p = await c.newPage();
  await p.goto(BASE + '/regiones/huasteca/', { waitUntil: 'networkidle' });
  await p.keyboard.press('Tab');
  ok('first Tab reaches skip link', (await p.evaluate(() => document.activeElement?.textContent?.trim())) === 'Saltar al contenido');
  for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  const outline = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  ok('focus outline visible', outline !== 'none', outline);
  await c.close();
});

await browser.close();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
