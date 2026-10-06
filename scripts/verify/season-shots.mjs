// Temporadas review (pass 4): screenshots of chosen months at desktop and
// phone width, plus per-month checks: distinct lead photograph, image loaded,
// title, monthly palette, map points, and no horizontal overflow.
//   node scripts/verify/season-shots.mjs [--url http://127.0.0.1:4321] [--out scrollcraft/lab/review-season-pass4]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/review-season-pass4'));
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });
const NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];
let fails = 0;
const ok = (name, cond, info = '') => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); };

async function open(w) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; Element.prototype.setPointerCapture = () => {}; });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${w}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`${w}: ${m.text().slice(0, 160)}`));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '.hdr, .subnav, .skip, .toast { visibility: hidden !important; }' });
  // load every lazy image in the module so checks and shots see real pixels
  await p.locator('#temporadas').evaluate((n) => n.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager')));
  return p;
}
async function pick(p, m) {
  await p.locator(`#temporadas [data-season-month="${m}"]`).first().click();
  await p.waitForTimeout(450);
  return p.evaluate((m) => {
    const box = document.querySelector('#temporadas [data-season]');
    const panel = box.querySelector(`[data-season-panel="m${m}"]`);
    const img = panel.querySelector('.season__frame img');
    return {
      visible: !panel.hidden,
      current: box.querySelector('[data-season-current]').textContent,
      stage: box.dataset.mtone,
      region: panel.dataset.stageTone,
      title: panel.querySelector('.story__title')?.textContent ?? '',
      src: img?.currentSrc ?? '',
      loaded: !!img && img.complete && img.naturalWidth > 0,
      dots: panel.querySelectorAll('.sil__dot').length,
      focus: [...panel.querySelectorAll('.season__places li.is-focus')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  }, m);
}
async function shoot(p, name) {
  const el = p.locator('#temporadas .season').first();
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(900);
  const file = path.join(OUT, `${name}.jpg`);
  await el.screenshot({ path: file, type: 'jpeg', quality: 78 });
  console.log('   ' + file);
}

// desktop: every month checked; five shot
const d = await open(1440);
const seen = new Map();
for (let m = 1; m <= 12; m++) {
  const r = await pick(d, m);
  const file = r.src.split('/').pop().split('.')[0];
  ok(`${NAMES[m - 1]}: panel visible and named`, r.visible && r.current.toLowerCase() === NAMES[m - 1]);
  ok(`${NAMES[m - 1]}: lead photo loaded`, r.loaded, file);
  ok(`${NAMES[m - 1]}: photo not used by another month`, !seen.has(file), seen.get(file) ?? '');
  seen.set(file, NAMES[m - 1]);
  ok(`${NAMES[m - 1]}: stage palette follows the month`, r.stage === r.region, `${r.region}`);
  ok(`${NAMES[m - 1]}: map has points`, r.dots >= 1, `${r.dots} · foco: ${r.focus.join(' | ')}`);
  ok(`${NAMES[m - 1]}: no overflow`, !r.overflow);
  console.log(`      «${r.title}»`);
  if ([1, 4, 6, 7, 10, 11, 12].includes(m)) await shoot(d, `desktop-${String(m).padStart(2, '0')}-${NAMES[m - 1]}`);
}
await d.context().close();

// phone: January and December
const ph = await open(390);
for (const m of [1, 12]) {
  const r = await pick(ph, m);
  ok(`phone ${NAMES[m - 1]}: photo loaded, no overflow`, r.loaded && !r.overflow);
  const order = await ph.evaluate((m) => {
    const panel = document.querySelector(`#temporadas [data-season-panel="m${m}"]`);
    const y = (s) => (panel.querySelector(s) ?? document.querySelector('#temporadas ' + s)).getBoundingClientRect().top;
    return [y('.season__photo'), y('.season__head'), y('.story'), y('.season__also'), y('.season__map')];
  }, m);
  ok(`phone ${NAMES[m - 1]}: photo → month → text → also → map`, order.every((v, i) => i === 0 || v > order[i - 1]), order.map(Math.round).join(' < '));
  await shoot(ph, `mobile-${String(m).padStart(2, '0')}-${NAMES[m - 1]}`);
}
await browser.close();
console.log(errors.length ? `\nconsole errors:\n${errors.join('\n')}` : '\nno console errors');
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
