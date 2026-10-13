# Arquitectura del sistema de turismo inteligente

Rama `feature/smart-tourism-engine` (checkpoints F a K, octubre de 2026). Continúa `smart-tourism-next-phase.md`
(rutas, geolocalización y navegación en vivo, checkpoints C a E), que sigue vigente.

## Narrativa académica

**Problema.** Existe concentración turística en destinos emblemáticos y una gran cantidad de activos turísticos
distribuidos territorialmente que pueden ser menos visibles para el visitante.

**Pregunta central.** ¿Cómo pueden los datos, la geolocalización, la recomendación explicable y la optimización de
rutas ayudar a distribuir de forma más inteligente el turismo dentro de San Luis Potosí sin reducir la relevancia de
la experiencia del visitante?

**Solución.** Un sistema de Smart Tourism que combina datos turísticos, contexto, geolocalización, routing,
optimización, recomendación, diversificación, segmentación y marketing.

Relación con las áreas del programa: **ciencia de datos** (normalización, calidad, procedencia, indicadores),
**investigación de operaciones** (camino hamiltoniano abierto: Held–Karp, 2-opt, Or-opt), **aprendizaje automático**
(segmentación por reglas hoy; esquema y ruta para agrupamiento cuando existan datos observados) y **mercadotecnia
digital** (segmentos, matriz de campañas, esquema de eventos).

## Cadena

```
DATOS            research/entities · research/generated · research/source-registry      (fuente de verdad, sin cambios)
   ↓
NORMALIZACIÓN    src/lib/intel/normalize.ts · taxonomy.ts · dataset.ts
   ↓
VARIABLES        src/lib/intel/features.ts          (índices por municipio)   · quality.ts (controles)
   ↓
RECOMENDACIÓN    src/lib/intel/scoring.ts           (puntaje explicable 0–100)
   ↓
CONTEXTO         src/lib/intel/context.ts           (mes, clima, eventos, origen, ruta)
   ↓
REDISTRIBUCIÓN   src/lib/intel/diversify.ts         (oportunidad de diversificación)
   ↓
OPTIMIZACIÓN     src/lib/intel/route-aware.ts · trip.ts · src/scripts/geo/route-optimizer.ts (ya existente)
   ↓
INTERFAZ         /descubre/ · /mi-ruta/             src/scripts/intel/*.ts · src/styles/intel.css
   ↓
ANALÍTICA        src/lib/intel/analytics.ts · segments.ts · marketing.ts · scenario.ts
                 /inteligencia-turistica/ · /inteligencia-turistica/segmentos/
```

## Decisiones

| Decisión | Motivo |
|---|---|
| Toda la lógica en `src/lib/intel`, TypeScript puro (sin DOM, sin Astro, sin red) | El mismo código corre en la compilación, en el navegador y en las pruebas de Node; las cifras de los documentos son las del sitio |
| Se reutiliza lo existente: `route-session`, `route-optimizer`, `route-geometry`, `route-cache`, `location-service`, `weather.ts`, `route-store` | No duplicar sistemas ya probados; la política de cuotas del proveedor no cambia |
| Reglas y pesos documentados en lugar de un modelo entrenado | No hay datos observados de visitantes; un modelo opaco no sería defendible |
| Un factor sin datos sale del promedio | Faltar información no debe bajar un lugar ni inventar un valor |
| Relevancia antes que diversificación; los bonos solo suman | No sabotear la experiencia ni penalizar la popularidad |
| Indicadores con nombres honestos (exposición estimada, potencial de diversificación, cobertura) | No existe fuente de afluencia, ocupación ni saturación |
| `/data/intel.json` se carga solo en las páginas que ejecutan los motores | El resto del portal no paga ese peso |
| Sin dependencias nuevas | Gráficas y tablas en HTML y CSS; pruebas con `node:test` y esbuild (ya presentes) |
| Sin servidor | GitHub Pages es estático; el perfil y el registro de eventos viven en el navegador |

## Módulos

