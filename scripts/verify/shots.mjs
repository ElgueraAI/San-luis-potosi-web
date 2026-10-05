// Targeted screenshots of named moments (complements the Scroll Craft harness,
// which samples evenly). Positions are expressed inside an act's pinned travel.
//
//   node scripts/verify/shots.mjs --url http://127.0.0.1:4321/ --out scrollcraft/lab/moments \
//     [--width 1440 --height 900] [--reduced-motion] [--dpr 1]
//
// Output files are git-ignored (scrollcraft/lab/).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

const URL = arg('--url', 'http://127.0.0.1:4321/');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/moments'));
const W = +arg('--width', '1440'), H = +arg('--height', '900'), DPR = +arg('--dpr', '1');
const REDUCED = has('--reduced-motion');
const CHROME = [
  process.env.SCROLLCRAFT_CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => p && fs.existsSync(p));

// [label, selector, progress inside its pinned travel | 'top' for flow sections]
const moments = [
  ['hero-0', '[data-hero]', 0],
  ['hero-50', '[data-hero]', 0.5],
  ['hero-90', '[data-hero]', 0.9],
  ['intro', '#introduccion', 'top'],
  ['intro-line', '#introduccion', 'mid'],
  ['descent-00-altiplano', '[data-descent]', 0.12],
  ['descent-01-cut-centro', '[data-descent]', 0.2275],
  ['descent-02-centro', '[data-descent]', 0.32],
  ['descent-03-cut-media', '[data-descent]', 0.42],
  ['descent-04-media', '[data-descent]', 0.51],
  ['descent-05-cut-huasteca', '[data-descent]', 0.6125],
  ['descent-06-huasteca', '[data-descent]', 0.7],
  ['descent-07-drop', '[data-descent]', 0.88],
  ['descent-08-finale', '[data-descent]', 0.97],
  ['footer', 'footer', 'top'],
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, reducedMotion: REDUCED ? 'reduce' : 'no-preference' });
await page.addInitScript(() => {
  Element.prototype.requestPointerLock = () => Promise.reject(new Error('disabled'));
  Element.prototype.setPointerCapture = () => {};
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

for (const [label, sel, p] of moments) {
  const y = await page.evaluate(([sel, p]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const top = el.getBoundingClientRect().top + scrollY;
    if (p === 'top') return top - 60;
    if (p === 'mid') return top + el.offsetHeight / 2 - innerHeight / 2;
    return top + p * Math.max(el.offsetHeight - innerHeight, 0);
  }, [sel, p]);
  if (y === null) { console.log(`  ${label}: selector missing`); continue; }
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `${label}.png`) });
  const state = await page.evaluate(() => ({
    p: document.querySelector('[data-descent]')?.style.getPropertyValue('--sc-p'),
    line: document.documentElement.dataset.lineState,
    top: document.documentElement.dataset.chromeTop,
    x: document.documentElement.style.getPropertyValue('--slp-x'),
  }));
  console.log(`  ${label.padEnd(26)} y=${Math.round(y)} descent-p=${state.p} line=${state.line} chrome=${state.top} x=${state.x}`);
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
console.log(`horizontal overflow: ${overflow}px`);
console.log(errors.length ? `console errors:\n  ${errors.join('\n  ')}` : 'console errors: none');
await browser.close();
