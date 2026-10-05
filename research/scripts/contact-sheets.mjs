// Render research/raw/media-review/sheets/*.html to PNG with headless Edge (for visual review).
// Usage: node research/scripts/contact-sheets.mjs [glob-prefix]
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const EDGE = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p));
const dir = path.resolve('research/raw/media-review/sheets');
const prefix = process.argv[2] ?? 'sheet-';
const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.html')).sort();
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
for (const f of files) {
  const out = path.join(dir, f.replace('.html', '.png'));
  if (existsSync(out) && !process.env.FORCE) continue;
  await page.goto(pathToFileURL(path.join(dir, f)).href);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: out, fullPage: true });
}
await browser.close();
console.log(files.length, 'sheets rendered');