| Módulo | Responsabilidad | Pruebas |
|---|---|---|
| `lib/intel/types.ts` | Modelos: `IntelPlace`, `MuniFeatures`, `IntelEvent`, `TouristProfile`, `IntelDataset` | — |
| `lib/intel/taxonomy.ts` | Doce intereses, mapeo de etiquetas, duraciones, alcance | `data.test.ts` |
| `lib/intel/normalize.ts` | Entidad → lugar; confianza; temporada oficial; procedencia | `data.test.ts` |
| `lib/intel/features.ts` | Infraestructura, exposición (proxy), potencial, cobertura, concentración | `data.test.ts` |
| `lib/intel/quality.ts` | 14 controles de calidad y cobertura | `data.test.ts` |
| `lib/intel/scoring.ts` | Factores, pesos, bonos, ranking | `scoring.test.ts` |
| `lib/intel/context.ts` | Contexto del viaje, etiquetas, nota de clima | `scoring.test.ts` |
| `lib/intel/route-aware.ts` | Corredor de la ruta, desvío estimado y medido, inserción | `route.test.ts` |
| `lib/intel/diversify.ts` | Filtros y Diversification Opportunity Score | `diversify.test.ts` |
| `lib/intel/trip.ts` | Ahorro de la ruta optimizada | `diversify.test.ts` |
| `lib/intel/segments.ts` | Segmentos, afinidad, fila de variables | `segments.test.ts` |
| `lib/intel/marketing.ts` | Evidencia por segmento y matriz de campañas | `segments.test.ts` |
| `lib/intel/analytics.ts` | Esquema de eventos y saneamiento | `scoring.test.ts` |
| `lib/intel/scenario.ts` | Escenario simulado del tablero | `segments.test.ts` |
| `data/intel.ts` | Adaptador del sitio: texto publicado, URL, miniaturas, ids de Mi Ruta | compilación |
| `scripts/intel/*` | `discover`, `route-recos`, `cards`, `alternatives`, `segment-ui`, `profile-store`, `analytics`, `data` | `scripts/verify/intel.mjs` |

## Superficies

| Página | Qué añade |
|---|---|
| `/descubre/` | Perfil ligero, origen (ubicación con permiso o municipio), recomendaciones explicadas, alternativas, privacidad |
| `/mi-ruta/` | «Cerca de tu recorrido», «Medir desvíos por carretera», «Alternativas para descubrir», «Optimizar mi viaje» con ruta original y optimizada |
| `/inteligencia-turistica/` | Problema, pregunta y solución; tablero (observado, derivado, simulado); arquitectura; límites |
| `/inteligencia-turistica/segmentos/` | Segmento de la sesión, los ocho segmentos, matriz de campañas, ruta hacia modelos, eventos |
| Inicio, encabezado, menú, búsqueda | Entradas a «Descubre» y a «Inteligencia turística» |

## Uso de servicios externos

| Servicio | Uso | Cambio en esta etapa |
|---|---|---|
| OSRM (FOSSGIS) / openrouteservice | Ruta y matriz por carretera | Ninguno en la política. Las sugerencias del corredor no hacen solicitudes; «Medir desvíos» es una matriz a petición, en caché, sin reintento automático |
| Open-Meteo | Clima actual de seis puntos | Una solicitud por página con recomendador, caché de 15 min compartida |
| OpenFreeMap | Teselas del mapa | Ninguno |

Ningún servicio nuevo, ninguna clave nueva, ningún secreto en el cliente.

## Comandos

```bash
npm run test            # pruebas de rutas (tests/geo) e inteligencia (tests/intel)
npm run intel:report    # regenera docs/tourism-data-quality.md
node scripts/intel/preview.mjs [ids]                       # rankings y alternativas sobre los datos reales
npm run build && npx astro preview --port 4321             # y en otra terminal:
node scripts/verify/intel.mjs --url http://127.0.0.1:4321  # comprobaciones de navegador (proveedores simulados)
```

## Documentos

`tourism-data-dictionary.md` · `tourism-data-provenance.md` · `tourism-data-quality.md` (generado) ·
`recommendation-engine.md` · `tourism-redistribution-methodology.md` · `smart-marketing-methodology.md` ·
`analytics-event-schema.md` · `tourism-intelligence-limitations.md`.

## Mejoras futuras

1. Recolección con consentimiento y primer agrupamiento (`smart-marketing-methodology.md` § Ruta hacia modelos).
2. Calibrar pesos con datos observados («añadido / visto»).
3. Verificar los puntos aproximados y añadir puntos a los destinos que no tienen.
4. Instrumentar `destination_view`, `event_viewed`, `region_selected` y `route_generated`.
5. Precalcular matrices entre cabeceras para estimar desvíos sin consultar al proveedor.
6. Sitios web municipales, horarios de museos y una fuente oficial vigente de estadística turística.
7. Versión en inglés de las páginas nuevas.
