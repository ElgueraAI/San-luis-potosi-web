/**
 * Mi Ruta page: renders the saved places (localStorage via route-store) with
 * order controls, the regions they cover, and suggestions for regions not yet
 * in the route. The map on the page (mode="route") follows the same store.
 */
import { route } from './route-store';

type Place = { id: string; name: string; region: string; kind: string; municipality: string | null; url: string | null; image: string | null; status: string };
const REGION_NAME: Record<string, string> = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function initMyRoute(): Promise<void> {
  const box = document.querySelector<HTMLElement>('[data-my-route]');
  if (!box) return;
  const $ = <T extends HTMLElement>(s: string) => box.querySelector<T>(s)!;
  const list = $<HTMLOListElement>('[data-mr-list]');
  let places: Place[] = [];
  try {
    const r = await fetch(box.dataset.placesUrl!);
    if (!r.ok) throw new Error(String(r.status));
    places = await r.json();
  } catch {
    $('[data-mr-loading]').hidden = true;
    $('[data-mr-error]').hidden = false;
    return;
  }
  $('[data-mr-loading]').hidden = true;

  const render = () => {
    const ids = route.get().filter((id) => places.some((p) => p.id === id));
    const sel = ids.map((id) => places.find((p) => p.id === id)!);
    $('[data-mr-empty]').hidden = sel.length > 0;
    $('[data-mr-summary]').hidden = sel.length === 0;
    $('[data-mr-actions]').hidden = sel.length === 0;
    $('[data-mr-count]').textContent = String(sel.length);
    const counts: Record<string, number> = {};
    sel.forEach((p) => (counts[p.region] = (counts[p.region] ?? 0) + 1));
    box.querySelectorAll<HTMLElement>('[data-mr-region]').forEach((li) => {
      const n = counts[li.dataset.mrRegion!] ?? 0;
      li.querySelector('[data-mr-region-n]')!.textContent = String(n);
      li.toggleAttribute('data-zero', n === 0);
    });
    let missing = 0;
    box.querySelectorAll<HTMLElement>('[data-mr-missing]').forEach((li) => {
      const miss = sel.length > 0 && !counts[li.dataset.mrMissing!];
      li.hidden = !miss;
      if (miss) missing++;
    });
    $('[data-mr-suggest]').hidden = missing === 0;

    list.innerHTML = sel
      .map((p, i) => `<li data-region="${p.region}">
        <span class="mr__n" aria-hidden="true">${i + 1}</span>
        ${p.image ? `<img class="mr__img" src="${p.image}" alt="" width="80" height="80" loading="lazy">` : '<span class="mr__ph" aria-hidden="true"></span>'}
        <div>
          <p class="mr__name">${p.url ? `<a href="${p.url}">${esc(p.name)}</a>` : esc(p.name)}</p>
          <p class="mr__meta">${REGION_NAME[p.region]} · ${esc(p.kind)}${p.municipality ? ` · ${esc(p.municipality)}` : ''}${p.status === 'provisional' ? ' · ubicación aproximada' : p.status === 'none' ? ' · sin punto en el mapa' : ''}</p>
        </div>
        <div class="mr__ctrl">
          <button type="button" data-mv="-1" data-id="${p.id}" aria-label="Subir ${esc(p.name)}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-mv="1" data-id="${p.id}" aria-label="Bajar ${esc(p.name)}" ${i === sel.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-rm="${p.id}" aria-label="Quitar ${esc(p.name)} de Mi Ruta">✕</button>
        </div>
      </li>`)
      .join('');
  };

  list.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.rm) route.remove(b.dataset.rm);
    else if (b.dataset.mv) {
      route.move(b.dataset.id!, +b.dataset.mv as -1 | 1);
      requestAnimationFrame(() => list.querySelector<HTMLButtonElement>(`button[data-id="${b.dataset.id}"][data-mv="${b.dataset.mv}"]:not(:disabled)`)?.focus());
    }
  });
  $('[data-mr-clear]').addEventListener('click', () => {
    if (confirm('¿Quitar todos los lugares de Mi Ruta?')) route.clear();
  });
  route.subscribe(render);
  render();
}
