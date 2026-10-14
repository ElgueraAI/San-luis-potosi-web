# signals-proxy

Cloudflare Worker que guardaría las claves de los proveedores de señales turísticas (BestTime, TomTom Traffic,
Flightradar24) y del modelo de lenguaje del planificador. **No está desplegado.** El sitio funciona completo sin él:
cada módulo usa respuestas de ejemplo etiquetadas como simuladas.

Contexto: `docs/external-api-evaluation.md` (qué ofrece cada proveedor y qué está confirmado) y
`docs/api-quota-budget.md` (topes, caché, 429 y riesgo de concurrencia).

## Por qué existe

El portal se publica en GitHub Pages, que solo sirve archivos estáticos. Cualquier clave escrita en el código del
navegador es pública. El Worker recibe la petición del navegador, añade la clave guardada como secreto y la reenvía
al proveedor:

```
navegador ── GET /v1/tomtom/flow?corridor=acceso-xilitla ──▶ Worker ── (+ clave) ──▶ api.tomtom.com
          ◀────────────── { provider, retrievedAt, payload } ──────────────
```

El navegador solo envía un identificador del catálogo (`catalog.json`); nunca una dirección, una coordenada ni una
clave. El Worker nunca devuelve la clave ni el cuerpo de un error del proveedor, que podría contenerla.

## Qué comprueba, en orden

1. **Origen** en `ALLOWED_ORIGINS`. CORS no es una barrera de seguridad (un script puede falsificar `Origin`); por eso
   existen los pasos siguientes.
2. **Ruta permitida** y método (`GET`; `POST` solo para el planificador).
3. **Parámetros del catálogo**: museos del piloto, accesos y el aeropuerto. Cualquier otro valor responde 404.
4. **Interruptores**: `SIGNALS_ENABLED` por proveedor y `LLM_MODE`; apagados por omisión.
5. **Clave y almacenamiento de contadores presentes**; si falta cualquiera, responde sin llamar al proveedor.
6. **Caché** compartida en KV con plazo por endpoint.
7. **Enfriamiento**: tras un 429 del proveedor (su `Retry-After`) o un 5xx (60 s), nadie lo llama.
8. **Presupuesto** por visitante (huella diaria con hash, sin guardar la IP), por proveedor y día, y por proveedor y
   mes, antes de llamar.

Los errores llevan su código en el encabezado `X-Signal-Error` (expuesto por CORS junto con `Retry-After`) para que la
página distinga «desactivada», «en pausa» y «límite alcanzado».

## Endpoints

| Ruta | Parámetro | Proveedor | Caché |
|---|---|---|---|
| `GET /v1/status` | — | Ninguno: modos, topes y consumo, sin claves | — |
| `GET /v1/besttime/forecast` | `venue` (id del catálogo) | BestTime, previsión semanal (2 créditos) | 7 días |
| `GET /v1/besttime/live` | `venue` | BestTime, en vivo (1 crédito) | 15 min |
| `GET /v1/tomtom/flow` | `corridor` | TomTom, flujo del tramo más cercano | 5 min |
| `GET /v1/tomtom/incidents` | `corridor` | TomTom, incidentes en una caja de unos 41 × 40 km | 10 min |
| `GET /v1/fr24/movements` | `day` (`AAAA-MM-DD`) | Flightradar24, vuelos del aeropuerto MMSP; entorno de pruebas por omisión | 1 hora |
| `POST /v1/llm/plan` | cuerpo JSON validado | Modelo de lenguaje (fase 3) | — |

`POST /v1/llm/plan` rechaza cuerpos de más de 12 KB, más de 12 lugares, cualquier campo de coordenadas o de datos
personales, y aplica topes por sesión, por visitante y totales.

## Variables

Los **secretos** se guardan con `wrangler secret put`, nunca en un archivo del repositorio, en `.env` ni en una
variable `PUBLIC_`:

| Secreto | Proveedor |
|---|---|
| `TOMTOM_API_KEY` | TomTom |
| `BESTTIME_API_KEY_PRIVATE` | BestTime (la clave privada; la pública no se usa) |
| `FR24_API_TOKEN` | Flightradar24 (token del entorno de pruebas mientras `FR24_SANDBOX` no sea `false`) |
| `LLM_API_KEY` | Proveedor del modelo de lenguaje |

Variables no secretas:

