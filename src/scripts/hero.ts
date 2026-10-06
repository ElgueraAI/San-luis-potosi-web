/**
 * Hero depth: each [data-depth] plane drifts at its own rate while the hero
 * leaves the viewport (photo slowest, terrain line faster, copy slightly
 * against the scroll). Transforms only, rAF-throttled, off under reduced
 * motion and once the hero is out of view.
 */
export function initHero(tier: string): void {
  if (tier === 'static') return;
  const hero = document.querySelector<HTMLElement>('[data-hero-depth]');
  if (!hero) return;
  const planes = [...hero.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => ({ el, rate: parseFloat(el.dataset.depth!) }));
  const copy = hero.querySelector<HTMLElement>('.hero__copy');
  let ticking = false;
  const frame = () => {
    ticking = false;
    const h = hero.offsetHeight;
    const y = Math.min(Math.max(scrollY, 0), h);
    if (y >= h) return;
    for (const p of planes) p.el.style.transform = `translate3d(0, ${(y * p.rate).toFixed(1)}px, 0)`;
    if (copy) copy.style.opacity = String(Math.max(0, 1 - y / (h * 0.7)));
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  frame();
}
