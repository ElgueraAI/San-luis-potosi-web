/**
 * Chrome: keeps the header and the Line in step with what is under them.
 *
 * - data-chrome-top / data-chrome-bottom: the ground (dark | light) under the
 *   header and under the Line, so both always read on what they cover.
 * - data-chrome-mode: overlay over cinematic stages, solid over flow content.
 * - data-line-state: hidden during the hero (its horizon IS the line), full in
 *   the cinematic acts, collapsed over practical sections (data-line="collapsed").
 * - --slp-x / --slp-e and the active region: from `slp:position` events, which
 *   the Descent publishes as the camera travels.
 */
import { elevationAt } from '@/data/geo';

export function initChrome(): void {
  const root = document.documentElement;
  let sections = Array.from(document.querySelectorAll<HTMLElement>('[data-chrome]'));
  addEventListener('slp:chrome-regions', () => {
    sections = Array.from(document.querySelectorAll<HTMLElement>('[data-chrome]'));
  });
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const jumps = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-line-jump]'));
  const segs = Array.from(document.querySelectorAll<SVGPathElement>('.slp-line__seg, [data-line-strip] path'));
  const header = document.querySelector<HTMLElement>('[data-header]');
  const firstRegion = jumps[0]?.dataset.lineJump ?? 'altiplano';

  let x = 0;
  let region = firstRegion;
  let queued = false;

  // The innermost match wins (nested chrome regions come later in the DOM).
  const at = (y: number) => {
    let hit: HTMLElement | undefined;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) hit = s;
    }
    return hit;
  };

  function update(): void {
    queued = false;
    const headerMid = (header?.offsetHeight ?? 64) / 2;
    const top = at(headerMid);
    const bottom = at(innerHeight - 24);

    root.dataset.chromeTop = top?.dataset.chromeGroundTop ?? top?.dataset.chromeGround ?? top?.dataset.ground ?? 'dark';
    root.dataset.chromeBottom = bottom?.dataset.chromeGroundBottom ?? bottom?.dataset.chromeGround ?? bottom?.dataset.ground ?? 'dark';
    root.dataset.chromeMode = top?.dataset.chrome === 'solid' ? 'solid' : 'overlay';

    let state = bottom?.dataset.line ?? 'full';
    if (hero) {
      const r = hero.getBoundingClientRect();
      const p = parseFloat(hero.style.getPropertyValue('--sc-p') || '0');
      const pinned = hero.hasAttribute('data-sc-act');
      if (pinned ? p < 0.9 && r.top > -innerHeight * 3 : r.bottom > innerHeight * 0.4) state = 'hidden';
    }
    root.dataset.lineState = state;

    root.style.setProperty('--slp-x', x.toFixed(4));
    root.style.setProperty('--slp-e', elevationAt(x).toFixed(4));
    for (const p of segs) p.toggleAttribute('data-active', p.dataset.region === region);
    for (const a of jumps) a.setAttribute('aria-current', String(a.dataset.lineJump === region));
  }

  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };

  addEventListener('slp:position', (e) => {
    x = e.detail.x;
    region = e.detail.region;
    schedule();
  });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
}
