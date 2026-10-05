import type { UiKey } from '@/i18n';

/**
 * Primary navigation. `ready` flips to true as each home section ships, so the
 * header never links to a section that does not exist yet.
 */
export type NavItem = { key: UiKey; anchor: string; ready: boolean };

export const primaryNav: NavItem[] = [
  { key: 'nav.regions', anchor: 'descenso', ready: true },
  { key: 'nav.experiences', anchor: 'experiencias', ready: false },
  { key: 'nav.map', anchor: 'mapa', ready: false },
  { key: 'nav.now', anchor: 'ahora', ready: false },
  { key: 'nav.stories', anchor: 'historias', ready: false },
];

export const planNav: NavItem = { key: 'nav.plan', anchor: 'planea', ready: false };
