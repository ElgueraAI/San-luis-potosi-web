// M04A browser QA. Local build only; all external requests are blocked.
// node scripts/verify/premium-visual.mjs --url http://127.0.0.1:4321 [--base /repo/]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const origin = arg('--url', 'http://127.0.0.1:4321').replace(/\/$/, '');
const base = '/' + arg('--base', '').replace(/^\/|\/$/g, '');
const root = origin + base.replace(/\/$/, '');
const out = path.resolve(arg('--out', 'reports/m04a/visual'));
const only = arg('--only', '');
const chrome = [process.env.SCROLLCRAFT_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
fs.mkdirSync(out, { recursive: true });
const results = [];
const report = (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' · ' + detail : ''}`); };
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const external = new Set();
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-MX', timezoneId: 'America/Mexico_City', ...options });
  await ctx.addInitScript(() => {
    Element.prototype.requestPointerLock = function() {};
    Element.prototype.setPointerCapture = function() {};
  });
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    external.add(new URL(url).hostname);
    return route.abort('blockedbyclient');
  });
  return ctx;
}
async function step(name, fn) {
  if (only && !name.includes(only)) return;
  try { await fn(); report(name, true); }
  catch (e) { report(name, false, e.message.replace(/\s+/g, ' ').slice(0, 400)); }
}
async function shot(page, name) { await page.screenshot({ path: path.join(out, `${name}.png`) }); }
async function selectRegion(page, index) {
  const menu = page.locator('[data-hero-region-menu]');
  if (!(await menu.evaluate(e => e.open))) await menu.locator(':scope > summary').click();
  await page.locator(`[data-hero-select="${index}"]`).click();
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

try {
  for (const width of [360, 390, 430, 768, 1366, 1440, 1920]) {
    const ctx = await context({ viewport: { width, height: width < 768 ? 844 : 1000 }, reducedMotion: 'reduce' });
    for (const [name, url] of [['home', '/'], ['inteligencia', '/inteligencia-turistica/'], ['descubre', '/descubre/']]) {
      await step(`${name} ${width}px: layout, images and runtime`, async () => {
        const p = await ctx.newPage();
        const errors = []; p.on('pageerror', e => errors.push(e.message));
        assert.equal((await p.goto(root + url)).status(), 200);
        await p.waitForFunction(() => document.fonts.status === 'loaded');
        if (name === 'home') await p.waitForSelector('[data-hero-ready]');
        if (name === 'descubre') await p.waitForSelector('[data-results] .rk');
        await shot(p, `${name}-${width}`);
        assert.ok(await overflow(p) <= 0, `horizontal overflow ${await overflow(p)}px`);
        const clipped = await p.locator('.hdr__brand, .hdr__nav, .hero__title').evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > document.documentElement.clientWidth + 1 || r.left < -1); }).map(e => e.className));
        assert.deepEqual(clipped, [], 'clipped hero or header controls');
        // Walk lazy content. Check the real viewport rather than hiding overflow.
        await p.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
            scrollTo(0, y); await new Promise(r => setTimeout(r, 35));
          }
        });
        await p.waitForTimeout(200);
        assert.ok(await overflow(p) <= 0, `overflow after lazy content ${await overflow(p)}px`);
        const broken = await p.locator('main img').evaluateAll(els => els.filter(e => e.complete && !e.naturalWidth).map(e => e.src));
        assert.deepEqual(broken, [], 'broken local photos');
        assert.deepEqual(errors, [], 'uncaught browser exceptions');
        if (name === 'home' && [390, 768, 1440].includes(width)) {
          for (const [id, label] of [['descubre', 'intro'], ['regiones', 'regiones'], ['a-tu-medida', 'invitacion'], ['experiencias', 'experiencias'], ['planea', 'planea']]) {
            await p.locator('#' + id).evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY - 100));
            await p.waitForTimeout(120);
            await shot(p, `home-${label}-${width}`);
          }
          await p.locator('.close').scrollIntoViewIfNeeded(); await shot(p, `home-cierre-${width}`);
        }
        if (name === 'descubre') {
          await p.locator('.dc__head').scrollIntoViewIfNeeded();
          await shot(p, `descubre-results-${width}`);
          const ratios = await p.locator('[data-results] .rk__img, [data-results] .rk__ph').evaluateAll(els => els.map(e => e.clientWidth / e.clientHeight));
          assert.ok(ratios.every(r => Math.abs(r - 1.6) < 0.03), 'nonuniform photo frames');
          await p.locator('[data-results] .rk__how').first().evaluate(e => e.open = true);
          assert.ok(await overflow(p) <= 0, 'expanded score table overflows');
        }
        if (name === 'inteligencia') {
          await p.locator('#radiografia').evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY - 110)); await shot(p, `dashboard-${width}`);
          assert.ok(!/La visita se concentra/.test(await p.locator('main').innerText()));
        }
        await p.close();
      });
    }
    await ctx.close();
  }

  await step('hero: owned reel and four separate manual regional photographs', async () => {
    const ctx = await context(); const p = await ctx.newPage();
    const videoRequests = []; p.on('request', r => { if (/\.(webm|mp4)(\?|$)/.test(r.url())) videoRequests.push(r.url()); });
    await p.goto(root + '/'); await p.waitForSelector('[data-hero-ready]');
    assert.equal(await p.locator('.hero video').count(), 1);
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-current'), 'reel');
    assert.equal(await p.locator('[data-hero-select][aria-pressed="true"]').count(), 0, 'travel reel has no invented geographic chapter');
    assert.equal(await p.locator('[data-hero-stage] img').count(), 1, 'inactive photos should not be mounted initially');
    const places = ['Real de Catorce', 'Templo de Loreto', 'Media Luna', 'Tamul'];
    for (let i = 0; i < 4; i++) {
      await selectRegion(p, i);
      await p.waitForFunction(i => document.querySelector('[data-hero-depth]').dataset.current === String(i), i);
      assert.match(await p.locator(`[data-hero-place="${i}"]`).textContent(), new RegExp(places[i]));
      assert.equal(await p.locator('[data-hero-select][aria-pressed="true"]').count(), 1);
      assert.ok(await p.locator('.hero__region-link').nth(i).getAttribute('href').then(h => h.startsWith(base)));
      await p.locator(`[data-hero-credit="${i}"] summary`).click();
      assert.ok(await p.locator(`[data-hero-credit="${i}"] a[href*="creativecommons.org"]`).count());
      await shot(p, `hero-region-${i}`);
      await p.locator(`[data-hero-credit="${i}"] summary`).click();
    }
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-playback'), 'manual');
    assert.equal(await p.locator('[data-hero-pause]').isVisible(), false, 'no fake playback control without a clip');
    assert.equal(await p.locator('[data-hero-video-status]').isVisible(), false);
    assert.equal(await p.locator('.hero source[src]').count(), 0, 'regional photographs unload the inactive reel');
    assert.ok(videoRequests.every(url => /hero-original-1080p\.mp4/.test(url)), 'inactive mobile variants must not transfer on desktop');
    assert.ok(await p.locator('[data-hero-return]').isVisible());
    await p.locator('[data-hero-return]').click();
    await p.waitForFunction(() => document.querySelector('[data-hero-depth]').dataset.current === 'reel');
    assert.equal(await p.locator('[data-hero-select][aria-pressed="true"]').count(), 0);
    assert.equal(await p.locator('[data-hero-reel-place]').getAttribute('hidden'), null);
    assert.equal(await p.locator('.hero__lede, .hero__ctas, .hero__description, .hero__kicker').count(), 0, 'only the editorial title remains');
    await ctx.close();
  });

  for (const mode of ['reduced', 'save-data']) await step(`hero: ${mode} keeps manual photos without video transfers`, async () => {
    const ctx = await context(mode === 'reduced' ? { reducedMotion: 'reduce' } : {});
    if (mode === 'save-data') await ctx.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, effectiveType: '4g', addEventListener() {} }, configurable: true }));
    const p = await ctx.newPage();
    const videoRequests = []; p.on('request', r => { if (/\.(webm|mp4)(\?|$)/.test(r.url())) videoRequests.push(r.url()); });
    await p.goto(root + '/'); await p.waitForSelector('[data-hero-ready]');
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-current'), 'reel');
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-playback'), 'manual');
    assert.equal(await p.locator('[data-hero-pause]').isVisible(), false);
    await selectRegion(p, 3);
    await p.waitForFunction(() => document.querySelector('[data-hero-depth]').dataset.current === '3');
    assert.equal(await p.locator('.hero source[src]').count(), 0);
    assert.deepEqual(videoRequests, [], 'resource preferences prevent any video transfer');
    await ctx.close();
  });

  await step('hero: a delayed selection cannot replace the most recent choice', async () => {
    const ctx = await context();
    await ctx.route('**/*wc-63495269*.webp', async r => { await new Promise(resolve => setTimeout(resolve, 300)); await r.continue(); });
    const p = await ctx.newPage(); await p.goto(root + '/'); await p.waitForSelector('[data-hero-ready]');
    await selectRegion(p, 0);
    await p.waitForFunction(() => document.querySelector('[data-hero-depth]').dataset.current === '0');
    await selectRegion(p, 1); await selectRegion(p, 0);
    await p.waitForTimeout(700);
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-current'), '0');
    assert.equal(await p.locator('[data-hero-controls]').getAttribute('aria-busy'), null);
    await ctx.close();
  });

  await step('hero: failed photo retains the previous region and announces the issue', async () => {
    const ctx = await context(); await ctx.route('**/*wc-48806929*.webp', r => r.fulfill({ status: 503, body: '' }));
    const p = await ctx.newPage(); await p.goto(root + '/'); await p.waitForSelector('[data-hero-ready]');
    await selectRegion(p, 0);
    await p.waitForFunction(() => document.querySelector('[data-hero-depth]').dataset.current === '0');
    await selectRegion(p, 3);
    await p.waitForFunction(() => document.querySelector('[data-hero-announcement]').textContent.includes('No se pudo'));
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-current'), '0');
    assert.equal(await p.locator('[data-hero-controls]').getAttribute('aria-busy'), null);
    await ctx.close();
  });

  await step('hero: reduced-motion reel poster stays still without a photographic carousel', async () => {
    const ctx = await context({ reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await p.goto(root + '/'); await p.waitForSelector('[data-hero-ready]');
    await p.waitForTimeout(9000);
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-current'), 'reel');
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-playback'), 'manual');
    assert.equal(await p.locator('[data-hero-stage] img').count(), 1);
    await ctx.close();
  });

  await step('hero: absent-video HTML fixture retains poster and regional exploration', async () => {
    const ctx = await context();
    await ctx.route(root + '/', async route => {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<video\b[^>]*data-hero-video[^>]*>[\s\S]*?<\/video>/g, '');
      await route.fulfill({ response, body: html });
    });
    const p = await ctx.newPage(); const videoRequests = [];
    p.on('request', r => { if (/\.(webm|mp4)(\?|$)/.test(r.url())) videoRequests.push(r.url()); });
    await p.goto(root + '/'); await p.waitForSelector('[data-hero-ready]');
    assert.equal(await p.locator('.hero video').count(), 0);
    assert.ok(await p.locator('.hero__poster').isVisible());
    assert.equal(await p.locator('[data-hero-pause]').isVisible(), false);
    await selectRegion(p, 2);
    await p.waitForFunction(() => document.querySelector('[data-hero-depth]').dataset.current === '2');
    assert.match(await p.locator('[data-hero-place="2"]').textContent(), /Media Luna/);
    assert.deepEqual(videoRequests, []);
    await ctx.close();
  });

  await step('without JavaScript: home links and dashboard data remain available', async () => {
    const ctx = await context({ javaScriptEnabled: false }); const p = await ctx.newPage();
    await p.goto(root + '/'); assert.equal(await p.locator('.hero__fallback a:visible').count(), 4, 'four no-JS regional links');
    assert.ok(await p.locator('.hero img').isVisible());
    await p.goto(root + '/inteligencia-turistica/'); assert.equal(await p.locator('#radiografia .kpis b').count(), 7, 'seven radiography KPI figures');
    assert.ok(await p.locator('.heat').isVisible());
    await p.goto(root + '/descubre/'); assert.match(await p.locator('noscript').innerText(), /Activa JavaScript/);
    await ctx.close();
  });

  await step('hero: rejected owned-reel autoplay retains poster and allows retry', async () => {
    const ctx = await context();
    await ctx.addInitScript(() => {
      HTMLMediaElement.prototype.load = function() {};
      HTMLMediaElement.prototype.play = function() { return Promise.reject(new DOMException('QA rejection', 'NotAllowedError')); };
    });
    const p = await ctx.newPage(); await p.goto(root + '/');
    await p.waitForSelector('[data-hero-depth][data-playback="error"]');
    assert.match(await p.locator('[data-hero-media-message]').innerText(), /fotografía/);
    assert.ok(await p.locator('[data-hero-scene="reel"] img').isVisible());
    assert.equal(await p.locator('[data-video-playing]').count(), 0);
    assert.equal(await p.locator('[data-hero-retry]').isVisible(), true);
    await p.locator('[data-hero-retry]').click();
    await p.waitForFunction(() => document.querySelectorAll('[data-hero-scene="reel"] source[src]').length === 0 && document.querySelector('[data-hero-media-message]').textContent.includes('fotografía'));
    assert.equal(await p.locator('[data-hero-depth]').getAttribute('data-playback'), 'error');
    assert.equal(await p.locator('[data-hero-scene="reel"] source[src]').count(), 0);
    await shot(p, 'hero-video-failure'); await ctx.close();
  });

  await step('mobile menu: keyboard, focus return, scroll lock and direct navigation', async () => {
    const ctx = await context({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
    await p.goto(root + '/');
    await p.locator('[data-menu-open]').focus(); await p.keyboard.press('Enter');
    await p.waitForSelector('dialog[open]');
    assert.equal(await p.evaluate(() => document.documentElement.style.overflow), 'hidden');
    assert.ok(await p.locator('.menu__quick a[href$="inteligencia-turistica/"]').isVisible());
    await p.locator('[data-menu-go="destinos"]').click();
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('data-menu-go')), 'destinos');
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.activeElement?.hasAttribute('data-menu-open')), true);
    assert.equal(await p.evaluate(() => document.documentElement.style.overflow), '');
    await p.locator('.hdr__discover').focus();
    assert.equal(await p.locator('.hdr__discover').evaluate(e => getComputedStyle(e).outlineStyle !== 'none'), true);
    assert.ok(await overflow(p) <= 0);
    await ctx.close();
  });

  await step('dashboard tooltips: associated description and Escape dismissal', async () => {
    const ctx = await context(); const p = await ctx.newPage(); await p.goto(root + '/inteligencia-turistica/');
    await p.locator('.tree__cell').first().focus();
    assert.equal(await p.locator('.tree__cell').first().getAttribute('aria-describedby'), 'vtip');
    assert.ok(await p.locator('#vtip').isVisible()); await p.keyboard.press('Escape');
    assert.ok(await p.locator('#vtip').isHidden());
    assert.equal(await p.locator('.tree__cell').first().getAttribute('aria-describedby'), null);
    await ctx.close();
  });

  await step('Descubre: unavailable dataset offers recovery', async () => {
    const ctx = await context(); await ctx.route('**/data/intel.json', r => r.fulfill({ status: 503, body: '{}' }));
    const p = await ctx.newPage(); await p.goto(root + '/descubre/');
    await p.waitForSelector('[data-discover-error]:not([hidden])');
    assert.match(await p.locator('[data-status]').innerText(), /No se pudieron cargar/);
    assert.equal(await p.locator('[data-loading]').count(), 0);
    await ctx.close();
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ root, results, blockedExternalHosts: [...external] }, null, 2));
}
const failed = results.filter(r => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed. External hosts blocked: ${external.size}.`);
process.exitCode = failed.length ? 1 : 0;
