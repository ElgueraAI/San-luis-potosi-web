/**
 * MapLibre controller for every [data-map] (see MapView.astro).
 * Loaded on demand. Basemap: OpenFreeMap "positron" vector style (no key);
 * if it cannot load, a plain paper background keeps the points usable.
 * Weather failures never touch the map.
 *
 * Location and routing live in src/scripts/geo/: the visitor position is
 * requested only from «Usar mi ubicación»; routes come from the routing
 * provider through route-session (never a straight line between stops).
 * Live navigation (geo/nav-controller.ts) is drawn only by the route-mode map
 * on /mi-ruta/: travelled part muted, camera follows until the visitor pans.
 */
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MLMap, NavigationControl, AttributionControl, LngLatBounds, setWorkerUrl, type GeoJSONSource, type StyleSpecification, type MapMouseEvent } from 'maplibre-gl';

// v6 worker = module + sibling shared chunk, served from public/vendor/maplibre
// (copied by scripts/vendor-maplibre.mjs on every build).
setWorkerUrl(new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/vendor/maplibre/maplibre-gl-worker.mjs`, location.href).href);
import { route, refreshRouteButtons } from './route-store';
import { fetchNow, conditionText } from './weather';
import { COLORS, REGION_NAME, esc, loadPlaces, type Place } from './geo/places';
import { geoLocation } from './geo/location-service';
import { locationReadout } from './geo/location-ui';
import { UserLayer, RouteLayer } from './geo/map-layers';
import { routeSession, errorMessage, type SessionState } from './geo/route-session';
import { fmtDistance, fmtDuration } from './geo/format';
import { navigation } from './geo/nav-controller';
import { isActive, type NavState } from './geo/navigation';
import { splitAt } from './geo/route-geometry';

const STATE_BOUNDS: [[number, number], [number, number]] = [[-102.35, 21.1], [-98.3, 24.55]];
const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#ece6da' } }],
};
type Group = NonNullable<Place['group']>;

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
  return document.documentElement.dataset.motion === 'static' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function mountMap(el: HTMLElement): Promise<void> {
  if (el.dataset.mapMounted) return; // one controller per element, never duplicate listeners
  el.dataset.mapMounted = '1';
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
  // entity points (museums, lodging, seats…) are optional clustered layers on the discovery map
  let base = places.filter((p) => p.layer !== 'entity' || p.id === focus);
  if (lockRegion) base = base.filter((p) => p.region === lockRegion);
  if (mode === 'mini' && focus) base = base.filter((p) => p.id === focus);

  const filters = { region: 'all', interests: new Set<string>(), layers: new Set<Group>() };
  let selected: string | null = null;
  const visible = (): Place[] => {
    if (mode === 'route') return []; // stops are drawn as numbered waypoints by RouteLayer
    return base.filter((p) =>
      (filters.region === 'all' || p.region === filters.region) &&
      (filters.interests.size === 0 || p.interests.some((i) => filters.interests.has(i))),
    );
  };
  const extras = (): Place[] => places.filter((p) => p.group && filters.layers.has(p.group) && (filters.region === 'all' || p.region === filters.region));

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
      maxZoom: 16,
      minZoom: 5,
    });
  } catch {
    showError('Tu navegador no puede mostrar el mapa interactivo (WebGL no disponible). La lista de lugares sigue disponible.');
    initListOnly();
    return;
  }
  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  const attribution = new AttributionControl({ compact: true, customAttribution: 'Puntos: INEGI, INAH, © OpenStreetMap contributors' });
  map.addControl(attribution, 'bottom-right');

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

  const user = new UserLayer(map);
  const routeLayer = new RouteLayer(map);
  let styleReady = false;
  /** live navigation is drawing this map (declared early: listeners below read it on subscribe) */
  let navOn = false;

  map.on('style.load', () => {
    clearTimeout(styleTimer);
    state.hidden = true;
    if (!styleFailed) tintBasemap(map);
    addLayers();
    styleReady = true;
    // a style swap (fallback) drops custom sources: redraw what we had
    drawRouteState(routeSession.get(), true);
    if (navOn) drawNav(navigation.get(), true);
    user.update(geoLocation.get().fix, geoLocation.get().status === 'stale');
  });

  function addLayers() {
    if (map.getSource('places')) return;
    if (mode === 'full') addExtras();
    map.addSource('places', { type: 'geojson', data: toGeo(visible(), selected) });
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
    for (const layer of ['places-prov', 'places-ready', 'extras-points']) {
      if (!map.getLayer(layer)) continue;
      map.on('click', layer, (e) => { if (picking) return; const id = e.features?.[0]?.properties?.id; if (id) select(String(id), false); });
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    refresh(true);
  }

  // ---- clustered extra layers (full map) ---------------------------------------
  function addExtras() {
    map.addSource('extras', { type: 'geojson', data: toGeo(extras(), null), cluster: true, clusterRadius: 46, clusterMaxZoom: 12 });
    map.addLayer({
      id: 'extras-clusters', type: 'circle', source: 'extras', filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#fbf8f2', 'circle-stroke-color': '#1f2524', 'circle-stroke-width': 1.4, 'circle-opacity': 0.95,
        'circle-radius': ['step', ['get', 'point_count'], 13, 10, 16, 50, 20, 150, 25],
      },
    });
    // count labels need the style's glyphs; the plain fallback style has none
    if (!styleFailed && map.getStyle().glyphs) {
      map.addLayer({
        id: 'extras-count', type: 'symbol', source: 'extras', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true },
        paint: { 'text-color': '#1f2524' },
      });
    }
    map.addLayer({
      id: 'extras-points', type: 'circle', source: 'extras', filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 4.5, 'circle-color': ['case', ['==', ['get', 'status'], 'ready'], ['get', 'color'], '#fbf8f2'],
        'circle-stroke-color': ['case', ['==', ['get', 'status'], 'ready'], '#ffffff', ['get', 'color']], 'circle-stroke-width': 1.6,
      },
    });
    map.on('click', 'extras-clusters', async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const zoom = await (map.getSource('extras') as GeoJSONSource).getClusterExpansionZoom(f.properties!.cluster_id as number);
      map.easeTo({ center: (f.geometry as { coordinates: [number, number] }).coordinates, zoom, duration: reducedMotion() ? 0 : 500 });
    });
    map.on('mouseenter', 'extras-clusters', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'extras-clusters', () => (map.getCanvas().style.cursor = ''));
  }

  // ---- refresh -----------------------------------------------------------------
  const list = el.querySelector<HTMLUListElement>('[data-map-list]');
  const count = el.querySelector<HTMLElement>('[data-map-count]');
  const empty = el.querySelector<HTMLElement>('[data-map-empty]');
  function refresh(fit = false) {
    const v = visible();
    (map.getSource('places') as GeoJSONSource | undefined)?.setData(toGeo(v, selected));
    (map.getSource('extras') as GeoJSONSource | undefined)?.setData(toGeo(extras(), null));
    if (count) count.textContent = String(v.length);
    if (empty) empty.hidden = v.length > 0;
    renderList(v);
    if (fit && mode !== 'route') fitTo(v);
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
        ${p.url ? `<a class="btn" href="${p.url}">${p.layer === 'entity' ? 'Ver ficha' : 'Ver destino'}</a>` : ''}
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
  el.querySelector('[data-layer-group]')?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-layer]');
    if (!b) return;
    const v = b.dataset.layer as Group;
    filters.layers.has(v) ? filters.layers.delete(v) : filters.layers.add(v);
    b.setAttribute('aria-pressed', String(filters.layers.has(v)));
    refresh(false);
  });
  el.querySelector('[data-map-reset]')?.addEventListener('click', () => {
    filters.region = 'all';
    filters.interests.clear();
    el.querySelectorAll('[data-filter-group] button').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLElement).dataset.value === 'all')));
    refresh(true);
  });

  if (mode === 'mini' && focus) {
    map.once('idle', () => {
      const p = base[0];
      if (p) map.jumpTo({ center: p.coords!, zoom: 10 });
    });
  }

  // ---- visitor location ------------------------------------------------------------
  const locBtn = el.querySelector<HTMLButtonElement>('[data-geo-locate]');
  const locLabel = el.querySelector<HTMLElement>('[data-geo-label]');
  const card = el.querySelector<HTMLElement>('[data-geo-card]');
  const legendGeo = el.querySelector<HTMLElement>('[data-legend-geo]');
  let cardDismissed = false;
  let flewToFix = false;

  function flyToFix() {
    const fix = geoLocation.get().fix;
    if (!fix) return;
    // zoom so the accuracy circle is readable: tight fix → street level, coarse → town level
    const zoom = fix.accuracy < 200 ? 15 : fix.accuracy < 1500 ? 13 : fix.accuracy < 8000 ? 11 : 9;
    map.flyTo({ center: fix.coord, zoom, duration: reducedMotion() ? 0 : 900 });
  }

  function renderCard() {
    if (!card) return;
    const s = geoLocation.get();
    if (s.status === 'idle' || cardDismissed) { card.hidden = true; return; }
    const canRoute = !!s.fix && s.status !== 'denied';
    const inOverlay = mode === 'route' || overlayOn;
    card.innerHTML = `<div class="geo-card__head"><div>${locationReadout(s)}</div>
        <button type="button" class="geo-card__x" data-geo-close aria-label="Ocultar datos de ubicación">✕</button></div>
      ${s.fix ? `<div class="geo-card__acts">
        <button type="button" class="geo-act" data-geo-follow aria-pressed="${s.watching}">${s.watching ? 'Dejar de seguir' : 'Seguir mi posición'}</button>
        ${canRoute && mode !== 'mini' ? `<button type="button" class="geo-act" data-geo-start aria-pressed="${routeSession.get().origin.kind === 'gps' && inOverlay}">Iniciar Mi Ruta aquí</button>` : ''}
        <button type="button" class="geo-act" data-geo-forget>Olvidar</button>
      </div>` : s.status === 'requesting' ? '' : `<div class="geo-card__acts"><button type="button" class="geo-act" data-geo-retry>Reintentar</button></div>`}`;
    card.hidden = false;
  }

  card?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.hasAttribute('data-geo-close')) { cardDismissed = true; renderCard(); locBtn?.focus(); }
    else if (b.hasAttribute('data-geo-follow')) geoLocation.get().watching ? geoLocation.stopFollowing() : geoLocation.follow();
    else if (b.hasAttribute('data-geo-forget')) { geoLocation.forget(); if (routeSession.get().origin.kind === 'gps') routeSession.setOrigin({ kind: 'first' }); }
    else if (b.hasAttribute('data-geo-retry')) void locate();
    else if (b.hasAttribute('data-geo-start')) {
      routeSession.setOrigin({ kind: 'gps' });
      if (mode !== 'route' && !overlayOn) void setOverlay(true);
      renderCard();
    }
  });

  async function locate() {
    cardDismissed = false;
    locBtn?.setAttribute('aria-busy', 'true');
    const fix = await geoLocation.locate();
    locBtn?.removeAttribute('aria-busy');
    if (fix) { flewToFix = true; flyToFix(); }
  }

  locBtn?.addEventListener('click', () => {
    const s = geoLocation.get();
    if (s.fix && s.status !== 'stale') { cardDismissed = false; renderCard(); flyToFix(); }
    else void locate();
  });

  geoLocation.subscribe((s) => {
    if (locLabel) locLabel.textContent = s.fix ? 'Centrar en mí' : s.status === 'requesting' ? 'Buscando…' : 'Usar mi ubicación';
    if (legendGeo) legendGeo.hidden = !s.fix;
    if (styleReady) user.update(s.fix, s.status === 'stale');
    // while following, keep the dot in view without fighting the visitor's own panning
    if (!navOn && s.watching && s.fix && flewToFix && !map.getBounds().contains(s.fix.coord)) map.easeTo({ center: s.fix.coord, duration: reducedMotion() ? 0 : 500 });
    renderCard();
  });

  // ---- Mi Ruta on the map (route mode always; discovery maps on demand) --------------------
  const overlayBtn = el.querySelector<HTMLButtonElement>('[data-route-overlay]');
  const bar = el.querySelector<HTMLElement>('[data-route-bar]');
  const legendRoute = el.querySelector<HTMLElement>('[data-legend-route]');
  const routeAttr = el.querySelector<HTMLElement>('[data-route-attr]');
  let overlayOn = mode === 'route';
  let lastSig = '';
  let unsub: (() => void) | null = null;

  async function setOverlay(on: boolean) {
    overlayOn = on;
    overlayBtn?.setAttribute('aria-pressed', String(on));
    if (on) {
      try { await routeSession.init(el.dataset.placesUrl!); } catch { if (bar) { bar.hidden = false; bar.textContent = 'No se pudo cargar Mi Ruta.'; } return; }
      routeSession.activate();
      unsub ??= routeSession.subscribe((s) => drawRouteState(s, false));
    } else {
      unsub?.(); unsub = null;
      if (mode !== 'route') routeSession.deactivate();
      routeLayer.clear();
      lastSig = '';
      if (bar) bar.hidden = true;
      if (legendRoute) legendRoute.hidden = true;
      if (routeAttr) routeAttr.hidden = true;
    }
    renderCard();
  }
  overlayBtn?.addEventListener('click', () => void setOverlay(!overlayOn));

  function drawRouteState(s: SessionState, force: boolean) {
    if (!overlayOn || !styleReady) return;
    if (navOn) { if (routeAttr && s.result) routeAttr.textContent = ` ${s.result.attribution}.`; return; } // drawn by drawNav
    const regions: Record<string, string> = {};
    s.waypoints.forEach((w) => { const p = routeSession.place(w.id); if (p) regions[w.id] = p.region; });
    const sig = [s.phase, s.result?.computedAt ?? '', s.altIndex, s.waypoints.map((w) => w.id + w.coord.join()).join('|')].join('#');
    if (sig !== lastSig || force) {
      const wpChanged = lastSig.split('#')[3] !== sig.split('#')[3];
      const routeChanged = lastSig.split('#')[1] !== sig.split('#')[1];
      lastSig = sig;
      routeLayer.setRoute(s.phase === 'ok' ? s.result : null, s.altIndex);
      routeLayer.setWaypoints(s.waypoints, regions);
      if (force || wpChanged || (routeChanged && s.phase === 'ok')) routeLayer.fit(s.phase === 'ok' ? s.result : null, s.waypoints, reducedMotion());
    }
    if (legendRoute) legendRoute.hidden = s.phase !== 'ok';
    if (routeAttr) { routeAttr.hidden = !s.provider; routeAttr.textContent = s.provider ? ` ${s.result?.attribution ?? s.provider.attribution}.` : ''; }
    if (bar) renderBar(s);
  }

  function renderBar(s: SessionState) {
    if (!bar) return;
    const myRoute = el.dataset.routeUrl!;
    const stops = route.get().length;
    let body: string;
    if (s.phase === 'loading') body = '<p class="geo-st"><span class="geo-st__sym" aria-hidden="true">◌</span>Calculando ruta por carretera…</p>';
    else if (s.phase === 'ok' && s.result) {
      const r = s.altIndex ? s.result.alternatives[s.altIndex - 1] ?? s.result : s.result;
      body = `<p class="label">Mi Ruta · ${stops} ${stops === 1 ? 'lugar' : 'lugares'}</p><p><b>${fmtDistance(r.distance)}</b> · <b>${fmtDuration(r.duration)}</b> aprox.</p>`;
    } else if (s.phase === 'error') body = `<p class="geo-st" data-tone="err"><span class="geo-st__sym" aria-hidden="true">⊘</span>Sin ruta por carretera</p><p class="geo-msg">${errorMessage(s.error)}</p><div class="geo-card__acts"><button type="button" class="geo-act" data-route-retry>Reintentar ruta</button></div>`;
    else if (s.phase === 'disabled') body = '<p class="geo-msg">El cálculo de rutas está desactivado en este sitio. Se muestran solo tus lugares.</p>';
    else body = `<p class="geo-msg">${stops ? 'Guarda otro lugar o usa tu ubicación como inicio para trazar una ruta.' : 'Tu ruta está vacía. Añade lugares desde el panel.'}</p>`;
    bar.innerHTML = `${body}<a class="arrow tiny" href="${myRoute}">Abrir Mi Ruta</a>`;
    bar.hidden = false;
  }
  bar?.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-route-retry]')) routeSession.retry(); });

  if (mode === 'route') void setOverlay(true);

  // ---- live navigation (route mode only; state machine lives in nav-controller) ------------
  const recenterBtn = el.querySelector<HTMLButtonElement>('[data-nav-recenter]');
  const legendDone = el.querySelector<HTMLElement>('[data-legend-done]');
  let navSig = '';
  let splitAlong = -1;
  let lastFollowFix: unknown = null;

  function drawNav(n: NavState, force = false) {
    if (!styleReady) return;
    const line = navigation.engine.line;
    if (!n.route || !line) return;
    const wps = n.route.waypoints.filter((w) => w.id.startsWith('origin:') || !routeSession.isExcluded(w.id));
    const sig = [n.route.computedAt, wps.map((w) => w.id).join()].join('#');
    if (sig !== navSig || force) {
      navSig = sig;
      splitAlong = -1;
      const regions: Record<string, string> = {};
      wps.forEach((w) => { const p = routeSession.place(w.id); if (p) regions[w.id] = p.region; });
      routeLayer.setWaypoints(wps.slice(1), regions); // the visitor dot is the start
    }
    // redraw the split only when the visitor advanced noticeably (cheap on long routes)
    const along = n.progress?.along ?? 0;
    if (force || splitAlong < 0 || Math.abs(along - splitAlong) > 15) {
      splitAlong = along;
      const { done, rest } = splitAt(line, along);
      routeLayer.setNavigation(done, rest);
    }
    if (legendRoute) legendRoute.hidden = false;
    if (legendDone) legendDone.hidden = along <= 0;
  }

  function follow(n: NavState) {
    const fix = n.fix;
    if (!fix || fix === lastFollowFix || navigation.camera !== 'follow' || !styleReady) return;
    const first = lastFollowFix === null;
    lastFollowFix = fix;
    map.easeTo({ center: fix.coord, zoom: first ? Math.max(map.getZoom(), 14) : map.getZoom(), duration: reducedMotion() ? 0 : 600 });
  }

  if (mode === 'route') {
    // any gesture by the visitor hands the camera back to them; «Recentrar» resumes following
    const toFree = (e: { originalEvent?: unknown }) => { if (navOn && e.originalEvent) navigation.setCamera('free'); };
    map.on('dragstart', toFree);
    map.on('zoomstart', toFree);
    map.on('wheel', () => { if (navOn) navigation.setCamera('free'); });
    recenterBtn?.addEventListener('click', () => navigation.setCamera('follow'));
    navigation.onCamera((c) => {
      if (recenterBtn) recenterBtn.hidden = !(navOn && c === 'free');
      if (c === 'follow') { lastFollowFix = null; follow(navigation.get()); }
    });
    navigation.subscribe((n) => {
      const on = isActive(n.status) && !!n.route;
      if (on !== navOn) {
        navOn = on;
        el.toggleAttribute('data-navigating', on);
        if (recenterBtn) recenterBtn.hidden = !(on && navigation.camera === 'free');
        if (!on) {
          // back to the planning view of the route
          navSig = ''; lastSig = ''; lastFollowFix = null;
          if (legendDone) legendDone.hidden = true;
          if (styleReady) drawRouteState(routeSession.get(), true);
          return;
        }
      }
      if (!on) return;
      drawNav(n);
      follow(n);
    });
  }

  // ---- pick the starting point on the map (route mode) -----------------------------
  const pickBtn = el.querySelector<HTMLButtonElement>('[data-pick-origin]');
  let picking = false;
  const setPicking = (on: boolean) => {
    picking = on;
    pickBtn?.setAttribute('aria-pressed', String(on));
    el.toggleAttribute('data-picking', on);
    const label = pickBtn?.querySelector('span:last-child');
    if (label) label.textContent = on ? 'Toca el mapa · Esc cancela' : 'Elegir inicio en el mapa';
  };
  pickBtn?.addEventListener('click', () => setPicking(!picking));
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picking) { setPicking(false); pickBtn?.focus(); } });
  map.on('click', (e: MapMouseEvent) => {
    if (!picking) return;
    setPicking(false);
    routeSession.setOrigin({ kind: 'point', coord: [e.lngLat.lng, e.lngLat.lat] });
    pickBtn?.focus();
  });

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
