// Crop and enlarge a region of a local image using headless Edge (no image libraries needed).
// Usage: node research/scripts/crop.mjs <image> <x0> <y0> <x1> <y1> <out.png> [scale=2]
//   x0..y1 are fractions of the image (0..1). Output goes wherever <out.png> points (use research/raw/).
// Batch: node research/scripts/crop.mjs --batch <jobs.json>   ([{img,x0,y0,x1,y1,out,scale}])
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const EDGE = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p));

const args = process.argv.slice(2);
const jobs = args[0] === '--batch'
  ? JSON.parse(readFileSync(args[1], 'utf8'))
  : [{ img: args[0], x0: +args[1], y0: +args[2], x1: +args[3], y1: +args[4], out: args[5], scale: +(args[6] ?? 2) }];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage();
for (const j of jobs) {
  const buf = readFileSync(path.resolve(j.img));
  const mime = j.img.endsWith('.png') ? 'image/png' : 'image/jpeg';
  // Print-ready brochures embed CMYK JPEGs without an Adobe marker: browsers show them inverted.
  const filter = j.invert ? 'filter:invert(1);' : '';
  await page.setContent(`<html><body style="margin:0;background:#fff"><img id="i" style="display:block;${filter}" src="data:${mime};base64,${buf.toString('base64')}"></body></html>`);
  await page.waitForFunction(() => document.getElementById('i').complete && document.getElementById('i').naturalWidth > 0);
  const { w, h } = await page.evaluate(() => ({ w: document.getElementById('i').naturalWidth, h: document.getElementById('i').naturalHeight }));
  const s = j.scale ?? 2;
  await page.setViewportSize({ width: Math.ceil(w * s), height: Math.ceil(h * s) });
  await page.evaluate(([s, w, h]) => { const i = document.getElementById('i'); i.style.width = `${w * s}px`; i.style.height = `${h * s}px`; }, [s, w, h]);
  await page.screenshot({ path: j.out, clip: { x: j.x0 * w * s, y: j.y0 * h * s, width: (j.x1 - j.x0) * w * s, height: (j.y1 - j.y0) * h * s } });
  console.log(j.out);
}
await browser.close();
