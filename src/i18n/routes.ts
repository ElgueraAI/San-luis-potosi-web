import type { Locale } from './index';

/**
 * Every internal URL is built here. Never hand-write a path in a component:
 * the GitHub Pages base path and the ES/EN prefixes are applied only here.
 */
const paths = {
  home: { es: '/', en: '/en/' },
  region: { es: '/regiones/{region}/', en: '/en/regions/{region}/' },
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
