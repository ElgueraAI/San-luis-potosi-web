/**
 * Site bootstrap. Global chrome on every page, then feature modules loaded
 * only where their markup exists (dynamic imports keep each page light; the
 * MapLibre bundle loads only when a map approaches the viewport).
 */
import { initRouteUi } from './route-store';
import { initMenu } from './menu';

const root = document.documentElement;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const tier = (root.dataset.motion ?? 'static') as 'full' | 'lite' | 'static';

// ---- header ----------------------------------------------------------------
const header = document.querySelector<HTMLElement>('[data-header]');
if (header?.classList.contains('hdr--overlay')) {
  const onScroll = () => header.classList.toggle('is-solid', scrollY > 40 || header.hasAttribute('data-open'));
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Hide on scroll down, reveal on scroll up (never while a panel is open).
{
  let last = scrollY;
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      const down = y > last + 4, up = y < last - 4;
      if (down && y > 320 && !header?.hasAttribute('data-open') && !header?.contains(document.activeElement)) root.classList.add('hdr-hidden');
      else if (up || y < 120) root.classList.remove('hdr-hidden');
      last = y;
      ticking = false;
    });
  }, { passive: true });
}
header?.addEventListener('focusin', () => root.classList.remove('hdr-hidden'));

// ---- Explorar panel ---------------------------------------------------------
const exploreBtn = document.querySelector<HTMLButtonElement>('[data-explore-toggle]');
const explorePanel = document.querySelector<HTMLElement>('[data-explore-panel]');
if (exploreBtn && explorePanel && header) {
  const set = (open: boolean) => {
    exploreBtn.setAttribute('aria-expanded', String(open));
    explorePanel.hidden = !open;
    header.toggleAttribute('data-open', open);
    if (header.classList.contains('hdr--overlay')) header.classList.toggle('is-solid', open || scrollY > 40);
  };
  exploreBtn.addEventListener('click', () => set(explorePanel.hasAttribute('hidden')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !explorePanel.hidden) { set(false); exploreBtn.focus(); } });
  document.addEventListener('click', (e) => { if (!explorePanel.hidden && !header.contains(e.target as Node)) set(false); });
  header.addEventListener('focusout', () => {
    requestAnimationFrame(() => { if (!header.contains(document.activeElement)) set(false); });
  });
  matchMedia('(max-width: 860px)').addEventListener('change', (e) => { if (e.matches) set(false); });
}

// ---- menu dialog (hierarchical portal menu) ---------------------------------
initMenu();

// ---- reveal on entry -------------------------------------------------------------
const reveals = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (tier === 'static' || !('IntersectionObserver' in window)) {
  reveals.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }),
    { rootMargin: '0px 0px -10% 0px' },
  );
  reveals.forEach((el) => io.observe(el));
}

// ---- Mi Ruta -------------------------------------------------------------------
initRouteUi(`${BASE}/mi-ruta/`);

// ---- feature modules ------------------------------------------------------------
const has = (sel: string) => document.querySelector(sel) !== null;
if (has('[data-subnav]')) import('./subnav').then((m) => m.initSubnav());
if (has('[data-hero-depth]')) import('./hero').then((m) => m.initHero(tier));
if (has('[data-descent]')) import('./descent').then((m) => m.initDescent(tier));
if (has('[data-weather]')) import('./weather').then((m) => m.initWeather());
if (has('[data-season]')) import('./season').then((m) => m.initSeason());
if (has('[data-interests]')) import('./interests').then((m) => m.initInterests());
if (has('[data-carousel-ctrl]')) import('./carousel').then((m) => m.initCarousels());
if (has('[data-my-route]')) import('./my-route').then((m) => m.initMyRoute());
if (has('[data-dir]')) import('./directory').then((m) => m.initDirectories());
if (has('[data-search]')) import('./search').then((m) => m.initSearch());
if (has('[data-cal]')) import('./calendar').then((m) => m.initCalendar());
if (has('[data-muni-index]')) import('./muni-index').then((m) => m.initMuniIndex());

const maps = document.querySelectorAll<HTMLElement>('[data-map]');
if (maps.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        import('./map').then((m) => m.mountMap(en.target as HTMLElement));
      });
    },
    { rootMargin: '600px 0px' },
  );
  maps.forEach((m) => io.observe(m));
}
