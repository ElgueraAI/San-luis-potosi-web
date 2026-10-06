// Reproduces / guards the Temporadas sticky-photo overflow: scrolls through the
// whole season module and records, at each step, whether the lead photograph
// overlaps the block below the stage (fiestas, clima, mesa) or leaves the module.
//   node scripts/verify/season-overflow.mjs [--path /] [--month 10] [--shots]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const PAGE = arg('--path', '/');
const MONTHS = arg('--month', '10').split(',');
const SHOTS = argv.includes('--shots');
const OUT = path.resolve('scrollcraft/lab/refinement-pass');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const sizes = [[1440, 900], [1536, 864], [1920, 1080], [390, 844], [430, 932]];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let bad = 0;
for (const MONTH of MONTHS) for (const [w, h] of sizes) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone });
  const p = await ctx.newPage();
  await p.goto(BASE + PAGE, { waitUntil: 'networkidle' });
  await p.locator(`#temporadas [data-season-month="${MONTH}"], [data-season] [data-season-month="${MONTH}"]`).first().click();
  await p.waitForTimeout(400);
  const range = await p.evaluate((m) => {
    const box = document.querySelector('[data-season]');
    const r = box.getBoundingClientRect();
    return { top: r.top + scrollY, bottom: r.bottom + scrollY, m };
  }, MONTH);
  let worst = 0, escaped = 0, samples = 0;
  for (let y = range.top - h * 0.3; y <= range.bottom; y += 120) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await p.waitForTimeout(40);
    const r = await p.evaluate((m) => {
      const panel = document.querySelector(`[data-season-panel="m${m}"]`);
      const photo = panel.querySelector('.season__photo, .season__frame');
      const below = [panel.querySelector('.season__geo'), panel.querySelector('.season__more')].filter(Boolean).map((n) => n.getBoundingClientRect());
      const stage = (panel.querySelector('.season__stage') ?? document.querySelector('[data-season]')).getBoundingClientRect();
      const a = photo.getBoundingClientRect();
      const ov = (b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) * (a.right > b.left && a.left < b.right ? 1 : 0);
      return { overlap: Math.max(0, ...below.map(ov)), escaped: Math.max(0, a.bottom - stage.bottom - 0.5) };
    }, MONTH);
    worst = Math.max(worst, r.overlap); escaped = Math.max(escaped, r.escaped); samples++;
  }
  const fail = worst > 0 || escaped > 0;
  if (fail) bad++;
  console.log(`${fail ? 'FAIL' : 'PASS'}  m${MONTH}  ${w}x${h}  samples=${samples}  max overlap with geography/fiestas/clima=${Math.round(worst)}px  max escape below the stage=${Math.round(escaped)}px`);
  if (SHOTS && w === 1440 && MONTH === MONTHS[0]) {
    const name = (n) => path.join(OUT, n);
    const at = async (y, file) => { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(500); await p.screenshot({ path: name(file), type: 'jpeg', quality: 76 }); };
    await at(range.top - 80, `01-season-october-top.jpg`);
    await at(range.top + (range.bottom - range.top) * 0.45, `02-season-october-mid-scroll.jpg`);
    await at(range.bottom - h * 0.75, `03-season-october-bottom-boundary.jpg`);
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `\n${bad} viewport(s) with overlap` : '\nphoto stays inside the module at every size');
process.exit(bad ? 1 : 0);
