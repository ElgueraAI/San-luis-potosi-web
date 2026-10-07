/** Build-time flags and public env vars used by the routing layer (no secrets here). */

/** true only under `astro dev` when ORS_API_KEY is set in .env (see astro.config.mjs). */
declare const __ORS_DEV_PROXY__: boolean;

interface ImportMetaEnv {
  /** auto | ors | osrm-fossgis | none */
  readonly PUBLIC_ROUTING_PROVIDER?: string;
  /** Production proxy root that forwards to https://api.heigit.org/openrouteservice and adds the key. */
  readonly PUBLIC_ROUTE_PROXY_URL?: string;
}
