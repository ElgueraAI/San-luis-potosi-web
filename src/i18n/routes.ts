import type { Locale } from './index';

/**
 * Every internal URL is built here. Never hand-write a path in a component:
 * the GitHub Pages base path and the ES/EN prefixes are applied only here.
 * Only Spanish pages are generated in this MVP; the EN column reserves URLs.
 */
const paths = {
  home: { es: '/', en: '/en/' },
  region: { es: '/regiones/{region}/', en: '/en/regions/{region}/' },
  destination: { es: '/destinos/{slug}/', en: '/en/destinations/{slug}/' },
  routes: { es: '/rutas/', en: '/en/routes/' },
  map: { es: '/mapa/', en: '/en/map/' },
  seasons: { es: '/temporadas/', en: '/en/seasons/' },
  guides: { es: '/guias/', en: '/en/guides/' },
  plan: { es: '/planea/', en: '/en/plan/' },
  myRoute: { es: '/mi-ruta/', en: '/en/my-route/' },
  credits: { es: '/creditos/', en: '/en/credits/' },
  municipalities: { es: '/municipios/', en: '/en/municipalities/' },
  municipality: { es: '/municipios/{slug}/', en: '/en/municipalities/{slug}/' },
  thingsToDo: { es: '/que-hacer/', en: '/en/things-to-do/' },
  thingsToDoCat: { es: '/que-hacer/{cat}/', en: '/en/things-to-do/{cat}/' },
  experiences: { es: '/experiencias/', en: '/en/experiences/' },
  experience: { es: '/experiencias/{slug}/', en: '/en/experiences/{slug}/' },
  events: { es: '/eventos/', en: '/en/events/' },
  event: { es: '/eventos/{slug}/', en: '/en/events/{slug}/' },
  archaeology: { es: '/arqueologia/', en: '/en/archaeology/' },
  archaeologySite: { es: '/arqueologia/{slug}/', en: '/en/archaeology/{slug}/' },
  museums: { es: '/museos/', en: '/en/museums/' },
  lodging: { es: '/hospedaje/', en: '/en/lodging/' },
  food: { es: '/gastronomia/', en: '/en/food/' },
  search: { es: '/buscar/', en: '/en/search/' },
  about: { es: '/acerca/', en: '/en/about/' },
  destinations: { es: '/destinos/', en: '/en/destinations/' },
  directoryData: { es: '/data/{name}.json', en: '/data/{name}.json' },
  placesData: { es: '/data/places.json', en: '/data/places.json' },
  routeContextData: { es: '/data/route-context.json', en: '/data/route-context.json' },
} as const;

export type RouteKey = keyof typeof paths;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function href(key: RouteKey, params: Record<string, string> = {}, locale: Locale = 'es', hash?: string): string {
  const p = paths[key][locale].replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(params[k] ?? ''));
  return `${BASE}${p}${hash ? `#${hash}` : ''}`;
}

/** A same-page anchor on the home page. */
export function homeAnchor(id: string, locale: Locale = 'es'): string {
  return href('home', {}, locale, id);
}

/** Static asset in public/, base-aware. */
export function asset(path: string): string {
  return `${BASE}/${path.replace(/^\//, '')}`;
}

export const destHref = (slug: string) => href('destination', { slug });
export const regionHref = (region: string) => href('region', { region });
export const muniHref = (slug: string) => href('municipality', { slug });
export const eventHref = (slug: string) => href('event', { slug });
export const experienceHref = (slug: string) => href('experience', { slug });
export const tdHref = (cat: string, sub?: string) => href('thingsToDoCat', { cat }, 'es', sub);
export const archHref = (slug: string) => href('archaeologySite', { slug });
