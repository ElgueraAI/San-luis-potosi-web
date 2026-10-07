import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

// GitHub Pages serves a project site from /<repo>/. Local development runs at
// the root. The deploy workflow sets BASE_PATH and SITE_URL; nothing else in
// the code may assume either value, every internal link goes through
// src/i18n/routes.ts, which reads import.meta.env.BASE_URL.
const base = process.env.BASE_PATH ?? '/';
const site = process.env.SITE_URL ?? 'http://localhost:4321';

/**
 * openrouteservice key for local development only (docs/map-api-decision.md).
 * ORS_API_KEY (no PUBLIC_ prefix) is read here, in Node, and added to requests
 * proxied from /api/ors to https://api.heigit.org/openrouteservice. The
 * browser and the build output never see it; the client only receives the
 * boolean __ORS_DEV_PROXY__. Production uses PUBLIC_ROUTE_PROXY_URL
 * (serverless/route-proxy) because GitHub Pages cannot run server code.
 */
function orsDevProxy() {
  return {
    name: 'slp-ors-dev-proxy',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        const env = loadEnv(command === 'dev' ? 'development' : 'production', process.cwd(), '');
        const key = (env.ORS_API_KEY ?? '').trim();
        const dev = command === 'dev' && key !== '';
        updateConfig({
          vite: {
            define: { __ORS_DEV_PROXY__: JSON.stringify(dev) },
            server: dev
              ? {
                  proxy: {
                    '/api/ors': {
                      target: 'https://api.heigit.org',
                      changeOrigin: true,
                      rewrite: (p) => p.replace(/^\/api\/ors/, '/openrouteservice'),
                      headers: { Authorization: key },
                    },
                  },
                }
              : {},
          },
        });
      },
    },
  };
}

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
  integrations: [orsDevProxy()],
});