| Variable | Por omisión | Uso |
|---|---|---|
| `ALLOWED_ORIGINS` | (vacía: todo se rechaza) | Orígenes permitidos, separados por comas, p. ej. `https://elgueraai.github.io` |
| `SIGNALS_ENABLED` | (vacía: todo apagado) | Proveedores que pueden llamarse, p. ej. `tomtom` |
| `FR24_SANDBOX` | `true` | `false` usaría datos reales con créditos (descartado) |
| `LLM_MODE` | `disabled` | `disabled`, `mock` o `live` |
| `LLM_PROVIDER`, `LLM_MODEL` | — | Proveedor y modelo del planificador (fase 3) |
| `LIMIT_<PROVEEDOR>_DAY`, `LIMIT_<PROVEEDOR>_MONTH` | ver `BUDGETS` en `worker.js` | Topes; `<PROVEEDOR>` = `BESTTIME`, `TOMTOM`, `FR24`, `LLM` |
| `LIMIT_CLIENT_DAY` | `40` | Solicitudes por visitante y día |

Enlace (binding) obligatorio para cualquier llamada real: un espacio de nombres de Workers KV llamado `BUDGET`
(contadores, caché y enfriamientos). Sin él, el Worker no llama a ningún proveedor.

Del lado del sitio (`.env.example`), solo direcciones y nombres de modo, que no son secretos:
`PUBLIC_SIGNALS_PROXY_URL`, `PUBLIC_SIGNALS_BESTTIME`, `PUBLIC_SIGNALS_TOMTOM`, `PUBLIC_SIGNALS_FR24` (`off`, `mock`
o `live`) y `PUBLIC_LLM_MODE`. `live` sin `PUBLIC_SIGNALS_PROXY_URL` se convierte en `off`.

## Desarrollo y pruebas, sin cuentas

Nada de esto contacta a un proveedor ni necesita claves.

```bash
npm run test:signals        # guardas, adaptadores y el Worker en Node, con KV y proveedor falsos (35 pruebas)

# página de señales en modo simulado (la configuración por defecto)
npm run build && npx astro preview --port 4321
node scripts/verify/signals.mjs --expect mock

# página de señales a través de este Worker, corriendo en 127.0.0.1:8787
PUBLIC_SIGNALS_BESTTIME=live PUBLIC_SIGNALS_TOMTOM=live PUBLIC_SIGNALS_FR24=live \
PUBLIC_SIGNALS_PROXY_URL=http://127.0.0.1:8787 npm run build && npx astro preview --port 4321
node scripts/verify/signals.mjs --expect live
npm run build               # volver a la compilación normal: la anterior apunta a 127.0.0.1
```

En modo `live`, `scripts/verify/signals.mjs` ejecuta este mismo `worker.js` con claves ficticias (`FAKE-…`), un KV en
memoria y un proveedor falso propio que responde con la forma documentada, y que también simula errores 500, 429,
presupuesto agotado y proveedor apagado. Que una tarjeta diga «En vivo» en esa prueba significa «llegó a través del
proxy», no «dato real». Esa compilación nunca debe publicarse.

`handle(request, env, { fetch, now })` es el Worker completo como función; las pruebas le inyectan `fetch` y el reloj.

## Despliegue futuro (no realizado)

Cada paso requiere tu autorización: crear cuentas, guardar claves y publicar un servicio.

1. Crear una cuenta de Cloudflare en el plan gratuito, sin medio de pago, e instalar Wrangler.
2. Crear el KV: `wrangler kv namespace create BUDGET` y añadir el enlace en un `wrangler.toml` junto a este archivo
   (`main = "worker.js"`, `[[kv_namespaces]] binding = "BUDGET"`).
3. Variables: `ALLOWED_ORIGINS="https://elgueraai.github.io"` y, de momento, `SIGNALS_ENABLED=""` y
   `LLM_MODE="disabled"`.
4. `wrangler deploy` y comprobar `GET /v1/status`: todo apagado, `budgetStore: true`.
5. Crear la cuenta del primer proveedor (TomTom), `wrangler secret put TOMTOM_API_KEY`, y solo entonces
   `SIGNALS_ENABLED="tomtom"`.
6. En el flujo de GitHub Pages, definir `PUBLIC_SIGNALS_PROXY_URL` con la URL del Worker y `PUBLIC_SIGNALS_TOMTOM=live`,
   y volver a publicar el sitio.
7. Revisar `/v1/status` al día siguiente y comparar con `docs/api-quota-budget.md`.

Para retirarlo: vaciar `SIGNALS_ENABLED` corta todas las llamadas sin tocar el sitio; borrar el secreto o el Worker
lo elimina por completo.

## Límites conocidos

- Los contadores en KV no son atómicos: un tope puede rebasarse por el número de solicitudes simultáneas
  (`docs/api-quota-budget.md` § Riesgo de concurrencia). Un tope exacto requiere Durable Objects.
- Los campos de BestTime en vivo y de Flightradar24 están escritos según la documentación y no se han comprobado con
  una respuesta real (`docs/external-api-evaluation.md`).
- El Worker comparte el patrón de `serverless/route-proxy` (openrouteservice), que sigue siendo independiente.
