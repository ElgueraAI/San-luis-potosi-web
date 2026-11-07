# Misión 03 — Revisión independiente de integridad

Fecha de corte: 2026-11-07, America/Mexico_City. Rama: `feature/academic-multiagents`. Línea base inmutable: `00d2ca39aeecf7feba863838c509bb15a6b80dba`.

## Alcance y criterio

La revisión contrastó código de transformación, consumidores del portal, contrato versionado, productos locales y pruebas. Se reutilizó el diagnóstico de la Misión 02. No se repitió la investigación externa ni se modificaron archivos crudos, diseño, modelos o informes anteriores. Esta revisión constituye un anexo técnico; no acredita por sí misma el informe final paginado ni una campaña ejecutada.

La aceptación de una fila se limita al inventario estructural y a la identidad de clave del catálogo local. No acredita fronteras actuales, operación, precisión de acceso, derechos de publicación ni demanda. El expediente de datos conserva esas restricciones.

## Hallazgos y reproducción

| Prioridad | Hallazgo y reproducción sobre la versión previa | Corrección y retest |
|---|---|---|
| P0 | La igualdad `municipality_id === null` en el constructor adjudicaba a Villa de Pozos fichas sin municipio. Su snapshot incluía cuatro destinos, una arqueología y cuatro eventos; la ausencia de clave no respaldaba esa pertenencia. | `research/scripts/entities/integrity.mjs` exige claves válidas; el constructor aplica la guardia. La ficha sin clave conserva conteos desconocidos como `null` y relaciones vacías. Pruebas de unión y agregación cubren claves nulas, inválidas y estatales. |
| P0 | `src/data/portal.ts`, en `inMuni` y `muniView`, podía repetir la asociación de claves nulas durante la construcción de páginas, incluso después de corregir el generador. | Se comprobó que ambos caminos utilizan `sameMunicipality`; `muniById` excluye claves no válidas. El directorio mantiene la ruta de Pozos. La prueba del helper impide igualdad nula. |
| P1 | La selección de destinos de `muniView` resolvía su nombre municipal contra el catálogo, sin exigir una clave en la ficha de entidad. La coincidencia de nombre podía sustituir indebidamente una clave ausente en entradas futuras. | `municipalDestinations` une el ID del destino con la clave de su ficha de origen y aplica `sameMunicipality`; no utiliza el nombre para establecer pertenencia. Un fixture con nombres coincidentes y claves ausentes/inválidas no produce asociación. La comparación del inventario actual mantiene las asociaciones previas de las 58 claves válidas. |
| P1 | `src/lib/intel/features.ts` utilizaba un identificador por nombre cuando faltaba la clave. Además, `counts?.[campo] ?? 0` convertía conteos ausentes en ceros. | Se excluyen filas municipales sin clave o sin los ocho conteos enteros completos. Las pruebas distinguen ausencia, conteos parciales, negativos, fraccionarios y ceros explícitos. No se imputa pertenencia mediante nombres. |
| P1 | `src/lib/intel/scoring.ts:eventOf` rechazaba claves vacías pero admitía cadenas territoriales mal formadas cuando coincidían. | Se exige clave válida antes de asociar eventos; la prueba verifica bonificación nula para claves desconocidas o inválidas. |
| P1 | Un manifiesto persistido anterior a la última edición del código/contrato podía no reproducir sus propios hashes, aunque dos ejecuciones nuevas fueran idénticas. | Se añadió comparación byte a byte contra los productos persistidos, además de dos reconstrucciones independientes. La prueba identificó el desfase durante integración y exigió regenerar el paquete final. El estado del retest definitivo se registra en la tabla siguiente. |

## Pruebas y evidencia

[OBSERVADO] Las pruebas se ejecutaron localmente, sin descargas ni consultas a servicios. Los casos artificiales son fixtures de validación; no se incorporan al inventario observado.

| Comando / comprobación | Resultado verificado | Cobertura y límite |
|---|---|---|
| `npm run test:geo` | 42 pruebas aprobadas; cero fallos | Rutas, optimización, proveedores simulados, navegación y geolocalización; no prueba de servicio externo en vivo. |
| `npm run test:intel` | 78 pruebas aprobadas; cero fallos | Incluye seis nuevas regresiones municipales, datos reales del snapshot, recomendaciones y escenarios existentes; no se entrenaron modelos nuevos. |
| `npm run test:data` | 8 pruebas aprobadas; cero fallos; retest final sobre `run_id:983e13ce877ecd66f114` | Siete controles de reglas y una prueba integrada: contrato, PK/FK, duplicados, coordenadas, fechas, cuarentena, dos ejecuciones, archivos persistidos y conservación cruda. |
| `node scripts/academic/compare-mission03-features.mjs` | 58 claves comparables sin diferencias; 59 filas previas frente a 58 admitidas | Contrasta todos los campos de features contra el checkpoint, manteniendo idénticas fichas normalizadas. Salida: [comparación municipal](mision-03-regresion-municipal.json). |
| `git diff --check` | Sin errores en la revisión ejecutada | Control de whitespace en archivos con seguimiento; no sustituye pruebas semánticas. |

