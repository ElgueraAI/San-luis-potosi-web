/**
 * MapLibre layers for location and routing, shared by every map mode.
 *  - visitor: DOM dot (unmistakable shape + label) + accuracy circle in metres
 *  - route: casing + ink line for the chosen route, dashed thin lines for alternatives
 *  - waypoints: start (ring + «Inicio»), numbered stops (circles), end (square + «Fin»)
 * Shape and text carry the meaning, colour only reinforces it.
 * Callers draw only after the map's 'style.load' (map.ts tracks it); sources
 * can be added then even while tiles are still streaming.
 */
import { Marker, LngLatBounds, type Map as MLMap, type GeoJSONSource } from 'maplibre-gl';
import type { Coordinate, GeoFix, RouteResult, RouteWaypoint } from './types';
import { COLORS } from './places';

const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const INK = '#1f2524';
export const USER_BLUE = '#1d5fd1';

/** Geodesic-ish circle polygon (good to a few metres at these radii). */
export function circlePolygon(center: Coordinate, radiusM: number, steps = 64) {
  const [lon, lat] = center;
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: Coordinate[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [ring] } };
}

function firstPlacesLayer(map: MLMap): string | undefined {
  return ['extras-clusters', 'places-prov'].find((id) => map.getLayer(id));
}

// ------------------------------------------------------------------ visitor --
export class UserLayer {
  private marker: Marker | null = null;
  constructor(private map: MLMap) {}

  private ensure() {
    if (this.map.getSource('user-acc')) return;
    this.map.addSource('user-acc', { type: 'geojson', data: EMPTY });
    const before = firstPlacesLayer(this.map);
    this.map.addLayer({ id: 'user-acc-fill', type: 'fill', source: 'user-acc', paint: { 'fill-color': USER_BLUE, 'fill-opacity': 0.12 } }, before);
    this.map.addLayer({ id: 'user-acc-line', type: 'line', source: 'user-acc', paint: { 'line-color': USER_BLUE, 'line-width': 1.2, 'line-opacity': 0.55 } }, before);
  }

  update(fix: GeoFix | null, stale = false) {
    this.ensure();
    (this.map.getSource('user-acc') as GeoJSONSource).setData(fix ? { type: 'FeatureCollection', features: [circlePolygon(fix.coord, fix.accuracy)] } : EMPTY);
    if (!fix) { this.marker?.remove(); this.marker = null; return; }
    if (!this.marker) {
      const el = document.createElement('div');
      el.className = 'geo-me';
      el.setAttribute('role', 'img');
      el.innerHTML = '<span class="geo-me__dot"></span><span class="geo-me__tag">Tú</span>';
      this.marker = new Marker({ element: el, anchor: 'center' }).setLngLat(fix.coord).addTo(this.map);
    }
    this.marker.setLngLat(fix.coord);
    const el = this.marker.getElement();
    el.toggleAttribute('data-stale', stale);
    el.setAttribute('aria-label', stale ? 'Tu última ubicación conocida (antigua)' : 'Tu ubicación');
  }

  remove() { this.marker?.remove(); this.marker = null; }
}

// -------------------------------------------------------------------- route --
export class RouteLayer {
  private markers: Marker[] = [];
  constructor(private map: MLMap) {}

  private ensure() {
    if (this.map.getSource('route-main')) return;
    this.map.addSource('route-main', { type: 'geojson', data: EMPTY });
    this.map.addSource('route-alts', { type: 'geojson', data: EMPTY });
    const before = firstPlacesLayer(this.map);
    this.map.addLayer({ id: 'route-alts', type: 'line', source: 'route-alts', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#6d675d', 'line-width': 3, 'line-opacity': 0.75, 'line-dasharray': [1.2, 1.4] } }, before);
    this.map.addLayer({ id: 'route-casing', type: 'line', source: 'route-main', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fbf8f2', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 9] } }, before);
    this.map.addLayer({ id: 'route-line', type: 'line', source: 'route-main', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': INK, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.6, 12, 5] } }, before);
  }

  /** Draw the chosen route (altIndex 0 = main, n = alternatives[n-1]); null clears the line but keeps stops. */
  setRoute(result: RouteResult | null, altIndex = 0) {
    this.ensure();
    const all = result ? [result.geometry, ...result.alternatives.map((a) => a.geometry)] : [];
    const main = all[altIndex] ?? all[0];
    (this.map.getSource('route-main') as GeoJSONSource).setData(main ? { type: 'Feature', properties: {}, geometry: main } : EMPTY);
    (this.map.getSource('route-alts') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: all.filter((g) => g !== main).map((g) => ({ type: 'Feature' as const, properties: {}, geometry: g })),
    });
  }

  /** Start / numbered stops / end. `regions` maps place id → region for the stop colour. */
  setWaypoints(wps: RouteWaypoint[], regions: Record<string, string>) {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    let n = 0;
    wps.forEach((w, i) => {
      const last = i === wps.length - 1 && wps.length > 1;
      const isOrigin = i === 0;
      const isGeneric = w.id.startsWith('origin:');
      const el = document.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      if (isOrigin && isGeneric) {
        el.className = 'wp wp--start';
        el.innerHTML = '<span class="wp__mark"></span><span class="wp__tag">Inicio</span>';
      } else {
        n += 1;
        const color = COLORS[regions[w.id]] ?? INK;
        el.className = `wp ${last ? 'wp--end' : isOrigin ? 'wp--start wp--num' : 'wp--stop'}${w.approximate ? ' is-approx' : ''}`;
        el.style.setProperty('--c', color);
        el.innerHTML = `<span class="wp__mark">${n}</span>${last ? '<span class="wp__tag">Fin</span>' : isOrigin ? '<span class="wp__tag">Inicio</span>' : ''}`;
      }
      this.markers.push(new Marker({ element: el, anchor: 'center' }).setLngLat(w.coord).addTo(this.map));
    });
  }

  fit(result: RouteResult | null, wps: RouteWaypoint[], reduced: boolean) {
    const b = new LngLatBounds();
    (result?.geometry.coordinates ?? []).forEach((c) => b.extend(c));
    wps.forEach((w) => b.extend(w.coord));
    if (b.isEmpty()) return;
    const narrow = this.map.getContainer().clientWidth < 520;
    this.map.fitBounds(b, { padding: narrow ? 40 : 64, maxZoom: 13, duration: reduced ? 0 : 700 });
  }

  clear() { this.setRoute(null); this.markers.forEach((m) => m.remove()); this.markers = []; }
}
