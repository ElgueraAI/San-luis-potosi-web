/**
 * Sticky section nav: docking state, active section, mobile dropdown and a
 * thin page-progress rule. The active section is the last one whose top has
 * passed a line just under the docked chrome.
 */
export function initSubnav(): void {
  const nav = document.querySelector<HTMLElement>('[data-subnav]');
  const sentinel = document.querySelector<HTMLElement>('[data-subnav-sentinel]');
  if (!nav || !sentinel) return;
  const root = document.documentElement;
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('[data-subnav-link]')];
  const sections = links.map((a) => document.getElementById(a.dataset.subnavLink!)).filter((s): s is HTMLElement => !!s);
  const current = nav.querySelector<HTMLElement>('[data-subnav-current]');
  const toggle = nav.querySelector<HTMLButtonElement>('[data-subnav-toggle]');
  const progress = nav.querySelector<HTMLElement>('[data-subnav-progress]');
  const label = current?.textContent ?? 'Explorar';

  new IntersectionObserver(([e]) => root.classList.toggle('subnav-docked', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(sentinel);

  let active = '';
  let ticking = false;
  const update = () => {
    ticking = false;
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const line = Math.max(nav.getBoundingClientRect().bottom + 24, pad + 8);
    let id = '';
    for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
    if (id !== active) {
      active = id;
      links.forEach((a) => a.setAttribute('aria-current', String(a.dataset.subnavLink === id)));
      if (current) current.textContent = id ? links.find((a) => a.dataset.subnavLink === id)!.textContent! : label;
      const link = links.find((a) => a.dataset.subnavLink === id);
      const ul = link?.closest('ul');
      if (link && ul && ul.scrollWidth > ul.clientWidth && matchMedia('(min-width: 901px)').matches) {
        ul.scrollTo({ left: Math.max(0, link.offsetLeft - ul.clientWidth / 3) });
      }
    }
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty('--p', String(max > 0 ? scrollY / max : 0));
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  const setOpen = (open: boolean) => {
    nav.toggleAttribute('data-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setOpen(!nav.hasAttribute('data-open')));
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.hasAttribute('data-open')) { setOpen(false); toggle?.focus(); } });
  document.addEventListener('click', (e) => { if (nav.hasAttribute('data-open') && !nav.contains(e.target as Node)) setOpen(false); });
}
