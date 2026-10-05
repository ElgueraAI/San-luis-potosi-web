/**
 * Hero depth: the planes lean toward a fine pointer, the way a real space
 * shifts when you move your head. Additive only: touch, keyboard and reduced
 * motion get the complete composition without it. Never captures the pointer.
 * Scroll-driven depth is pure CSS from the act's --sc-p (HomeHero.astro).
 */
export function initHeroDepth(tier: SlpTier): void {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero || tier !== 'full' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let tx = 0, ty = 0, cx = 0, cy = 0;
  let visible = true;
  let running = false;

  function tick(): void {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    hero!.style.setProperty('--mx', cx.toFixed(4));
    hero!.style.setProperty('--my', cy.toFixed(4));
    if (visible && (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001)) requestAnimationFrame(tick);
    else running = false;
  }
  function start(): void {
    if (!running && visible) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  addEventListener(
    'pointermove',
    (e) => {
      if (!visible || e.pointerType !== 'mouse') return;
      tx = (e.clientX / innerWidth) * 2 - 1;
      ty = (e.clientY / innerHeight) * 2 - 1;
      start();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    tx = 0;
    ty = 0;
    start();
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(hero);
}
