// Render a region of a PDF page with headless Edge's built-in viewer (vector-accurate, no PDF libraries).
// Jobs file: [{ "pdf": "...", "page": 4, "zoom": 300, "left": 0, "top": 0, "w": 1600, "h": 1200, "out": "...png" }]
//   zoom = percent; left/top = PDF points from the page's top-left (PDF open parameters).
// Usage: node research/scripts/render-pdf.mjs <jobs.json>
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const EDGE = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  .find((p) => p && existsSync(p));

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--headless=new'] });
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.w ?? 1600, height: j.h ?? 1200 } });
  const url = `${pathToFileURL(path.resolve(j.pdf)).href}#page=${j.page}&zoom=${j.zoom},${j.left ?? 0},${j.top ?? 0}&toolbar=0&navpanes=0`;
  await page.goto(url);
  await page.waitForTimeout(j.wait ?? 3500);
  await page.screenshot({ path: j.out });
  await page.close();
  console.log(j.out);
}
await browser.close();
