// Keyboard pass: tabs through the page and reports each focus stop, whether a
// focus outline is drawn, and where the page scrolled to. Also opens the menu
// with the keyboard and checks Escape returns focus to the opener.
//
//   node scripts/verify/keyboard.mjs --url http://127.0.0.1:4321/ [--width 1440 --height 900] [--stops 14]
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const URL = arg('--url', 'http://127.0.0.1:4321/');
const W = +arg('--width', '1440'), H = +arg('--height', '900'), STOPS = +arg('--stops', '14');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

for (let i = 0; i < STOPS; i++) {
  await page.keyboard.press('Tab');
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'body' };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
      onScreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      visible: cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.5,
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      scrollY: Math.round(scrollY),
    };
  });
  console.log(`  ${String(i + 1).padStart(2)} ${JSON.stringify(info)}`);
}

// Menu: open with keyboard, Escape closes and returns focus.
await page.evaluate(() => window.scrollTo(0, 0));
await page.focus('[data-menu-open]');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const open = await page.evaluate(() => ({ open: document.getElementById('slp-menu').open, focus: document.activeElement?.className || document.activeElement?.tagName }));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const closed = await page.evaluate(() => ({ open: document.getElementById('slp-menu').open, focusIsOpener: document.activeElement?.hasAttribute('data-menu-open') }));
console.log('menu:', JSON.stringify({ ...open, afterEscape: closed }));
await browser.close();
