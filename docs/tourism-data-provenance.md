# Procedencia de los datos turísticos

Cómo se rastrea cada registro de la capa de inteligencia hasta su fuente. Complementa `data-sources.md` (jerarquía e
historial de las pasadas de investigación) y `tourism-data-dictionary.md` (campos).

## Mecanismo

1. **Cada registro de `research/entities` lleva `source_ids`**, que apuntan al registro de fuentes
   (`research/source-registry/sources.json`, `sources-pass5.json`, `sources-pass6.json` y las fuentes de
   `research/generated/seasonal-additions-pass4.json`). Cada fuente registra institución, dominio, título, URL, tipo,
   fecha de consulta, accesibilidad y estado de verificación.
2. **`IntelPlace.source_ids` conserva esos ids** sin modificarlos; `provenance()` (`src/lib/intel/normalize.ts`) los
   resuelve a un objeto uniforme:

   | Campo | Contenido |
   |---|---|
   | `source_id` | id en el registro de fuentes |
   | `source_name` | institución (o título) |
   | `source_url` | URL consultada |
   | `source_type` | `official`, `open-data`, `community` o `unknown` |
   | `retrieved_at` | fecha de consulta |
   | `licence` | licencia o atribución cuando aplica (SIC, INEGI, Open-Meteo, OSM) |

3. **Cada valor declara su confianza** (`coord_confidence`, `source_confidence`, `date_confidence`, `evidence`), de modo
   que la interfaz no presenta con la misma certeza un punto oficial y uno aproximado.
4. **Los indicadores derivados no heredan la autoridad de sus insumos**: se etiquetan como derivados y documentan
   variables, fórmula, rango y límites (`tourism-redistribution-methodology.md`, `recommendation-engine.md`).

## Varias fuentes para una misma entidad

- Se conservan todos los ids (`source_ids` es una lista).
- La fuente oficial tiene prioridad sobre las de descubrimiento (OSM, Commons): un punto de OSM es `approximate` aunque
  exista, y nunca sustituye a un punto oficial.
- Las discrepancias entre fuentes oficiales **no se resuelven en silencio**: se documentan en el registro de
  investigación (`conflicts`) y el sitio usa una redacción neutral (`DISPUTED` en `src/data/research.ts`). El recomendador
  toma el texto publicado, nunca el valor crudo.
- Las discrepancias que detectan los controles de calidad (por ejemplo, filas del DENUE con la clave municipal 24059,
  que el catálogo del Censo 2020 no contiene) se reportan en `tourism-data-quality.md` y quedan como están.

## Fuentes que respaldan los registros

Conteo de registros de `research/entities` que citan cada fuente (un registro puede citar varias). Todas figuran en el
registro de fuentes con estado `official`.

| Fuente | Institución | Registros | Conjuntos | Consulta |
|---|---|---|---|---|
| DENUE, archivo estatal | INEGI | 4,373 | Hospedaje, gastronomía, servicios, recreación, movilidad | 2026-10-06 |
| SIC, datos abiertos del estado 24 | Secretaría de Cultura | 273 | Museos, recintos, declaratorias, áreas protegidas, festivales | 2026-10-06 |
| Infografías municipales 2022 | CEFIM, Gobierno del Estado | 72 | Fiestas patronales y ferias | 2026-10-06 |
| Estadía (directorio oficial) | Secretaría de Turismo de SLP | 61 | Hospedaje, gastronomía | 2026-10-06 |
| ITER, Censo 2020 | INEGI | 59 | Municipios: cabecera, población, altitud | 2026-10-06 |
| PDU-SLP | Gobierno del Estado | 58 | Región y microrregión de cada municipio | 2026-10-05 |
| Páginas de lugares (`/lugares/…`) | Secretaría de Turismo de SLP | 33 | Destinos, eventos | 2026-10-04 |
| Programa de Día de Muertos / Xantolo | Secretaría de Turismo de SLP | 29 | Eventos | 2026-10-06 |
| Folletos regionales (4) | Secretaría de Turismo de SLP | 39 | Destinos, temporadas, eventos, gastronomía | 2026-10-04 |
| Agenda y boletines 2026 | Gobierno del Estado, Secretaría de Cultura, INPODE, Matehuala | 15 | Eventos con fecha confirmada | 2026-10-05/06 |
| Zonas arqueológicas (datos abiertos) y Lugares INAH | INAH | 5 | Arqueología | 2026-10-04/06 |
| Artículos de Pueblos Mágicos | SECTUR | 2 | Real de Catorce, Xilitla | 2026-10-04 |
| Revista *Arqueología* | INAH | 1 | Sitio documentado de Tanute | 2026-10-06 |

Fuentes de contexto que no respaldan registros individuales:

| Fuente | Uso | Licencia / condición |
|---|---|---|
| Open-Meteo Historical Weather API | Clima mensual modelado 2016–2025 por región (`climate-monthly.json`) | CC BY 4.0 · atribución «Open-Meteo.com» |
| Open-Meteo Forecast API | Clima actual en el cliente, caché de 15 min | CC BY 4.0 · uso no comercial, sin clave |
| OpenStreetMap | Puntos aproximados de 21 destinos; red vial del servicio de rutas | ODbL · «© OpenStreetMap contributors» |
| OSRM (FOSSGIS) / openrouteservice | Rutas y matrices por carretera | Ver `map-api-decision.md` |
| DataTur 2022 (SECTUR) | 12,630 cuartos de hotel en el estado | Contexto histórico 2022; nunca como estado actual |
| Libro de Excel de planeación | Prioridad editorial A/B/C de los 63 destinos | Dato de planeación del proyecto, no fuente oficial |

## El libro de Excel no es una fuente oficial

`research/generated/workbook-places.json` es la exportación de solo lectura del libro maestro
(`Biblioteca_Visual_San_Luis_Potosi_Web.xlsx`, fuera del repositorio). Sus valores son planeación: cada hecho se
verificó contra una fuente oficial antes de publicarse. De él, la capa de inteligencia usa **un solo campo**, la
prioridad editorial (`A`, `B`, `C`), y lo usa como lo que es: una señal de exposición editorial dentro del proxy de
exposición, no una medida de popularidad.

## Fuentes nuevas en esta etapa

Ninguna. La auditoría mostró que los conjuntos existentes cubren lo que los motores necesitan (atractivos, eventos,
temporadas, infraestructura, clima, municipios). Los vacíos que sí requieren una fuente nueva (afluencia, ocupación,
horarios de museos, sitios web municipales) no tienen hoy una fuente abierta, oficial y vigente; se listan en
`tourism-intelligence-limitations.md` y `research-gaps.md` en lugar de cubrirse con estimaciones.
