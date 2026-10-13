// Full-page and viewport screenshots of named routes at desktop and phone
// widths, plus console errors and horizontal-overflow checks.
//
//   node scripts/verify/pages.mjs --url http://127.0.0.1:4321 --out scrollcraft/lab/pages [--only home,mapa] [--reduced-motion]
//
// Output is git-ignored (scrollcraft/lab/).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const OUT = path.resolve(arg('--out', 'scrollcraft/lab/pages'));
const ONLY = arg('--only', '');
const REDUCED = argv.includes('--reduced-motion');
const FULL = !argv.includes('--viewport-only');
const CHROME = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && fs.existsSync(p));

const routes = [
  ['home', '/'], ['huasteca', '/regiones/huasteca/'], ['altiplano', '/regiones/altiplano/'], ['zona-media', '/regiones/zona-media/'],
  ['destino', '/destinos/cascada-de-tamul/'], ['destino-b', '/destinos/murales-de-el-tepeyac/'], ['mapa', '/mapa/'], ['temporadas', '/temporadas/'],
  ['rutas', '/rutas/'], ['guias', '/guias/'], ['planea', '/planea/'], ['mi-ruta', '/mi-ruta/'], ['creditos', '/creditos/'],
  ['municipios', '/municipios/'], ['muni-xilitla', '/municipios/xilitla/'], ['muni-pozos', '/municipios/villa-de-pozos/'], ['muni-slp', '/municipios/san-luis-potosi/'],
  ['que-hacer', '/que-hacer/'], ['qh-naturaleza', '/que-hacer/naturaleza/'], ['qh-noche', '/que-hacer/vida-nocturna/'], ['experiencias', '/experiencias/'], ['exp', '/experiencias/nadar-en-el-agua-clara-de-la-media-luna/'],
  ['eventos', '/eventos/'], ['evento', '/eventos/navidad-verde/'], ['arqueologia', '/arqueologia/'], ['tanute', '/arqueologia/tanute/'],
  ['museos', '/museos/'], ['hospedaje', '/hospedaje/'], ['gastronomia', '/gastronomia/'], ['buscar', '/buscar/?q=museo'], ['acerca', '/acerca/'], ['destinos', '/destinos/'],
  ['descubre', '/descubre/'], ['inteligencia', '/inteligencia-turistica/'], ['segmentos', '/inteligencia-turistica/segmentos/'],
].filter(([n]) => !ONLY || ONLY.split(',').includes(n));
const sizes = (arg('--sizes', '') ? arg('--sizes', '').split(',').map((s) => { const [n, w, h] = s.split(':'); return [n, +w, +h]; }) : [['desk', 1440, 900], ['phone', 390, 844]]);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const report = [];
for (const [sname, w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: REDUCED ? 'reduce' : 'no-preference', hasTouch: sname === 'phone', isMobile: sname === 'phone' });
  await ctx.addInitScript(() => {
    Element.prototype.requestPointerLock = () => {};
    Element.prototype.setPointerCapture = () => {};
    localStorage.setItem('slp:mi-ruta:v1', JSON.stringify(['H01', 'A01', 'M01', 'H08']));
  });
  for (const [name, url] of routes) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
    page.on('requestfailed', (r) => { if (!/open-meteo|openfreemap|tiles/.test(r.url())) errors.push('failed: ' + r.url().slice(0, 140)); });
    const res = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => ({ status: () => 'ERR ' + e.message }));
    await page.waitForTimeout(600);
    // walk the page so lazy images and maps load
    const H = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += h * 0.8) { await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(140); }
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const bad = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > W + 1 && getComputedStyle(el).position !== 'fixed') {
          let p = el.parentElement, clipped = false;
          while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { clipped = true; break; } p = p.parentElement; }
          if (!clipped) bad.push(el.tagName + '.' + [...el.classList].join('.') + ' ' + Math.round(r.right));
        }
      });
      return { scrollW: document.documentElement.scrollWidth, W, bad: bad.slice(0, 6) };
    });
    if (FULL) {
      // Viewport slices (full-page capture breaks past ~16k px and on pinned acts).
      const slices = [];
      for (let y = 0, i = 0; y < H && i < 40; y += h, i++) {
        await page.evaluate((yy) => scrollTo(0, yy), y);
        await page.waitForTimeout(260);
        const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
        slices.push(shot);
        fs.mkdirSync(path.join(OUT, 'slices'), { recursive: true });
        fs.writeFileSync(path.join(OUT, 'slices', `${name}-${sname}-${String(i).padStart(2, '0')}.jpg`), shot);
      }
      await page.evaluate(() => scrollTo(0, 0));
      const cw = sname === 'phone' ? 195 : 360, chh = Math.round((cw / w) * h), cols = sname === 'phone' ? 8 : 5;
      const rows = Math.ceil(slices.length / cols);
      const comps = await Promise.all(slices.map(async (b, k) => ({ input: await sharp(b).resize(cw, chh).toBuffer(), left: (k % cols) * (cw + 4), top: Math.floor(k / cols) * (chh + 4) })));
      await sharp({ create: { width: cols * (cw + 4), height: rows * (chh + 4), channels: 3, background: '#888' } }).composite(comps).jpeg({ quality: 72 }).toFile(path.join(OUT, `${name}-${sname}-sheet.jpg`));
    }
    await page.screenshot({ path: path.join(OUT, `${name}-${sname}.jpg`), type: 'jpeg', quality: 75 });
    report.push({ name, size: sname, status: typeof res?.status === 'function' ? res.status() : '?', height: H, overflow, errors });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
for (const r of report) console.log(`${r.name.padEnd(12)} ${r.size.padEnd(6)} ${r.status} h=${r.height} overflow=${r.overflow.scrollW > r.overflow.W ? 'YES ' + r.overflow.bad.join(', ') : 'no'} errors=${r.errors.length}${r.errors.length ? ' :: ' + r.errors.slice(0, 3).join(' | ') : ''}`);
