// Full-portal review screenshots (scrollcraft/lab/full-portal-review/), plus
// basic checks per page: HTTP 200, no horizontal overflow, no console errors,
// no broken images. Pages are clipped to their first ~2,800 px (long pages
// crash full-page capture); menu states are viewport shots.
//   node scripts/verify/portal-shots.mjs [--url http://127.0.0.1:4321]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/full-portal-review'));
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const problems = [];

async function open(url, w, h) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h ?? (phone ? 844 : 900) }, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; Element.prototype.setPointerCapture = () => {}; });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 140)));
  const res = await p.goto(BASE + url, { waitUntil: 'networkidle' });
  // reveal-on-scroll and lazy images: walk the page once
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    for (let y = 0; y < Math.min(document.body.scrollHeight, 6000); y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 160)); }
    await Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(700);
  const check = await p.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src')).slice(0, 3),
  }));
  if (res?.status() !== 200) problems.push(`${url} @${w}: HTTP ${res?.status()}`);
  if (check.overflow) problems.push(`${url} @${w}: horizontal overflow`);
  if (check.broken.length) problems.push(`${url} @${w}: broken images ${check.broken.join(', ')}`);
  if (errs.length) problems.push(`${url} @${w}: console ${errs.join(' | ')}`);
  return p;
}
async function pageShot(name, url, w = 1440, maxH = 2800) {
  const p = await open(url, w);
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: w, height: Math.min(h, maxH) } , fullPage: true });
  console.log(name);
  await p.context().close();
}
async function menuShot(name, w, steps) {
  const p = await open('/', w);
  await p.click('[data-menu-open]');
  await p.waitForTimeout(450);
  for (const s of steps) { await p.click(`[data-menu-panel]:not([hidden]) [data-menu-go="${s}"]`); await p.waitForTimeout(300); }
  await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 76 });
  console.log(name);
  await p.context().close();
}

await pageShot('01-home-desktop', '/', 1440, 2400);
await menuShot('02-menu-level-1', 1440, []);
await menuShot('03-menu-things-to-do', 1440, ['que-hacer']);
await menuShot('04-menu-tradition', 1440, ['que-hacer', 'td-cultura']);
await pageShot('05-regions', '/regiones/huasteca/');
await pageShot('06-municipality-example', '/municipios/xilitla/');
await pageShot('06b-municipality-small', '/municipios/villa-de-guadalupe/');
await pageShot('07-destination-example', '/destinos/las-pozas/');
await pageShot('08-things-to-do', '/que-hacer/');
await pageShot('08b-things-to-do-culture', '/que-hacer/cultura/');
await pageShot('09-experiences', '/experiencias/');
await pageShot('09b-experience-page', '/experiencias/remar-el-tampaon-hasta-tamul/');
await pageShot('10-events-calendar', '/eventos/');
await pageShot('10b-event-page', '/eventos/xantolo/');
await pageShot('11-archaeology', '/arqueologia/');
await pageShot('11b-archaeology-tamtoc', '/arqueologia/tamtoc/');
await pageShot('12-museums', '/museos/');
await pageShot('13-lodging', '/hospedaje/');
await pageShot('13b-food', '/gastronomia/');
await pageShot('14-guides', '/guias/');
await pageShot('15-planning', '/planea/');
await pageShot('15b-municipalities-index', '/municipios/');
await pageShot('15c-search', '/buscar/?q=cascada');
await menuShot('16-mobile-menu', 390, ['destinos', 'municipios']);
await pageShot('17-mobile-municipality', '/municipios/xilitla/', 390, 3200);
await pageShot('18-mobile-things-to-do', '/que-hacer/', 390, 3200);
await pageShot('19-mobile-430-events', '/eventos/', 430, 2600);
await browser.close();
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nno problems');
