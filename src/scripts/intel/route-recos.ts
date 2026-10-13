/**
 * Mi Ruta · «Cerca de tu recorrido»: places near the corridor of the road
 * route already on screen, scored with the visitor's profile (or, without
 * one, with the interests of the places they saved).
 *
 * Quota: nothing is requested while the list renders. Detours are estimated
 * from the route geometry already in memory. «Medir desvíos por carretera»
 * is one matrix request, made only when the visitor asks, cached, and never
 * retried automatically. If routing fails there is no corridor and no number
 * is shown.
 */
import { route } from '../route-store';
import { routeSession, errorMessage, type SessionState } from '../geo/route-session';
import { getProvider } from '../geo/route-provider';
import { cacheGet, cacheSet, routeKey } from '../geo/route-cache';
import { RouteError, type RouteMatrix } from '../geo/types';
import { fetchNow } from '../weather';
import { loadIntel } from './data';
import { profileStore } from './profile-store';
import { track } from './analytics';
import { recommendationCard, esc } from './cards';
import { buildContext } from '@/lib/intel/context';
import { rank, type Detour, type WeatherNow } from '@/lib/intel/scoring';
import { corridorCandidates, detourMatrixPoints, insertionIndex, measuredDetours, type CorridorCandidate } from '@/lib/intel/route-aware';
import { diversifyTrip } from '@/lib/intel/diversify';
import { alternativeCard } from './alternatives';
import { INTEREST_LABEL } from '@/lib/intel/taxonomy';
import type { IntelDataset, ProfileInterest, TouristProfile } from '@/lib/intel/types';

const MAX_CARDS = 5;

