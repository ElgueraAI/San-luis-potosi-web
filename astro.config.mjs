// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages serves a project site from /<repo>/. Local development runs at
// the root. The deploy workflow sets BASE_PATH and SITE_URL; nothing else in
// the code may assume either value, every internal link goes through
// src/i18n/routes.ts, which reads import.meta.env.BASE_URL.
const base = process.env.BASE_PATH ?? '/';
const site = process.env.SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: false },
  },
  devToolbar: { enabled: false },
});
