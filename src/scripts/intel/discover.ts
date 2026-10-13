/**
 * /descubre/: light profile (interests, time, mode, budget) + starting point
 * → explainable recommendations. Everything runs in the browser over
 * /data/intel.json; the only network calls are that file and one Open-Meteo
 * request for the six reference points (shared 15-minute cache of weather.ts).
 *
 * Degrades by design: no weather → the weather factor has no data; location
 * denied → choose a municipality; nothing chosen → distance has no data.
 * The visitor's position is read from memory (location-service) and is never
 * stored or logged.
 */
import { route } from '../route-store';
import { geoLocation } from '../geo/location-service';
import { fetchNow } from '../weather';
import { loadIntel } from './data';
import { profileStore } from './profile-store';
import { track, analyticsLog } from './analytics';
import { recommendationCard, esc } from './cards';
import { buildContext, tripMoment, climateNote } from '@/lib/intel/context';
import { rank, type WeatherNow } from '@/lib/intel/scoring';
import { DURATIONS, INTEREST_LABEL, REGION_LABEL, reachKm } from '@/lib/intel/taxonomy';
import type { Coord, IntelDataset, ProfileInterest, TouristProfile } from '@/lib/intel/types';

const ORIGIN_KEY = 'slp:perfil:origen:v1';
type Origin = { kind: 'none' } | { kind: 'gps'; coord: Coord } | { kind: 'muni'; id: string; coord: Coord; name: string };

