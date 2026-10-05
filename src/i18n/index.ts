import { es, type UiKey } from './ui/es';
import { en } from './ui/en';

export const locales = ['es', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

/** BCP 47 tags for <html lang> and Intl. */
export const langTag: Record<Locale, string> = { es: 'es-MX', en: 'en' };

/** English pages are built only once their content is complete. */
export const generatedLocales: Locale[] = ['es'];

const dict = { es, en } as const;

export function t(locale: Locale, key: UiKey, vars: Record<string, string> = {}): string {
  const s: string = dict[locale][key] ?? dict.es[key];
  return s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/** Picks a localized content field, falling back to Spanish. */
export function pick(field: { es: string; en?: string } | undefined, locale: Locale): string {
  if (!field) return '';
  return (locale === 'en' && field.en) || field.es;
}

export type { UiKey };
