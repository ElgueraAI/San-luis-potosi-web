/**
 * Chapter C of /inteligencia-turistica/: one proportional symbol per
 * municipality. The data arrives embedded in the page (59 rows); the map makes
 * no request besides the basemap tiles. The panel and the select work even if
 * MapLibre or the basemap cannot load. Nothing here reads the visitor's
 * position.
 */
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MLMap, NavigationControl, AttributionControl, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import { symbolRadius } from '@/lib/charts/geometry';
import { esc } from './cards';

setWorkerUrl(new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/vendor/maplibre/maplibre-gl-worker.mjs`, location.href).href);

type LayerId = 'assets' | 'infra' | 'events' | 'exposure' | 'potential';
interface Layer { id: LayerId; label: string; cls: 'observado' | 'derivado'; unit: string; proxy: boolean }
interface Muni {
  id: string; n: string; u: string | null; r: string | null; c: [number, number];
  assets: number; lodging: number; food: number; events: number; infra: number; exposure: number; potential: number; coverage: number;
  ev: { alta: number; media: number; baja: number }; top: { n: string; u: string }[];
}
interface Payload { layers: Layer[]; munis: Muni[]; regions: Record<string, string> }

const BOUNDS: [[number, number], [number, number]] = [[-102.35, 21.1], [-98.3, 24.55]];
const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const FALLBACK: StyleSpecification = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e4e8e2' } }] };
const COLOR = { observado: '#103d35', derivado: '#7a5f22' } as const;
const R_MAX = 26, R_MIN = 5;
const dec = (v: number) => v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function initOpportunityMap(box: HTMLElement): void {
  const data = JSON.parse(document.querySelector('[data-opp-data]')!.textContent!) as Payload;
  const $ = <T extends HTMLElement>(s: string) => box.querySelector<T>(s)!;
  const select = $<HTMLSelectElement>('[data-opp-select]');
  const detail = $('[data-opp-detail]');
  const state = $('[data-opp-state]');
  const byId = new Map(data.munis.map((m) => [m.id, m]));
  let layer = data.layers[0];
  let selected: string | null = null;
  let map: MLMap | null = null;

  const max = (id: LayerId) => Math.max(...data.munis.map((m) => m[id]));
  const geo = () => {
    const mx = max(layer.id);
    return {
      type: 'FeatureCollection' as const,
      features: [...data.munis].sort((a, b) => b[layer.id] - a[layer.id]).map((m) => ({
        type: 'Feature' as const, id: m.id, geometry: { type: 'Point' as const, coordinates: m.c },
        properties: { id: m.id, name: m.n, r: symbolRadius(m[layer.id], mx, R_MAX, R_MIN), empty: m[layer.id] > 0 ? 0 : 1, sel: m.id === selected ? 1 : 0 },
      })),
    };
  };
  const redraw = () => {
    if (!map) return;
    (map.getSource('munis') as GeoJSONSource | undefined)?.setData(geo());
    if (map.getLayer('munis-fill')) map.setPaintProperty('munis-fill', 'circle-color', COLOR[layer.cls]);
  };

  // ---- legend ---------------------------------------------------------------------------
  const syncLegend = () => {
    $('[data-opp-layer-name]').textContent = layer.label;
    const tag = $('[data-opp-layer-class]');
    tag.dataset.class = layer.cls;
    tag.textContent = layer.cls === 'observado' ? 'Dato observado' : layer.proxy ? 'Indicador derivado · proxy' : 'Indicador derivado';
    $('[data-opp-layer-unit]').textContent = layer.unit;
    const mx = max(layer.id);
    $('[data-opp-max]').textContent = `(máximo ${layer.cls === 'observado' ? mx : dec(mx)})`;
    box.style.setProperty('--opp-color', COLOR[layer.cls]);
  };
  box.querySelectorAll<HTMLButtonElement>('[data-opp-layer]').forEach((b) => b.addEventListener('click', () => {
    layer = data.layers.find((l) => l.id === b.dataset.oppLayer)!;
    box.querySelectorAll('[data-opp-layer]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    syncLegend(); redraw();
  }));

  // ---- panel -------------------------------------------------------------------------------
  const meter = (v: number) => `<span class="meter" aria-hidden="true"><i style="--v:${v}"></i></span>`;
  const show = (id: string | null, fly = true) => {
    selected = id;
    select.value = id ?? '';
    const m = id ? byId.get(id) : null;
    if (!m) { redraw(); return; }
    const total = m.ev.alta + m.ev.media + m.ev.baja;
    const evidence = total === 0 ? 'Sin lugares puntuables en la base' : `${m.ev.alta} alta · ${m.ev.media} media · ${m.ev.baja} baja`;
    detail.innerHTML = `
      <p class="case__k">${esc(m.r ? data.regions[m.r] : 'Región por confirmar')}</p>
      <h3 id="opp-t">${esc(m.n)}</h3>
      <dl class="opp__facts">
        <div><dt>Atractivos registrados</dt><dd>${m.assets}${m.assets === 0 ? '<small>Sin registro en la base: no significa que no haya atractivos.</small>' : ''}</dd></div>
        <div><dt>Eventos documentados</dt><dd>${m.events}</dd></div>
        <div><dt>Hospedaje registrado</dt><dd>${m.lodging}<small>no confirma disponibilidad</small></dd></div>
        <div><dt>Alimentos registrados</dt><dd>${m.food}</dd></div>
        <div><dt>Infraestructura · derivado</dt><dd>${dec(m.infra)}${meter(m.infra)}</dd></div>
        <div><dt>Cobertura documental · derivado</dt><dd>${dec(m.coverage)}${meter(m.coverage)}</dd></div>
        <div><dt>Exposición estimada · proxy</dt><dd>${dec(m.exposure)}${meter(m.exposure)}<small>no mide visitantes</small></dd></div>
        <div><dt>Potencial de diversificación · proxy</dt><dd>${dec(m.potential)}${meter(m.potential)}</dd></div>
      </dl>
      <p class="fig__note"><b>Nivel de evidencia de sus lugares:</b> ${evidence}.</p>
      ${m.top.length ? `<p class="cal__sub">Destinos y lugares en el portal</p><ul class="opp__links">${m.top.map((t) => `<li><a href="${esc(t.u)}">${esc(t.n)}</a></li>`).join('')}</ul>` : ''}
      ${m.u ? `<p><a class="arrow" href="${esc(m.u)}">Ficha del municipio</a></p>` : ''}`;
    redraw();
    if (map && fly) {
      const still = document.documentElement.dataset.motion === 'static' || matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.easeTo({ center: m.c, zoom: Math.max(map.getZoom(), 7.4), duration: still ? 0 : 700 });
    }
  };
  select.addEventListener('change', () => show(select.value || null));
  syncLegend();

  // ---- map (lazy) ------------------------------------------------------------------------------
  const mount = async () => {
    state.textContent = 'Cargando mapa…';
    let style: StyleSpecification | string = BASEMAP;
    try { const r = await fetch(BASEMAP); if (!r.ok) throw new Error(String(r.status)); } catch { style = FALLBACK; }
    try {
      map = new MLMap({ container: $('[data-opp-canvas]'), style, bounds: BOUNDS, fitBoundsOptions: { padding: 24 }, attributionControl: false, cooperativeGestures: true, maxBounds: [[-104.5, 19.8], [-96.2, 26]] });
    } catch {
      state.textContent = 'Este navegador no pudo iniciar el mapa. La lista de municipios y el panel siguen disponibles.';
      return;
    }
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new AttributionControl({ compact: true, customAttribution: style === FALLBACK ? 'Mapa base no disponible' : undefined }));
    map.on('load', () => {
      state.hidden = true;
      map!.addSource('munis', { type: 'geojson', data: geo() });
      map!.addLayer({ id: 'munis-empty', type: 'circle', source: 'munis', filter: ['==', ['get', 'empty'], 1], paint: { 'circle-radius': 4.5, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#4a5450', 'circle-stroke-width': 1.5 } });
      map!.addLayer({ id: 'munis-fill', type: 'circle', source: 'munis', filter: ['==', ['get', 'empty'], 0], paint: {
        'circle-radius': ['get', 'r'], 'circle-color': COLOR[layer.cls], 'circle-opacity': ['case', ['==', ['get', 'sel'], 1], 0.95, 0.62],
        'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#1e2624', '#ffffff'], 'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 3, 1.5],
        'circle-radius-transition': { duration: 500 }, 'circle-color-transition': { duration: 400 },
      } });
      map!.addLayer({ id: 'munis-sel', type: 'circle', source: 'munis', filter: ['all', ['==', ['get', 'sel'], 1], ['==', ['get', 'empty'], 1]], paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#1e2624', 'circle-stroke-width': 3 } });
      for (const id of ['munis-fill', 'munis-empty']) {
        map!.on('click', id, (e) => { const f = e.features?.[0]; if (f) show(String(f.properties.id), false); });
        map!.on('mouseenter', id, () => { map!.getCanvas().style.cursor = 'pointer'; });
        map!.on('mouseleave', id, () => { map!.getCanvas().style.cursor = ''; });
      }
      box.dataset.oppReady = '1';
    });
    map.on('error', () => { /* tile errors never break the panel */ });
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); void mount(); } }, { rootMargin: '500px 0px' });
    io.observe(box);
  } else void mount();
}
