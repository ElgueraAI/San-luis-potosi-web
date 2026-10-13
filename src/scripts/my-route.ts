/**
 * Mi Ruta page: renders the saved places (localStorage via route-store) with
 * order controls, the regions they cover, and suggestions for regions not yet
 * in the route. The map on the page (mode="route") and the planner
 * (route-planner.ts) follow the same store through route-session, which
 * also provides the road distance / time of each leg shown in the list.
 * Live navigation (nav-ui.ts) marks stops as visited; they stay in the list
 * with a «Visitado» tag and leave the routed line until the trip is reset.
 */
import { route } from './route-store';
import { loadPlaces, esc, REGION_NAME, routable, type Place } from './geo/places';
import { routeSession, type SessionState } from './geo/route-session';
import { fmtDistance, fmtDuration } from './geo/format';
import { tripStore } from './geo/trip-store';

export async function initMyRoute(): Promise<void> {
  const box = document.querySelector<HTMLElement>('[data-my-route]');
  if (!box) return;
  const $ = <T extends HTMLElement>(s: string) => box.querySelector<T>(s)!;
  const list = $<HTMLOListElement>('[data-mr-list]');
  let places: Place[] = [];
  try {
    places = await loadPlaces(box.dataset.placesUrl!);
  } catch {
    $('[data-mr-loading]').hidden = true;
    $('[data-mr-error]').hidden = false;
    return;
  }
  $('[data-mr-loading]').hidden = true;
  const byId = new Map(places.map((p) => [p.id, p]));

  /** Road leg arriving at each waypoint id (from the current route result). */
  const legsFor = (s: SessionState) => {
    const m = new Map<string, { distance: number; duration: number; from: string }>();
    if (s.phase !== 'ok' || !s.result || s.altIndex) return m; // alternatives have no per-leg split
    s.waypoints.forEach((w, i) => {
      const leg = s.result!.legs[i - 1];
      if (i > 0 && leg) m.set(w.id, { distance: leg.distance, duration: leg.duration, from: s.waypoints[i - 1].name });
    });
    return m;
  };

  let lastSig = '';
  const render = () => {
    const s = routeSession.get();
    const ids = route.get().filter((id) => byId.has(id));
    // skip identical renders (session emits loading/ok states) so focus and scroll stay put
    const sig = [ids.join(), tripStore.visitedIds().join(), s.phase, s.result?.computedAt ?? '', s.altIndex, s.waypoints.map((w) => w.id).join()].join('#');
    if (sig === lastSig) return;
    lastSig = sig;
    const f = document.activeElement as HTMLElement | null;
    const focusSel = f && list.contains(f) && f.dataset.id ? `button[data-id="${f.dataset.id}"][data-mv="${f.dataset.mv}"]` : null;
    const sel = ids.map((id) => byId.get(id)!);
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

    const legs = legsFor(s);
    const origin = s.waypoints[0]?.id.startsWith('origin:') ? s.waypoints[0] : null;
    const routedIds = s.waypoints.map((w) => w.id);
    const lastRouted = routedIds[routedIds.length - 1];
    const startRow = origin && sel.length
      ? `<li class="mr__start"><span class="mr__startmark" aria-hidden="true"></span><div><p class="mr__name">${esc(origin.name)}</p><p class="mr__meta"><span class="mr__tag">Inicio</span>Punto de partida${origin.approximate ? ' · ubicación aproximada' : ''}</p></div></li>`
      : '';
    list.innerHTML = startRow + sel
      .map((p, i) => {
        const leg = legs.get(p.id);
        const isStart = !origin && routedIds[0] === p.id && routedIds.length > 1;
        const isEnd = lastRouted === p.id && routedIds.length > 1;
        const tag = isStart ? '<span class="mr__tag">Inicio</span>' : isEnd ? '<span class="mr__tag">Fin</span>' : '';
        const visited = tripStore.isVisited(p.id);
        return `<li data-region="${p.region}"${visited ? ' data-visited' : ''}>
        <span class="mr__n" aria-hidden="true">${i + 1}</span>
        ${p.image ? `<img class="mr__img" src="${p.image}" alt="" width="80" height="80" loading="lazy">` : '<span class="mr__ph" aria-hidden="true"></span>'}
        <div>
          <p class="mr__name">${p.url ? `<a href="${p.url}">${esc(p.name)}</a>` : esc(p.name)}</p>
          <p class="mr__meta">${visited ? '<span class="mr__done">✓ Visitado</span>' : ''}${tag}${REGION_NAME[p.region]} · ${esc(p.kind)}${p.municipality ? ` · ${esc(p.municipality)}` : ''}${p.status === 'provisional' ? ' · ubicación aproximada' : !routable(p) ? ' · sin punto en el mapa: no entra en el cálculo' : ''}</p>
        </div>
        <div class="mr__ctrl">
          <button type="button" data-mv="-1" data-id="${p.id}" aria-label="Subir ${esc(p.name)}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-mv="1" data-id="${p.id}" aria-label="Bajar ${esc(p.name)}" ${i === sel.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-rm="${p.id}" aria-label="Quitar ${esc(p.name)} de Mi Ruta">✕</button>
        </div>
        ${leg ? `<p class="mr__leg">↳ <b>${fmtDistance(leg.distance)}</b> · <b>${fmtDuration(leg.duration)}</b> desde ${esc(leg.from)}</p>` : ''}
      </li>`;
      })
      .join('');
    if (focusSel) (list.querySelector<HTMLButtonElement>(`${focusSel}:not(:disabled)`) ?? list.querySelector<HTMLButtonElement>(`button[data-id="${f!.dataset.id}"]:not(:disabled)`))?.focus();
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
  tripStore.subscribe(render);
  render();

  // road legs + planner (route-session also feeds the map on this page)
  try {
    await routeSession.init(box.dataset.placesUrl!);
    routeSession.activate();
    routeSession.subscribe(render);
    const { initPlanner } = await import('./route-planner');
    initPlanner(box);
    const { initNavigation } = await import('./nav-ui');
    initNavigation(box);
    // intelligence layer: loaded last and on its own, so the planner never waits for it
    void import('./intel/route-recos').then((m) => m.initRouteRecos(box)).catch(() => { /* the rule-based suggestions remain */ });
  } catch {
    /* places already loaded above; the list keeps working without routing */
  }
}