[DERIVADO] La comparación de indicadores ordenados por clave produce el mismo SHA-256 antes y después: `77ef56e72165004242d26eb4187b1c4b4d066ef1cd285c6fd929c534e314ca76`. La única fila analítica excluida es el marcador sin clave de Villa de Pozos. Sus índices anteriores no se consideran evidencia territorial válida. Las claves históricas restantes conservan sus indicadores del portal; el universo elegible nuevo se entrega en un archivo distinto.

La coordinación registra por separado `npm run check` y la construcción con base path en el expediente consolidado y en [el log de build](mision-03-build.log). No se declara auditoría visual exhaustiva, verificación integral de accesibilidad ni evaluación de condiciones reales de los servicios. Las modificaciones revisadas corresponden a datos y asociaciones, sin rediseño premium.

## Conservación, universos y riesgos residuales

[DERIVADO] El paquete local contiene 4,961 filas de entrada: 4,805 aceptadas estructuralmente y 156 en cuarentena, con motivos que pueden solaparse. Se conservan 112 variantes de registro de fuente correspondientes a 110 identificadores. Los 132 registros con clave declarada `24059` permanecen en cuarentena hasta contar con catálogo contemporáneo autenticado. Las 103 agrupaciones de nombres coincidentes son candidatos de revisión; no se fusionaron sucursales ni registros homónimos.

`municipal-aggregates.json` sirve para regresión de los conteos declarados, incluida la cuarentena. `eligible-municipal-aggregates.json` utiliza sólo filas aceptadas, excluye las 58 filas de dimensión municipal del denominador de inventario y explica los cambios en seis claves. Mezclar estos dos universos introduciría un error metodológico. Las siete relaciones hacia fichas retenidas en cuarentena se conservan como referencias declaradas y se separan de las referencias elegibles.

[OBSERVADO] La conservación se verifica mediante hashes y tamaños de 1,160 archivos crudos, que suman 701,965,348 bytes. No se interpreta ese tamaño como evidencia de procesamiento distribuido. La prueba integrada compara el manifiesto crudo anterior y posterior y exige la reproducción exacta de las salidas locales.

Persisten las siguientes condiciones de uso:

- **P1, geografía:** los intervalos legales y la armonización entre límites históricos y contemporáneos permanecen [SIN_DATOS]; no se habilitan comparaciones temporales territoriales.
- **P1, publicación:** la revisión de derechos por recurso y afirmación sigue pendiente; ninguna fila recibe autorización pública por superar la validación estructural.
- **P1, evidencia de campaña:** no existen observaciones válidas de demanda, visitas, conversión, ROI ni capacidad ecológica dentro de este paquete.
- **P2, precisión:** la ventana estatal valida plausibilidad numérica, no pertenencia municipal por polígono ni acceso al sitio.
- **P2, contrato:** el catálogo procesable enumera campos y reglas; las pruebas comprueban productos, campos requeridos y claves, sin afirmar certificación mediante un motor completo de JSON Schema.

## Dictamen

[OBSERVADO] El retest definitivo aprobó las ocho pruebas de datos después de regenerar el manifiesto con el contrato final de 10,956 bytes y SHA-256 `d55ab09196612b5ee51b5214cfb6a23d4e3459d3514f6650d8946e571799c903`. Las dos reconstrucciones temporales y las salidas persistidas coincidieron byte a byte. Tras el ajuste final del adaptador de destinos se repitió únicamente la suite afectada de inteligencia: 78 pruebas aprobadas. Se aprobaron 128 pruebas pertinentes en total: 8 de datos, 78 de inteligencia y 42 geográficas; el ETL y su contrato permanecieron sin cambios durante ese último ajuste.

El alcance técnico revisado queda listo para revisión humana de checkpoint, con las restricciones documentadas de publicación y comparabilidad territorial. No se autoriza publicación ni se crea checkpoint. La preparación para la Misión 04 debe emplear el inventario elegible, su manifiesto y las exclusiones, y mantener separada la futura medición consentida.
