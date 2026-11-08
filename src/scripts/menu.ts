/**
 * Portal menu: opens the dialog and drills through its panels. A "›" item
 * shows its child panel in place; Atrás returns to the parent and puts focus
 * back on the item that opened it. Focus moves to each panel's title so screen
 * readers announce where the visitor is. The native <dialog> traps focus and
 * closes on Escape (Escape inside a sub-panel goes back one level first).
 */
export function initMenu(): void {
  const menu = document.querySelector<HTMLDialogElement>('[data-menu]');
  const opener = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!menu || !opener) return;
  const panels = [...menu.querySelectorAll<HTMLElement>('[data-menu-panel]')];
  const get = (id: string) => panels.find((p) => p.dataset.menuPanel === id)!;
  let current = 'root';
  let previousOverflow = '';
  const origin = new Map<string, string>();

  const show = (id: string, focusSel?: string) => {
    panels.forEach((p) => (p.hidden = p.dataset.menuPanel !== id));
    current = id;
    const p = get(id);
    const target = focusSel ? p.querySelector<HTMLElement>(focusSel) : p.querySelector<HTMLElement>('.mp__title');
    (target ?? p).focus({ preventScroll: true });
    menu.querySelector('.menu__panel')?.scrollTo({ top: 0 });
  };

  opener.addEventListener('click', () => {
    show('root');
    menu.showModal();
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    opener.setAttribute('aria-expanded', 'true');
    menu.querySelector<HTMLElement>('#mp-root-t')?.focus();
  });
  menu.querySelector('[data-menu-close]')?.addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => { document.documentElement.style.overflow = previousOverflow; opener.setAttribute('aria-expanded', 'false'); opener.focus({ preventScroll: true }); });
  menu.addEventListener('click', (e) => {
    if (e.target === menu) return menu.close();
    const go = (e.target as Element).closest<HTMLElement>('[data-menu-go]');
    if (go) { origin.set(go.dataset.menuGo!, current); show(go.dataset.menuGo!); return; }
    const back = (e.target as Element).closest<HTMLElement>('[data-menu-back]');
    if (back) { const from = current; show(back.dataset.menuBack!, `[data-menu-go="${from}"]`); return; }
    if ((e.target as Element).closest('a')) menu.close();
  });
  // Escape fires the dialog's cancel event: inside a sub-panel it goes back one level
  menu.addEventListener('cancel', (e) => {
    if (current === 'root') return;
    e.preventDefault();
    const from = current;
    show(get(current).dataset.parent ?? 'root', `[data-menu-go="${from}"]`);
  });
}
