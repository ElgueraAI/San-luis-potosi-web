// Screenshots 04–20 of the refinement pass (01–03 come from season-overflow --shots).
//   node scripts/verify/refinement-shots.mjs [--url http://127.0.0.1:4321]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve('scrollcraft/lab/refinement-pass');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const DESK = [1440, 900], PHONE = [390, 844];

async function open(url, [w, h]) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(BASE + url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  return p;
}
// scroll so the element's top sits `off` px below the viewport top
async function to(p, sel, off = 80) {
  await p.evaluate(([s, o]) => { const n = document.querySelector(s); if (n) window.scrollTo(0, n.getBoundingClientRect().top + scrollY - o); }, [sel, off]);
  await p.waitForTimeout(700);
}
async function shot(p, name) {
  await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
  console.log('wrote', name);
}
async function season(name, month, size) {
  const p = await open('/temporadas/', size);
  await p.locator(`[data-season] [data-season-month="${month}"]`).first().click();
  await p.waitForTimeout(500);
  await to(p, `[data-season-panel="m${month}"] .season__stage`, size[0] < 600 ? 60 : 90);
  await shot(p, name);
  await p.context().close();
}
async function events(name, mes, size, sel = '[data-cal-panel]:not([hidden])') {
  const p = await open(`/eventos/?mes=${mes}`, size);
  await to(p, sel, 90);
  await shot(p, name);
  await p.context().close();
}

await season('04-season-november', 11, DESK);
await season('05-season-december', 12, DESK);

let p = await open('/planea/', DESK);
await shot(p, '06-plan-hero');
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.45));
await p.waitForTimeout(700);
await shot(p, '07-plan-mid-page');
await p.context().close();

p = await open('/mapa/', DESK);
await shot(p, '08-map-hero');
await p.evaluate(() => { const h = document.querySelector('.mh'); window.scrollTo(0, h.getBoundingClientRect().bottom + scrollY - innerHeight * 0.4); });
await p.waitForTimeout(1200);
await shot(p, '09-map-map-transition');
await p.context().close();

p = await open('/planea/', DESK);
await to(p, '.wx__list', 190);
await p.waitForTimeout(1500);
await shot(p, '10-weather-cards');
await p.context().close();

await events('11-events-january', 1, DESK);
await events('12-events-february', 2, DESK);
await events('13-events-may', 5, DESK);
await events('14-events-november', 11, DESK);
await events('15-events-all-year', 'todo', DESK);

await season('16-season-mobile', 11, PHONE);
p = await open('/planea/', PHONE);
await p.evaluate(() => window.scrollTo(0, innerHeight * 0.9));
await p.waitForTimeout(700);
await shot(p, '17-plan-mobile');
await p.context().close();
p = await open('/mapa/', PHONE);
await shot(p, '18-map-mobile');
await p.context().close();
p = await open('/planea/', PHONE);
await to(p, '.wx__list', 150);
await p.waitForTimeout(1500);
await shot(p, '19-weather-mobile');
await p.context().close();
await events('20-events-mobile', 5, PHONE);

await browser.close();
