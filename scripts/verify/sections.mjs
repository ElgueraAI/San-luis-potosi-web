// Element screenshots of named sections at several widths, for visual review.
//   node scripts/verify/sections.mjs --path / --sel "#intereses,#temporadas" --widths 1440,768,390 --out scrollcraft/lab/sections
// Output is git-ignored (scrollcraft/lab/).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const PATH = arg('--path', '/');
const SEL = arg('--sel', '#intereses').split(',');
const WIDTHS = arg('--widths', '1440,390').split(',').map(Number);
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/sections'));
const TAG = arg('--tag', '');
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const w of WIDTHS) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; Element.prototype.setPointerCapture = () => {}; });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  await p.goto(BASE + PATH, { waitUntil: 'networkidle' });
  // fixed chrome would be painted over every element shot
  await p.addStyleTag({ content: '.hdr, .subnav, .skip, .toast { visibility: hidden !important; }' });
  for (const s of SEL) {
    const el = p.locator(s).first();
    await el.scrollIntoViewIfNeeded();
    // let lazy images inside the section load
    await el.evaluate((n) => n.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager')));
    await p.waitForTimeout(900);
    const file = path.join(OUT, `${s.replace(/[^a-z0-9-]/gi, '')}-${w}${TAG ? '-' + TAG : ''}.jpg`);
    await el.screenshot({ path: file, type: 'jpeg', quality: 72 });
    console.log(file);
  }
  if (errs.length) console.log(`  ${w}px errors:`, errs.join(' | '));
  await ctx.close();
}
await browser.close();
