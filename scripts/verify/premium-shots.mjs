// Screenshots of the premium intelligence pass, one image per chapter and
// viewport, plus overflow and console checks. Output is git-ignored.
//
//   node scripts/verify/premium-shots.mjs --url http://127.0.0.1:4321 [--out scrollcraft/lab/premium] [--only inteligencia,descubre,planner]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/premium'));
const ONLY = arg('--only', '').split(',').filter(Boolean);
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));
const SIZES = [['m360', 360, 800], ['m390', 390, 844], ['t768', 768, 1024], ['d1440', 1440, 900], ['d1920', 1920, 1080]];
const PAGES = [
  { name: 'inteligencia', path: '/inteligencia-turistica/', parts: ['#inicio', '#radiografia', '#mapa-oportunidades', '#calendario', '#diversificacion', '#escenario', '#arquitectura'] },
  { name: 'descubre', path: '/descubre/', parts: ['[data-discover]'], before: async (p) => { await p.click('[data-int="naturaleza"]'); await p.click('[data-int="agua"]'); await p.waitForTimeout(400); } },
  { name: 'planner', path: '/planea-con-ia/', parts: ['main'], optional: true },
].filter((p) => !ONLY.length || ONLY.includes(p.name));

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let bad = 0;
for (const [sname, w, h] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 800, isMobile: w < 800 });
  for (const pg of PAGES) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error' && !/tiles\.openfreemap|net::ERR|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(String(e)));
    const res = await p.goto(BASE + pg.path, { waitUntil: 'networkidle' }).catch(() => null);
    if (!res || res.status() !== 200) { if (!pg.optional) { bad++; console.log(`FAIL ${sname} ${pg.name}: HTTP ${res?.status()}`); } await p.close(); continue; }
    // let scroll-entry reveals run before measuring
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 140)); } scrollTo(0, 0); });
    if (pg.before) await pg.before(p).catch((e) => errs.push(`before: ${e.message}`));
    await p.waitForTimeout(900);
    const m = await p.evaluate(() => {
      const de = document.documentElement;
      const wide = [...document.querySelectorAll('main *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > de.clientWidth + 1 && !el.closest('.fig__scroll, .rail, [data-opp-canvas], .maplibregl-map, .chnav, .pnav'); }).slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
      const small = [...document.querySelectorAll('main button, main select, main summary')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40 && !el.closest('.maplibregl-map'); }).slice(0, 4).map((el) => `${el.tagName.toLowerCase()} ${Math.round(el.getBoundingClientRect().height)}px "${(el.textContent ?? '').trim().slice(0, 24)}"`);
      return { overflow: de.scrollWidth - de.clientWidth, wide, small };
    });
    const ok = m.overflow <= 0 && errs.length === 0 && m.wide.length === 0;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${sname} ${pg.name}: overflow ${m.overflow}px${m.wide.length ? ` · wide: ${m.wide.join(', ')}` : ''}${m.small.length ? ` · short targets: ${m.small.join(', ')}` : ''}${errs.length ? ` · console: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    for (const sel of pg.parts) {
      const el = await p.$(sel);
      if (!el) continue;
      await el.scrollIntoViewIfNeeded();
      await p.waitForTimeout(350);
      await el.screenshot({ path: path.join(OUT, `${pg.name}-${sel.replace(/[^a-z0-9]+/gi, '') || 'main'}-${sname}.png`) }).catch(() => {});
    }
    await p.close();
  }
  await ctx.close();
}
await browser.close();
console.log(bad ? `${bad} page × viewport combinations need attention` : 'all pages clean');
process.exit(bad ? 1 : 0);
