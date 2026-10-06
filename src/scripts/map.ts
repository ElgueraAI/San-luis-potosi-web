/**
 * MapLibre controller for every [data-map] (see MapView.astro).
 * Loaded on demand. Basemap: OpenFreeMap "positron" vector style (no key);
 * if it cannot load, a plain paper background keeps the points usable.
 * Weather failures never touch the map.
 */
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MLMap, Marker, NavigationControl, AttributionControl, LngLatBounds, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';

// v6 worker = module + sibling shared chunk, served from public/vendor/maplibre
// (copied by scripts/vendor-maplibre.mjs on every build).
setWorkerUrl(new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/vendor/maplibre/maplibre-gl-worker.mjs`, location.href).href);
import { route, refreshRouteButtons } from './route-store';
import { fetchNow, conditionText } from './weather';

type Place = {
  id: string; name: string; region: string; kind: string; municipality: string | null; description: string | null;
  url: string | null; coords: [number, number] | null; status: 'ready' | 'provisional' | 'none'; interests: string[]; layer?: 'destination' | 'entity';
  image: string | null; weather: { key: string; name: string; lat: number; lon: number };
};

const COLORS: Record<string, string> = { altiplano: '#b66a32', centro: '#9e5f67', 'zona-media': '#3d8f8a', huasteca: '#176b57' };
const REGION_NAME: Record<string, string> = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };
const STATE_BOUNDS: [[number, number], [number, number]] = [[-102.35, 21.1], [-98.3, 24.55]];
const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ece6da' } }],
};

let placesPromise: Promise<Place[]> | null = null;
function loadPlaces(url: string): Promise<Place[]> {
  placesPromise ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`places ${r.status}`);
    return r.json();
  });
  return placesPromise;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function toGeo(list: Place[], selected: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: list.filter((p) => p.coords).map((p) => ({
      type: 'Feature' as const,
      id: p.id,
      geometry: { type: 'Point' as const, coordinates: p.coords! },
      properties: { id: p.id, color: COLORS[p.region] ?? '#1f2524', status: p.status, sel: p.id === selected ? 1 : 0 },
    })),
  };
}

function reducedMotion() {
  return document.documentElement.dataset.motion === 'static';
}

export async function mountMap(el: HTMLElement): Promise<void> {
  const mode = el.dataset.mapMode ?? 'full';
  const canvas = el.querySelector<HTMLElement>('[data-map-canvas]')!;
  const state = el.querySelector<HTMLElement>('[data-map-state]')!;
  const stateText = el.querySelector<HTMLElement>('[data-map-state-text]')!;
  const showError = (msg: string) => { state.hidden = false; state.setAttribute('data-error', ''); stateText.textContent = msg; };

  let places: Place[];
  try {
    places = (await loadPlaces(el.dataset.placesUrl!)).filter((p) => p.coords && p.status !== 'none');
  } catch {
    showError('No se pudieron cargar los lugares del mapa. Revisa tu conexión e inténtalo de nuevo.');
    return;
  }

  // ---- which places this map shows --------------------------------------
  const lockRegion = el.dataset.mapRegion ?? null;
  const focus = el.dataset.mapFocus ?? null;
  // entity points (museums, lodging, seats…) exist for Mi Ruta and mini maps, not the discovery map
  let base = places.filter((p) => p.layer !== 'entity' || p.id === focus);
  if (lockRegion) base = base.filter((p) => p.region === lockRegion);
  if (mode === 'mini' && focus) base = base.filter((p) => p.id === focus);

  const filters = { region: 'all', interests: new Set<string>() };
  let selected: string | null = null;
  const visible = (): Place[] => {
    if (mode === 'route') {
      const ids = route.get();
      return ids.map((id) => places.find((p) => p.id === id)).filter((p): p is Place => !!p);
    }
    return base.filter((p) =>
      (filters.region === 'all' || p.region === filters.region) &&
      (filters.interests.size === 0 || p.interests.some((i) => filters.interests.has(i))),
    );
  };

  // ---- the map ----------------------------------------------------------------
  let map: MLMap;
  try {
    map = new MLMap({
      container: canvas,
      style: BASEMAP,
      bounds: STATE_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      cooperativeGestures: mode !== 'full',
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 15,
      minZoom: 5,
    });
  } catch {
    showError('Tu navegador no puede mostrar el mapa interactivo (WebGL no disponible). La lista de lugares sigue disponible.');
    initListOnly();
    return;
  }
  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new AttributionControl({ compact: true, customAttribution: 'Puntos: INEGI, INAH, © OpenStreetMap contributors' }), 'bottom-right');

  // Basemap failure: swap in a plain ground so the data stays visible.
  let styleFailed = false;
  const styleTimer = setTimeout(() => { if (!map.isStyleLoaded()) useFallback(); }, 9000);
  map.on('error', (e) => {
    const msg = String((e as unknown as { error?: { message?: string } }).error?.message ?? '');
    if (!map.isStyleLoaded() && /style|fetch|Failed/i.test(msg)) useFallback();
  });
  function useFallback() {
    if (styleFailed) return;
    styleFailed = true;
    map.setStyle(FALLBACK_STYLE);
  }

  map.on('style.load', () => {
    clearTimeout(styleTimer);
    state.hidden = true;
    if (!styleFailed) tintBasemap(map);
    addLayers();
  });

  function addLayers() {
    if (map.getSource('places')) return;
    map.addSource('places', { type: 'geojson', data: toGeo(visible(), selected) });
    if (mode === 'route') {
      map.addSource('route-line', { type: 'geojson', data: lineData() });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route-line', paint: { 'line-color': '#1f2524', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
    }
    map.addLayer({
      id: 'places-prov', type: 'circle', source: 'places', filter: ['==', ['get', 'status'], 'provisional'],
      paint: {
        'circle-radius': ['case', ['==', ['get', 'sel'], 1], 9, 6],
        'circle-color': '#fbf8f2',
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2.2,
        'circle-opacity': 0.9,
      },
    });
    map.addLayer({
      id: 'places-ready', type: 'circle', source: 'places', filter: ['==', ['get', 'status'], 'ready'],
      paint: {
        'circle-radius': ['case', ['==', ['get', 'sel'], 1], 9.5, 6.5],
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.6,
      },
    });
    for (const layer of ['places-prov', 'places-ready']) {
      map.on('click', layer, (e) => { const id = e.features?.[0]?.properties?.id; if (id) select(String(id), false); });
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    refresh(true);
  }

  // ---- route mode helpers ---------------------------------------------------
  let numberMarkers: Marker[] = [];
  function lineData() {
    const v = visible();
    return { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: v.length > 1 ? v.map((p) => p.coords!) : [] } };
  }
  function drawNumbers() {
    numberMarkers.forEach((m) => m.remove());
    numberMarkers = visible().map((p, i) => {
      const n = document.createElement('span');
      n.className = 'route-num';
      n.textContent = String(i + 1);
      n.style.cssText = `display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:${COLORS[p.region]};color:#fff;font:700 12px/1 Manrope Variable,system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.3)`;
      n.setAttribute('aria-hidden', 'true');
      return new Marker({ element: n }).setLngLat(p.coords!).addTo(map);
    });
  }

  // ---- refresh -----------------------------------------------------------------
  const list = el.querySelector<HTMLUListElement>('[data-map-list]');
  const count = el.querySelector<HTMLElement>('[data-map-count]');
  const empty = el.querySelector<HTMLElement>('[data-map-empty]');
  function refresh(fit = false) {
    const v = visible();
    (map.getSource('places') as GeoJSONSource | undefined)?.setData(toGeo(v, selected));
    if (mode === 'route') {
      (map.getSource('route-line') as GeoJSONSource | undefined)?.setData(lineData());
      drawNumbers();
    }
    if (count) count.textContent = String(v.length);
    if (empty) empty.hidden = v.length > 0;
    renderList(v);
    if (fit) fitTo(v);
  }
  function fitTo(v: Place[]) {
    if (!v.length) return map.fitBounds(STATE_BOUNDS, { padding: 24, duration: 0 });
    if (v.length === 1) return map.jumpTo({ center: v[0].coords!, zoom: mode === 'mini' ? 11 : 10 });
    const b = new LngLatBounds();
    v.forEach((p) => b.extend(p.coords!));
    map.fitBounds(b, { padding: 56, maxZoom: 11, duration: reducedMotion() ? 0 : 600 });
  }
  function renderList(v: Place[]) {
    if (!list) return;
    list.innerHTML = v
      .map((p) => `<li><button type="button" data-pick="${p.id}" aria-current="${p.id === selected}">
        <span class="dot ${p.status === 'provisional' ? 'is-prov' : ''}" style="--c:${COLORS[p.region]}" aria-hidden="true"></span>
        <span>${esc(p.name)}${p.status === 'provisional' ? '<span class="visually-hidden"> (ubicación aproximada)</span>' : ''}</span>
        <span class="reg">${REGION_NAME[p.region]}</span></button></li>`)
      .join('');
  }
  list?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-pick]');
    if (b) select(b.dataset.pick!, true);
  });

  // ---- selection panel -----------------------------------------------------------
  const panel = el.querySelector<HTMLElement>('[data-map-selected]');
  const intro = el.querySelector<HTMLElement>('[data-map-intro]');
  function select(id: string, fly: boolean) {
    const p = places.find((x) => x.id === id);
    if (!p) return;
    selected = id;
    refresh(false);
    if (fly) map.flyTo({ center: p.coords!, zoom: Math.max(map.getZoom(), 9), duration: reducedMotion() ? 0 : 900 });
    if (!panel) return;
    const statusText = p.status === 'ready'
      ? '<span class="status-dot status-dot--ready" aria-hidden="true"></span>Ubicación verificada (fuente oficial)'
      : p.layer === 'entity'
        ? '<span class="status-dot status-dot--provisional" aria-hidden="true"></span>Ubicación aproximada (registro SIC o DENUE)'
        : '<span class="status-dot status-dot--provisional" aria-hidden="true"></span>Ubicación aproximada (OpenStreetMap, no oficial)';
    panel.innerHTML = `<div class="sel" data-region="${p.region}">
      <button type="button" class="sel__back" data-sel-back>← Todos los lugares</button>
      ${p.image ? `<img class="sel__img" src="${p.image}" alt="" width="640" height="427" loading="lazy">` : `<div class="sel__ph">Imagen pendiente · Needs manual asset</div>`}
      <p class="sel__meta">${REGION_NAME[p.region]} · ${esc(p.kind)}${p.municipality ? ` · ${esc(p.municipality)}` : ''}</p>
      <h3 class="sel__name">${esc(p.name)}</h3>
      <p class="sel__status">${statusText}</p>
      ${p.description ? `<p class="sel__desc">${esc(p.description)}</p>` : ''}
      <p class="sel__wx" data-sel-wx><span>Clima en ${esc(p.weather.name)}:</span> <span data-sel-wx-val>cargando…</span></p>
      <div class="sel__actions">
        ${p.url ? `<a class="btn" href="${p.url}">Ver destino</a>` : ''}
        <button type="button" class="rbtn-inline btn btn--ghost" data-route-add="${p.id}" data-route-name="${esc(p.name)}" aria-pressed="false"><span data-route-label>Añadir a Mi Ruta</span></button>
      </div>
    </div>`;
    panel.hidden = false;
    if (intro) intro.hidden = true;
    if (list) list.hidden = true;
    refreshRouteButtons();
    panel.querySelector('[data-sel-back]')?.addEventListener('click', clearSelection);
    (panel.querySelector('.sel__name') as HTMLElement | null)?.setAttribute('tabindex', '-1');
    if (fly) (panel.querySelector('.sel__name') as HTMLElement | null)?.focus({ preventScroll: true });
    const wx = panel.querySelector<HTMLElement>('[data-sel-wx-val]')!;
    fetchNow([{ lat: p.weather.lat, lon: p.weather.lon }])
      .then(([n]) => { wx.innerHTML = `<b>${Math.round(n.temp)}°</b> ${conditionText(n.code)} · máx ${Math.round(n.max)}° / mín ${Math.round(n.min)}° · <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>`; })
      .catch(() => { wx.textContent = 'no disponible en este momento.'; });
  }
  function clearSelection() {
    selected = null;
    if (panel) panel.hidden = true;
    if (intro) intro.hidden = false;
    if (list) list.hidden = false;
    refresh(false);
  }

  // ---- filters ------------------------------------------------------------------
  el.querySelectorAll<HTMLElement>('[data-filter-group]').forEach((g) => {
    g.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('button[data-value]');
      if (!b) return;
      const v = b.dataset.value!;
      if (g.dataset.filterGroup === 'region') {
        filters.region = v;
        g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      } else {
        filters.interests.has(v) ? filters.interests.delete(v) : filters.interests.add(v);
        b.setAttribute('aria-pressed', String(filters.interests.has(v)));
      }
      clearSelection();
      refresh(true);
    });
  });
  el.querySelector('[data-map-reset]')?.addEventListener('click', () => {
    filters.region = 'all';
    filters.interests.clear();
    el.querySelectorAll('[data-filter-group] button').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.value === 'all')));
    refresh(true);
  });

  if (mode === 'route') route.subscribe(() => refresh(true));
  if (mode === 'mini' && focus) {
    map.once('idle', () => {
      const p = base[0];
      if (p) map.jumpTo({ center: p.coords!, zoom: 10 });
    });
  }

  function initListOnly() {
    renderList(visible());
    if (count) count.textContent = String(visible().length);
  }
}

/** Quiet the positron basemap toward the site's paper palette. */
function tintBasemap(map: MLMap) {
  const style = map.getStyle();
  for (const l of style.layers ?? []) {
    try {
      if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', '#efe9dd');
      else if (l.type === 'fill' && /water/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', '#c9dcd8');
      else if (l.type === 'fill' && /landcover|landuse|park|wood|grass/.test(l.id)) map.setPaintProperty(l.id, 'fill-opacity', 0.35);
      else if (l.type === 'symbol' && l.layout && 'text-field' in l.layout) map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']]);
      else if (l.type === 'line' && /boundary/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#8f8676');
    } catch { /* layer without that property */ }
  }
}
