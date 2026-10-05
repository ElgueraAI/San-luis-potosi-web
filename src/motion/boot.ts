/**
 * Boot: prepares acts for the current motion tier, mounts the Scroll Craft
 * engine (unmodified), then starts the site's own choreography.
 *
 * Tiers (set in <head> before first paint, see BaseLayout):
 *   full    everything
 *   lite    Save-Data, 2G or low memory: no pointer lean, no video
 *   static  prefers-reduced-motion: acts marked data-slp-collapse become plain
 *           flow, so nothing pins and every composition stands still
 */
import { initChrome } from './chrome';
import { initHeroDepth } from './heroDepth';
import { initDescent } from './descent';

const root = document.documentElement;
const tier = (root.dataset.motion as SlpTier | undefined) ?? 'static';
const small = matchMedia('(max-width: 860px)').matches;

document.querySelectorAll<HTMLElement>('[data-sc-act]').forEach((el) => {
  if (tier === 'static' && el.hasAttribute('data-slp-collapse')) {
    el.removeAttribute('data-sc-act');
    el.removeAttribute('data-sc-span');
    return;
  }
  const mobileSpan = el.dataset.slpSpanM;
  if (small && mobileSpan) el.setAttribute('data-sc-span', mobileSpan);
});

// The video in the Descent is only worth fetching on the full tier.
if (tier !== 'full') {
  document.querySelectorAll('video[data-sc-scrub]').forEach((v) => v.removeAttribute('data-sc-scrub'));
}

function engineReady(): Promise<NonNullable<Window['ScrollCraft']>> {
  return new Promise((resolve, reject) => {
    if (window.ScrollCraft) return resolve(window.ScrollCraft);
    const tag = document.querySelector<HTMLScriptElement>('script[src*="scrollcraft.js"]');
    if (!tag) return reject(new Error('Scroll Craft engine script missing'));
    tag.addEventListener('load', () => (window.ScrollCraft ? resolve(window.ScrollCraft) : reject(new Error('engine did not install'))));
    tag.addEventListener('error', () => reject(new Error('engine failed to load')));
  });
}

let active: SlpTier = tier;

engineReady()
  .then((sc) => {
    sc.mount(document.body);
    // A late webfont changes every measured height; one resize re-measures.
    document.fonts?.ready.then(() => dispatchEvent(new Event('resize')));
  })
  .catch((err) => {
    // Without the engine nothing would drive the pinned acts: fall back to the
    // static compositions rather than leave long stretches of dead scroll.
    console.error('[slp] scroll engine unavailable, falling back to static:', err);
    active = 'static';
    root.dataset.motion = 'static';
  })
  .finally(() => {
    initChrome();
    initHeroDepth(active);
    initDescent(active);
  });
