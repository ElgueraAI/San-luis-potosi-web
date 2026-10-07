/**
 * POI adapter: the portal's own /data/places.json (built from the research
 * layer: INEGI, INAH, SIC, Secretaría de Turismo, OSM where marked). One
 * request per page, shared by the map, Mi Ruta and the route session.
 * `status` is the project's distinction: 'ready' = verified official point,
 * 'provisional' = approximate, 'none' = no point (never routed, never invented).
 */
import type { Coordinate } from './types';

export type Place = {
  id: string; name: string; region: string; kind: string; municipality: string | null; description: string | null;
  url: string | null; coords: Coordinate | null; status: 'ready' | 'provisional' | 'none'; interests: string[];
  layer?: 'destination' | 'entity'; group?: 'seats' | 'culture' | 'nature' | 'lodging'; image: string | null; weather: { key: string; name: string; lat: number; lon: number };
};

export const COLORS: Record<string, string> = { altiplano: '#b66a32', centro: '#9e5f67', 'zona-media': '#3d8f8a', huasteca: '#176b57' };
export const REGION_NAME: Record<string, string> = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };

let promise: Promise<Place[]> | null = null;
export function loadPlaces(url: string): Promise<Place[]> {
  promise ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`places ${r.status}`);
    return r.json() as Promise<Place[]>;
  });
  promise.catch(() => { promise = null; }); // allow a retry after a failure
  return promise;
}

export const routable = (p: Place | undefined | null): p is Place & { coords: Coordinate } => !!p && !!p.coords && p.status !== 'none';
export const isSeat = (p: Place) => p.kind === 'Municipio (cabecera)';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
