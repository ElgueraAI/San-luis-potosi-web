# Diccionario de datos de la capa de inteligencia turística

Describe las entidades normalizadas que usan el recomendador, el motor de contexto, el motor de redistribución y el
tablero. Los tipos viven en `src/lib/intel/types.ts`; la normalización, en `src/lib/intel/normalize.ts`; el ensamblado,
en `src/lib/intel/dataset.ts`. Las cifras de cobertura están en `tourism-data-quality.md` (generado).

Regla general: **un campo que la fuente no da queda en `null`**. Ningún valor se rellena con un supuesto. Las
coordenadas siguen el orden GeoJSON `[longitud, latitud]`.

## Vocabulario de confianza

| Valor | Significado | Ejemplo |
|---|---|---|
| `verified` | Leído en una fuente oficial y contrastado | Punto de localidad de INEGI ITER 2020 |
| `official` | Publicado por una fuente oficial (registro, directorio, datos abiertos) | Punto georreferenciado del DENUE; ficha del SIC |
| `derived` | Calculado por este proyecto con reglas o fórmulas | Interés «Familia» de un museo de ciencia |
| `approximate` | Valor real de precisión limitada | Punto de OpenStreetMap; cabecera municipal usada para un evento |
| `unknown` | Sin valor | Destino sin punto aceptable |

**Nivel de evidencia** de un lugar (`alta`, `media`, `baja`): puntos = fuente (verificada 2, oficial 1) + punto
(verificado 2, oficial 1.5, aproximado 1) + descripción (1). Alta ≥ 4, media ≥ 2.5, baja por debajo. Una fila del DENUE
nunca pasa de `baja`: el registro no confirma que el lugar opere hoy.

## IntelPlace (destino, atractivo o recinto que puede recomendarse)

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| `id` | string | `research/entities` | Mismo id que el resto del portal (p. ej. `H01`, `sic-museo-1953`) |
| `name` | string | `canonical_name`; en destinos, el nombre publicado | |
| `kind` | enum | `entity_type` + `subcategory` | `destination`, `archaeology`, `museum`, `protected-area`, `religious-landmark`, `gallery`, `craft`, `recreation` |
| `label` | string | Tipo legible | «Pueblo Mágico», «Museo», «Área natural protegida» |
| `region` | enum \| null | PDU-SLP vía catálogo municipal | `altiplano`, `centro`, `zona-media`, `huasteca` |
| `municipality`, `municipality_id` | string \| null | Fuente del registro; clave INEGI | |
| `coord` | [lon, lat] \| null | Capa de investigación | Sin punto ⇒ fuera de todo cálculo geoespacial |
| `coord_confidence` | confianza | `coordinate_status` | Ver vocabulario |
| `interests` | lista | Etiquetas editoriales (`TAG_MAP`) + tipo oficial (`kindInterests`) | Doce intereses del perfil |
| `derived_interests` | lista | Subconjunto de `interests` inferido por regla | La interfaz los marca como derivados |
| `recommended_months` | número[] \| null | Solo declaraciones oficiales de temporada (folletos de la Secretaría de Turismo) | `null` = sin evidencia; **no penaliza** |
| `season_source` | string \| null | id de la fuente de la temporada | |
| `caution_months`, `caution_note` | número[] \| null, texto | Avisos de clima de una fuente oficial | No son recomendación; generan una advertencia |
| `outdoor` | boolean \| null | Regla sobre tipo e intereses | Solo decide si la lluvia es relevante |
| `pueblo_magico` | boolean | SECTUR / Secretaría de Turismo | |
| `priority` | `A`/`B`/`C` \| null | Libro de planeación (editorial) | Solo destinos; entra en el proxy de exposición |
| `description` | string \| null | Texto **publicado** (con las redacciones neutrales de `research.ts`) | |
| `url`, `image` | string \| null | Rutas internas del sitio; miniatura con licencia | |
| `official_url` | string \| null | URL oficial del registro | Solo `http(s)` válidas |
| `source_ids` | string[] | Registro de fuentes | Ver `tourism-data-provenance.md` |
| `source_confidence` | confianza | `verification_status` | |
| `evidence` | nivel | Derivado | Ver fórmula arriba |
| `route_id` | string \| null | id en `/data/places.json` | `null` = no puede añadirse a Mi Ruta |

Qué entra como candidato (`isCandidate`): destinos **con página publicada**, zonas arqueológicas, museos, áreas
naturales protegidas, catedrales, galerías, casas de artesanía y balnearios **públicos** del DENUE. Quedan fuera las
declaratorias de patrimonio (varias son inmateriales), auditorios, teatros, centros culturales y todo negocio.

## MuniFeatures (un registro por municipio)

| Campo | Tipo | Clase | Definición |
|---|---|---|---|
| `id`, `name`, `slug`, `region`, `coord` | — | Observado | Clave INEGI (o `name:<municipio>` si el Censo 2020 no lo lista), cabecera municipal |
| `population` | número \| null | Observado | Censo 2020 (INEGI ITER) |
| `counts.*` | números | Observado | Destinos, museos, recintos, arqueología, eventos, hospedaje, comida, áreas protegidas, destinos prioridad A, Pueblos Mágicos |
| `assets` | número | Observado | Destinos + museos + arqueología + áreas protegidas candidatos |
| `asset_share` | 0–1 | Derivado | `assets` ÷ total estatal |
| `infrastructure_index` | 0–1 | Derivado | `ln(1 + hospedaje + comida) ÷ ln(1 + máximo estatal)` |
| `exposure_proxy` | 0–1 | Derivado (proxy) | `0.5·ln(1+hospedaje)/ln(1+máx) + 0.3·mín(1, destinosA/3) + 0.2·[tiene Pueblo Mágico]` |
| `diversification_potential` | 0–1 | Derivado | `(1 − exposición) × (0.6·atractivo + 0.4·infraestructura)`; 0 si no hay atractivos ni eventos |
| `coverage_index` | 0–1 | Derivado | Fracción de seis tipos de registro presentes |

Las fórmulas, rangos, limitaciones e interpretación están en `tourism-redistribution-methodology.md`.

## IntelEvent

| Campo | Tipo | Notas |
|---|---|---|
| `id`, `name`, `municipality`, `municipality_id`, `region` | — | Conjunto único de eventos (`research/entities/events`) |
| `months` | número[] | Meses del patrón o de la fecha; vacío si no se publicó |
| `date_status` | string | Estado original (`CONFIRMED_CURRENT_YEAR`, `RECURRENT_OFFICIAL_PATTERN`, …) |
| `date_confidence` | `confirmed` \| `pattern` \| `past` \| `unknown` | Fecha del año en curso · recurrencia oficial · última edición conocida · sin fecha |
| `url` | string \| null | Página del evento en el portal |

Un evento `past` o `unknown` nunca se presenta como si tuviera fecha vigente.

## Clima de contexto (`climate`)

Por región, doce meses con `rain_days`, `tmax` y `tmin`: promedio modelado 2016–2025 (reanálisis de Open-Meteo,
CC BY 4.0). No es una normal climatológica oficial y solo se usa como contexto; nunca genera por sí solo una
recomendación ni una afirmación de seguridad.

## TouristProfile (perfil del visitante)

`interests` (0 a 12 de los intereses), `duration` (`half-day`, `day`, `two-days`, `weekend`, `long`), `mode` (`car`, `foot`,
`bike`: los perfiles del servicio de rutas) y `budget` (`economico`, `medio`, `flexible`). No contiene nombre, correo,
teléfono, edad, dirección ni ubicación. Se guarda solo en `localStorage` del navegador (`analytics-event-schema.md`).
