/**
 * Prev / next controls for horizontal card tracks. A control group names its
 * track with data-carousel-ctrl="<track id>"; buttons page by most of the
 * visible width, disable at the ends, and a progress rule follows the scroll.
 * The track stays a plain scrollable list (swipe, keyboard, wheel all work).
 */
export function initCarousels(): void {
  document.querySelectorAll<HTMLElement>('[data-carousel-ctrl]').forEach((ctrl) => {
    const track = document.getElementById(ctrl.dataset.carouselCtrl!);
    if (!track) return;
    const prev = ctrl.querySelector<HTMLButtonElement>('[data-carousel-prev]');
    const next = ctrl.querySelector<HTMLButtonElement>('[data-carousel-next]');
    const bar = ctrl.querySelector<HTMLElement>('[data-carousel-progress]');
    const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
    const page = (dir: number) => {
      const first = track.firstElementChild as HTMLElement | null;
      const step = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '0') : track.clientWidth;
      const n = Math.max(1, Math.floor((track.clientWidth * 0.92) / step));
      track.scrollBy({ left: dir * n * step, behavior: smooth() });
    };
    prev?.addEventListener('click', () => page(-1));
    next?.addEventListener('click', () => page(1));
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = track.scrollWidth - track.clientWidth;
      const x = track.scrollLeft;
      if (prev) prev.disabled = x <= 2;
      if (next) next.disabled = x >= max - 2;
      ctrl.toggleAttribute('data-static', max <= 2);
      bar?.style.setProperty('--p', String(max > 0 ? (x + track.clientWidth) / track.scrollWidth : 1));
    };
    track.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  });
}