export async function initDiscover(box: HTMLElement): Promise<void> {
  const $ = <T extends HTMLElement>(s: string) => box.querySelector<T>(s)!;
  /** The privacy panel is its own section, outside the recommender box. */
  const $doc = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
  let seenSig = '';
  const results = $<HTMLUListElement>('[data-results]');
  const status = $('[data-status]');
  const originStatus = $('[data-origin-status]');
  const select = $<HTMLSelectElement>('[data-origin-select]');
  const locateBtn = $<HTMLButtonElement>('[data-origin-locate]');

  let ds: IntelDataset;
  try {
    ds = await loadIntel(box.dataset.intelUrl!);
  } catch {
    status.textContent = 'No se pudieron cargar los datos del recomendador. Revisa tu conexión y recarga la página.';
    return;
  }
  box.removeAttribute('data-loading');

  // ---- starting point ------------------------------------------------------------------
  const seats = ds.municipalities.filter((m) => m.coord).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  select.insertAdjacentHTML('beforeend', Object.entries(REGION_LABEL).map(([r, label]) =>
    `<optgroup label="${label}">${seats.filter((m) => m.region === r).map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}</optgroup>`).join(''));
  let origin = { kind: 'none' } as Origin;
  const setMuni = (id: string): boolean => {
    const m = seats.find((x) => x.id === id);
    origin = m ? { kind: 'muni', id: m.id, coord: m.coord!, name: m.name } : { kind: 'none' };
    // a chosen municipality is a preference, not a position: kept for the session only
    try { m ? sessionStorage.setItem(ORIGIN_KEY, m.id) : sessionStorage.removeItem(ORIGIN_KEY); } catch { /* ignore */ }
    return !!m;
  };
  try { const saved = sessionStorage.getItem(ORIGIN_KEY); if (saved && setMuni(saved)) select.value = saved; } catch { /* ignore */ }
  const fix = geoLocation.get().fix;
  if (origin.kind === 'none' && fix) origin = { kind: 'gps', coord: fix.coord };

  select.addEventListener('change', () => { setMuni(select.value); render(); });
  locateBtn.addEventListener('click', async () => {
    locateBtn.setAttribute('aria-busy', 'true');
    originStatus.textContent = 'Buscando tu ubicación…';
    const f = await geoLocation.locate();
    locateBtn.removeAttribute('aria-busy');
    if (f) { origin = { kind: 'gps', coord: f.coord }; select.value = ''; try { sessionStorage.removeItem(ORIGIN_KEY); } catch { /* ignore */ } }
    render();
  });

  // ---- weather (one request, optional) ---------------------------------------------------
  let weather: Record<string, WeatherNow> | null = null;
  let weatherState: 'pending' | 'ok' | 'failed' = 'pending';
  const wxPoints = JSON.parse(box.dataset.wx ?? '[]') as { key: string; lat: number; lon: number }[];
  fetchNow(wxPoints)
    .then((now) => { weather = Object.fromEntries(wxPoints.map((p, i) => [p.key, { temp: now[i].temp, code: now[i].code, precip: now[i].precip, rainProb: now[i].rainProb }])); weatherState = 'ok'; })
    .catch(() => { weatherState = 'failed'; })
    .finally(() => render());

  // ---- profile controls --------------------------------------------------------------------
  const chips = [...box.querySelectorAll<HTMLButtonElement>('[data-int]')];
  const radios = [...box.querySelectorAll<HTMLInputElement>('input[data-pref]')];
  const syncControls = (p: TouristProfile) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(p.interests.includes(c.dataset.int as ProfileInterest))));
    radios.forEach((r) => (r.checked = p[r.name as 'duration' | 'mode' | 'budget'] === r.value));
  };
  chips.forEach((c) => c.addEventListener('click', () => {
    const id = c.dataset.int as ProfileInterest;
    const cur = profileStore.get().interests;
    const on = !cur.includes(id);
    profileStore.set({ interests: on ? [...cur, id] : cur.filter((x) => x !== id) });
    track('category_selected', { interest: id, selected: on });
  }));
  radios.forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    profileStore.set({ [r.name]: r.value } as Partial<TouristProfile>);
    const p = profileStore.get();
    track('profile_updated', { interests: p.interests.length, duration: p.duration, mode: p.mode, budget: p.budget });
  }));
  profileStore.subscribe((p) => { syncControls(p); render(); });

  // ---- privacy panel -------------------------------------------------------------------------
  const logCount = $doc('[data-log-count]');
  const syncLog = () => { logCount.textContent = String(analyticsLog.all().length); };
  $doc('[data-clear-profile]').addEventListener('click', () => {
    profileStore.clear();
    try { sessionStorage.removeItem(ORIGIN_KEY); } catch { /* ignore */ }
    origin = geoLocation.get().fix ? { kind: 'gps', coord: geoLocation.get().fix!.coord } : { kind: 'none' };
    select.value = '';
    render();
    $doc('[data-privacy-msg]').textContent = 'Se borraron tus preferencias de este navegador.';
  });
  $doc('[data-clear-log]').addEventListener('click', () => { analyticsLog.clear(); syncLog(); $doc('[data-privacy-msg]').textContent = 'Se borró el registro local.'; });
  $doc('[data-export-log]').addEventListener('click', () => analyticsLog.export());

  // ---- adding a recommendation ------------------------------------------------------------------
  box.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-route-add]');
    const card = b?.closest<HTMLElement>('[data-reco]');
    if (!b || !card || route.has(b.dataset.routeAdd!)) return; // only additions are logged here
    track('recommendation_added', { place_id: card.dataset.reco, surface: card.dataset.surface, score: +card.dataset.score!, rank: +card.dataset.rank! });
    track('destination_added', { place_id: card.dataset.reco, source: 'descubre' });
    syncLog();
  });

  // ---- render --------------------------------------------------------------------------------------
  function render() {
    const profile = profileStore.get();
    const moment = tripMoment();
    const loc = geoLocation.get();
    originStatus.textContent = origin.kind === 'gps' ? 'Usando tu ubicación actual (solo en esta página; no se guarda).'
      : origin.kind === 'muni' ? `Saliendo de ${origin.name} (cabecera municipal, INEGI).`
      : loc.status === 'denied' ? 'Sin permiso de ubicación: elige un municipio de partida para calcular distancias.'
      : loc.status === 'unavailable' || loc.status === 'timeout' ? 'No fue posible obtener tu ubicación: elige un municipio de partida.'
      : loc.status === 'unsupported' || loc.status === 'insecure' ? 'Este navegador no ofrece ubicación aquí: elige un municipio de partida.'
      : 'Sin punto de partida: las recomendaciones no consideran la distancia.';

    const ctx = buildContext({ dataset: ds, profile, origin: origin.kind === 'none' ? null : origin.coord, weather, routeIds: route.get() });
    const recs = rank(ds.places, ctx, { limit: 9, exclude: new Set(route.get()) });
    const dur = DURATIONS.find((d) => d.id === profile.duration)!.label.toLowerCase();
    const parts = [
      profile.interests.length ? `${recs.length} ${recs.length === 1 ? 'lugar' : 'lugares'} para ${profile.interests.map((i) => INTEREST_LABEL[i]).join(', ')}` : `${recs.length} lugares; elige intereses para afinar la selección`,
      `${moment.monthName}, ${moment.season}`,
      origin.kind === 'none' ? 'sin distancia' : `alcance cómodo para ${dur}: ${reachKm(profile.duration, profile.mode)} km en línea recta (supuesto)`,
      weatherState === 'ok' ? 'clima actual incluido' : weatherState === 'failed' ? 'clima actual no disponible: no se usa en el puntaje' : 'consultando clima…',
    ];
    status.textContent = `${parts.join(' · ')}.`;
    $('[data-empty]').hidden = recs.length > 0;
    results.innerHTML = recs.map((r, i) => recommendationCard(r, ds, { rank: i + 1, surface: 'descubre' })).join('');
    const top = recs[0]?.place.region ?? null;
    const note = climateNote(ds, top, moment.month);
    $('[data-climate]').textContent = note ? `${REGION_LABEL[top!]}: ${note}.` : '';
    document.dispatchEvent(new Event('route:refresh'));
    box.dispatchEvent(new CustomEvent('intel:ranked', { detail: { recs, ctx, ds } }));

    const sig = recs.map((r) => r.place.id).join();
    if (recs.length && sig !== seenSig) {
      seenSig = sig;
      track('recommendation_seen', { place_ids: recs.map((r) => r.place.id), surface: 'descubre', top_score: recs[0].score });
    }
    syncLog();
  }

  syncControls(profileStore.get());
  geoLocation.subscribe(() => { if (origin.kind === 'none') render(); });
  render();
}
