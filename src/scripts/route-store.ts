/**
 * Mi Ruta: the visitor's saved places, kept in localStorage (no account).
 * Every "+ Añadir a Mi Ruta" control is a button with [data-route-add="<id>"]
 * and [data-route-name]; this module keeps them, the header counter and the
 * Mi Ruta page in sync, also across tabs.
 */
const KEY = 'slp:mi-ruta:v1';
type Listener = (ids: string[]) => void;
const listeners = new Set<Listener>();

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function write(ids: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode: keep in memory */ }
  memory = ids;
  listeners.forEach((l) => l(ids));
}
let memory = read();

export const route = {
  get: (): string[] => [...memory],
  has: (id: string) => memory.includes(id),
  add(id: string) { if (!memory.includes(id)) write([...memory, id]); },
  remove(id: string) { write(memory.filter((x) => x !== id)); },
  toggle(id: string) { memory.includes(id) ? this.remove(id) : this.add(id); },
  move(id: string, dir: -1 | 1) {
    const i = memory.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= memory.length) return;
    const next = [...memory];
    [next[i], next[j]] = [next[j], next[i]];
    write(next);
  },
  clear() { write([]); },
  subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
};

addEventListener('storage', (e) => {
  if (e.key === KEY) { memory = read(); listeners.forEach((l) => l(memory)); }
});

// ---- UI sync ---------------------------------------------------------------
function syncButtons(ids: string[]) {
  document.querySelectorAll<HTMLButtonElement>('[data-route-add]').forEach((b) => {
    const on = ids.includes(b.dataset.routeAdd!);
    b.setAttribute('aria-pressed', String(on));
    const label = b.querySelector('[data-route-label]');
    if (label) label.textContent = on ? 'En Mi Ruta' : 'Añadir a Mi Ruta';
  });
  document.querySelectorAll<HTMLElement>('[data-route-count]').forEach((c) => {
    c.textContent = String(ids.length);
    c.toggleAttribute('data-filled', ids.length > 0);
    c.setAttribute('aria-label', `${ids.length} ${ids.length === 1 ? 'lugar guardado' : 'lugares guardados'}`);
  });
}

let toastTimer = 0;
function toast(html: string) {
  const t = document.querySelector<HTMLElement>('[data-route-toast]');
  if (!t) return;
  t.innerHTML = html;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), 3600);
}

export function initRouteUi(myRouteHref: string): void {
  syncButtons(route.get());
  route.subscribe(syncButtons);
  // lists rendered on the client (directories, search) ask for a resync
  document.addEventListener('route:refresh', () => syncButtons(route.get()));
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-route-add]');
    if (!b) return;
    e.preventDefault();
    const id = b.dataset.routeAdd!;
    const name = b.dataset.routeName ?? 'Lugar';
    const had = route.has(id);
    route.toggle(id);
    toast(had ? `${escapeHtml(name)} se quitó de Mi Ruta.` : `${escapeHtml(name)} se añadió a Mi Ruta. <a href="${myRouteHref}">Ver Mi Ruta</a>`);
  });
}

/** Re-sync buttons created after load (map popups, filtered lists). */
export const refreshRouteButtons = () => syncButtons(route.get());

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