/** Profile used on Mi Ruta: the saved one, or the interests of the saved places when none was chosen. */
export function effectiveProfile(ds: IntelDataset, ids: string[]): { profile: TouristProfile; implicit: boolean } {
  const profile = profileStore.get();
  if (profile.interests.length) return { profile, implicit: false };
  const count = new Map<ProfileInterest, number>();
  for (const p of ds.places) if (ids.includes(p.id) || (p.route_id && ids.includes(p.route_id))) for (const i of p.interests) count.set(i, (count.get(i) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([i]) => i);
  return { profile: { ...profile, interests: top }, implicit: top.length > 0 };
}

export async function initRouteRecos(box: HTMLElement): Promise<void> {
  const found = box.querySelector<HTMLElement>('[data-near]');
  if (!found) return;
  const section: HTMLElement = found;
  const $ = <T extends HTMLElement>(s: string) => section.querySelector<T>(s)!;
  const list = $<HTMLUListElement>('[data-near-list]');
  const lede = $('[data-near-lede]');
  const measureBtn = $<HTMLButtonElement>('[data-near-measure]');
  const note = $('[data-near-note]');
  const alts = box.querySelector<HTMLElement>('[data-alts]');
  const altsList = box.querySelector<HTMLElement>('[data-alts-list]');
  const altsLede = box.querySelector<HTMLElement>('[data-alts-lede]');
  let altSig = '';

  let ds: IntelDataset;
  try { ds = await loadIntel(box.dataset.intelUrl!); } catch { return; } // the planner keeps its own rule-based suggestions
  box.setAttribute('data-intel-corridor', '');

  let weather: Record<string, WeatherNow> | null = null;
  const wxPoints = JSON.parse(box.dataset.wx ?? '[]') as { key: string; lat: number; lon: number }[];
  fetchNow(wxPoints)
    .then((now) => { weather = Object.fromEntries(wxPoints.map((p, i) => [p.key, { temp: now[i].temp, code: now[i].code, precip: now[i].precip, rainProb: now[i].rainProb }])); sig = ''; render(routeSession.get()); })
    .catch(() => { /* scored without weather */ });

  let sig = '';
  let shown: CorridorCandidate[] = [];
  let measured: Map<string, Detour> | null = null;
  let measuredFor = '';
  const inserts = new Map<string, number>();

  function render(s: SessionState) {
    const ids = route.get();
    if (s.phase === 'loading') return; // wait for a settled route before suggesting
    const geometry = s.phase === 'ok' && s.result ? (s.altIndex ? s.result.alternatives[s.altIndex - 1]?.geometry ?? s.result.geometry : s.result.geometry) : null;
    const routeSig = [ids.join(), s.result?.computedAt ?? '', s.altIndex, s.profile, s.phase].join('#');
    const next = [routeSig, JSON.stringify(profileStore.get()), weather ? 1 : 0, measured ? 1 : 0].join('|');
    if (next === sig) return;
    sig = next;
    if (routeSig !== measuredFor) measured = null; // measured detours belong to one route
    section.hidden = ids.length === 0;
    renderAlternatives(s, geometry?.coordinates ?? null);
    if (!geometry) {
      shown = [];
      list.innerHTML = '';
      measureBtn.hidden = true;
      note.textContent = '';
      lede.textContent = s.phase === 'error'
        ? 'Sin una ruta calculada no hay recorrido contra el cual medir: no estimamos desvíos ni distancias por carretera. Reintenta la ruta para ver lugares cercanos.'
        : 'Cuando tu ruta tenga al menos dos puntos, aquí aparecerán lugares cercanos a ese recorrido.';
      return;
    }
    const { profile, implicit } = effectiveProfile(ds, ids);
    const mode = s.profile;
    const cands = corridorCandidates({ line: geometry.coordinates, waypoints: s.waypoints.map((w) => w.coord), mode, places: ds.places, exclude: new Set(ids) });
    const byId = new Map(cands.map((c) => [c.place.id, c]));
    const detours = new Map(cands.map((c) => [c.place.id, measured?.get(c.place.id) ?? c.detour]));
    const ctx = buildContext({ dataset: ds, profile: { ...profile, mode }, weather, routeIds: ids, detours });
    const recs = rank(cands.map((c) => c.place), ctx, { limit: MAX_CARDS, perMunicipality: 2 });
    shown = recs.map((r) => byId.get(r.place.id)!);
    const hasOrigin = !!s.waypoints[0]?.id.startsWith('origin:');
    inserts.clear();
    list.innerHTML = recs.map((r, i) => {
      const c = byId.get(r.place.id)!;
      const d = r.detour!;
      const nextStop = s.waypoints[c.beforeStop];
      inserts.set(r.place.route_id ?? r.place.id, insertionIndex(c, hasOrigin));
      const lead = `≈ +${Math.round(d.extraMin)} min ${d.measured ? 'por carretera (ida y vuelta desde tu ruta)' : 'estimados'} · a ${c.offRouteKm < 1 ? 'menos de 1' : Math.round(c.offRouteKm)} km de tu ruta${nextStop && !nextStop.id.startsWith('origin:') ? ` · antes de llegar a ${nextStop.name}` : ''}`;
      return recommendationCard(r, ds, { rank: i + 1, surface: 'mi-ruta', compact: true, lead });
    }).join('');
    const whose = implicit ? `según lo que guardaste (${profile.interests.map((i) => INTEREST_LABEL[i]).join(', ')})` : profile.interests.length ? `según tus intereses (${profile.interests.map((i) => INTEREST_LABEL[i]).join(', ')})` : 'sin intereses elegidos';
    lede.innerHTML = recs.length
      ? `Lugares a pocos minutos de la ruta que ya calculaste, ${esc(whose)}. El tiempo adicional ${measured ? 'se midió por carretera con el servicio de rutas' : 'es una estimación a partir de la distancia a la ruta, no una medición'}; no incluye el tiempo de visita ni tráfico.`
      : 'No encontramos lugares de la base cerca de este recorrido que coincidan con tus intereses.';
    measureBtn.hidden = recs.length === 0 || !!measured || !s.provider;
    if (!measured) note.textContent = '';
    document.dispatchEvent(new Event('route:refresh'));
    if (recs.length) track('recommendation_seen', { place_ids: recs.map((r) => r.place.id), surface: 'mi-ruta', top_score: recs[0].score });
  }

  /**
   * Alternatives in less exposed municipalities for the saved stops. With a route, the cost is the
   * estimated detour from it; without one, the straight-line distance from the stop (labelled).
   */
  function renderAlternatives(s: SessionState, line: [number, number][] | null) {
    if (!alts || !altsList || !altsLede) return;
    const ids = route.get();
    const anchors = ds.places.filter((p) => ids.includes(p.id) || (p.route_id && ids.includes(p.route_id)));
    const { profile } = effectiveProfile(ds, ids);
    const cands = line ? corridorCandidates({ line, waypoints: s.waypoints.map((w) => w.coord), mode: s.profile, places: ds.places, exclude: new Set(ids) }) : [];
    const detours = new Map(cands.map((c) => [c.place.id, c.detour]));
    const found = diversifyTrip(anchors, ds.places, {
      month: new Date().getMonth() + 1, mode: s.profile, municipalities: new Map(ds.municipalities.map((m) => [m.id, m])), exclude: new Set(ids),
      routeRegions: new Set(anchors.map((a) => a.region).filter((r): r is NonNullable<typeof r> => !!r)),
      detourOf: line ? (p) => detours.get(p.id) ?? null : undefined, interests: profile.interests,
    }, 3);
    alts.hidden = found.length === 0;
    altsList.innerHTML = found.map((a, i) => alternativeCard(a, ds, 'mi-ruta-alternativas', i + 1)).join('');
    altsLede.textContent = 'Lugares parecidos a los que guardaste, en municipios con menor exposición turística estimada y un coste adicional pequeño. La exposición es un indicador derivado (proxy): el portal no mide afluencia ni ocupación.';
    document.dispatchEvent(new Event('route:refresh'));
    const key = found.map((a) => a.place.id).join();
    if (found.length && key !== altSig) { altSig = key; track('alternative_seen', { anchor_id: found[0].anchor.id, place_ids: found.map((a) => a.place.id) }); }
  }
  alts?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-route-add]');
    const card = b?.closest<HTMLElement>('[data-reco]');
    if (!b || !card || route.has(b.dataset.routeAdd!)) return;
    track('recommendation_added', { place_id: card.dataset.reco, surface: 'mi-ruta-alternativas', score: +card.dataset.score!, rank: +card.dataset.rank! });
    track('destination_added', { place_id: card.dataset.reco, source: 'alternativas' });
  });

  // one matrix request, only on demand
  measureBtn.addEventListener('click', async () => {
    const s = routeSession.get();
    const provider = await getProvider();
    if (!provider || !shown.length) return;
    const points = detourMatrixPoints(shown);
    const key = routeKey('matrix', provider.id, s.profile, points);
    measureBtn.disabled = true;
    note.textContent = 'Consultando al servicio de rutas (una sola solicitud)…';
    try {
      let m = cacheGet<RouteMatrix>(key);
      if (!m) { m = await provider.matrix(points, s.profile); cacheSet(key, m, false); }
      measured = measuredDetours(shown, m.durations);
      measuredFor = [route.get().join(), s.result?.computedAt ?? '', s.altIndex, s.profile, s.phase].join('#');
      note.textContent = measured.size < shown.length ? 'Algunos lugares no tienen conexión por carretera conocida: conservan su estimación.' : `Desvíos medidos por carretera. ${provider.attribution}. Sin tráfico en tiempo real.`;
      sig = '';
      render(routeSession.get());
    } catch (e) {
      const err = e instanceof RouteError ? e : new RouteError('unknown');
      note.textContent = `No se pudieron medir los desvíos. ${errorMessage(err)} Se conservan las estimaciones.`;
    } finally {
      measureBtn.disabled = false;
    }
  });

  // adding from this list: log it and place the stop where the route passes
  section.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-route-add]');
    const card = b?.closest<HTMLElement>('[data-reco]');
    if (!b || !card) return;
    const id = b.dataset.routeAdd!;
    if (route.has(id)) return;
    track('recommendation_added', { place_id: card.dataset.reco, surface: 'mi-ruta', score: +card.dataset.score!, rank: +card.dataset.rank! });
    track('destination_added', { place_id: card.dataset.reco, source: 'cerca-de-tu-recorrido' });
    const at = inserts.get(id);
    // the global handler appends the stop; move it right after, in the same task, so one route request follows
    if (at !== undefined) setTimeout(() => route.moveTo(id, at), 0);
  });

  routeSession.subscribe(render);
  profileStore.subscribe(() => { sig = ''; render(routeSession.get()); });
}
