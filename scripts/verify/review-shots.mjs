// Review screenshots for the visual refinement pass (pass 3). Captures the
// states asked for in the review: hero, header brand, interests, a filtered
// interest view, experiences, Temporadas in January and November, and the
// regional palettes (home regions, a region page, a destination page).
//   node scripts/verify/review-shots.mjs [--url http://127.0.0.1:4321] [--out scrollcraft/lab/review-pass3]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/review-pass3'));
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];
async function page(w, url) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; Element.prototype.setPointerCapture = () => {}; });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${url} ${w}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`${url} ${w}: ${m.text().slice(0, 160)}`));
  await p.goto(BASE + url, { waitUntil: 'networkidle' });
  return p;
}
const eager = (p, sel) => p.locator(sel).first().evaluate((n) => n.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager')));
async function shot(p, sel, name, { hideChrome = true } = {}) {
  if (hideChrome) await p.addStyleTag({ content: '.hdr, .subnav, .skip, .toast { visibility: hidden !important; }' });
  const el = p.locator(sel).first();
  // walk through the section so scroll reveals fire, then come back to its top
  await el.evaluate(async (n) => { const r = n.getBoundingClientRect(); for (let y = 0; y < r.height; y += 400) { window.scrollTo(0, window.scrollY + r.top + y); await new Promise((ok) => setTimeout(ok, 120)); } });
  await el.scrollIntoViewIfNeeded();
  await eager(p, sel);
  await p.waitForTimeout(1100);
  const file = path.join(OUT, `${name}.jpg`);
  await el.screenshot({ path: file, type: 'jpeg', quality: 76 });
  console.log(file);
}

for (const w of [1440, 390]) {
  // 1 hero and 7 header brand (viewport shots, chrome visible)
  let p = await page(w, '/');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(OUT, `01-hero-${w}.jpg`), type: 'jpeg', quality: 76 });
  await p.locator('.hdr').first().screenshot({ path: path.join(OUT, `07-header-${w}.jpg`), type: 'jpeg', quality: 86 });
  // header on a light page (solid header)
  const q = await page(w, '/temporadas/');
  await q.locator('.hdr').first().screenshot({ path: path.join(OUT, `07-header-solid-${w}.jpg`), type: 'jpeg', quality: 86 });
  await q.context().close();

  // 2 interests, 3 filtered view (Cascadas y agua selected → results rail)
  await shot(p, '#intereses .ints__head', `02-intereses-head-${w}`);
  await shot(p, '#ints-track', `02-intereses-cards-${w}`);
  await p.locator('[data-interest="arte"]').first().click();
  await p.waitForTimeout(500);
  await shot(p, '#ints-results', `03-intereses-filtrado-arte-${w}`);

  // 4 experiences
  await shot(p, '#experiencias', `04-experiencias-${w}`);

  // 5, 6 temporadas in January and November
  for (const [m, label] of [[1, 'enero'], [11, 'noviembre'], [6, 'junio'], [7, 'julio']]) {
    await p.locator(`#temporadas [data-season-month="${m}"]`).first().click();
    await p.waitForTimeout(500);
    await shot(p, '#temporadas .season', `${m === 1 ? '05' : m === 11 ? '06' : '06b'}-temporadas-${label}-${w}`);
  }

  // 8 regional palettes: home regions, region pages, a destination
  await shot(p, '#regiones', `08-regiones-home-${w}`);
  await p.context().close();
  for (const [url, sel, name] of [
    ['/regiones/huasteca/', '#cultura', 'region-huasteca-cultura'],
    ['/regiones/altiplano/', '.reasons', 'region-altiplano-razones'],
    ['/regiones/zona-media/', '#temporadas', 'region-zona-media-temporadas'],
    ['/regiones/centro/', '#mapa', 'region-centro-mapa'],
  ]) {
    const r = await page(w, url);
    if (await r.locator(sel).count()) await shot(r, sel, `08-${name}-${w}`);
    await r.context().close();
  }
}
await browser.close();
console.log(errors.length ? `\nconsole errors:\n${errors.join('\n')}` : '\nno console errors');
