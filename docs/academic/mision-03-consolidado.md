# Misión 03 — Integridad y preparación de información turística

Actualización de reproducibilidad: la representación canónica, la preservación byte a byte de baselines y la validación adicional del checkpoint se documentan en [el anexo de reproducibilidad](uca-01-almacenamiento/mision-03-reproducibilidad.md). Las cifras de ejecución y hashes de este consolidado anteriores a ese anexo se mantienen como trazabilidad histórica.

Fecha: 2026-11-07, America/Mexico_City. Rama de trabajo: `feature/academic-multiagents`. HEAD de referencia: `00d2ca39aeecf7feba863838c509bb15a6b80dba`.

## Resultado y alcance de aceptación

Se corrigieron las uniones municipales con claves nulas en el generador y los consumidores del portal. Se ejecutó una preparación local reproducible con inventario admitido, cuarentena, dimensión histórica, variantes de fuente, agregados elegibles, contrato versionado y manifiestos. El alcance técnico queda preparado para revisión humana de checkpoint; no se creó checkpoint ni se realizó commit, push, merge, despliegue o publicación.

La misión reutilizó la [Misión 02](mision-02-consolidado.md) y su [diagnóstico de datos](uca-01-almacenamiento/mision-02-datos.md). El [expediente UCA 01 actualizado](uca-01-almacenamiento/mision-03-datos.md) conserva métodos, fórmulas, decisiones, pruebas y limitaciones. El producto final del proyecto continúa siendo una campaña publicitaria inteligente y sustentable; esta misión entrega su capa de preparación, sin afirmar campaña ejecutada o resultados de audiencia.

La coordinación utilizó únicamente `data_engineer` y `qa_auditor`, con máximo dos subagentes concurrentes. Datos asumió helper de integridad, ETL, corrección municipal y derivados; QA asumió pruebas y comparación independiente; la coordinación integró consumidores, contrato, documentación y verificaciones Astro. Las modificaciones previas del árbol se conservaron. Los informes anteriores y los datos crudos no se sobrescribieron.

## Problemas encontrados y correcciones

| Problema [OBSERVADO] | Corrección ejecutada | Resultado comprobado |
|---|---|---|
| El builder unía `null === null` | Patrón de clave SLP válido, exclusión de `24000` e igualdad sólo entre claves válidas | Los desconocidos no se atribuyen a Pozos |
| `muniView` repetía uniones sin guardia | Guardia en colecciones/eventos y selección de destinos por ID y clave de su fila de origen | El nombre no sustituye una clave ausente |
| La capa de indicadores usaba `name:<municipio>` y valores por defecto | Exclusión de municipio sin clave y de conteos ausentes, nulos o inválidos | Se distingue desconocido de cero; permanecen 58 claves comparables |
| La ficha de Pozos contenía conteos y relaciones espurias | Corrección mínima con baseline conservado, conteos `null`, relaciones vacías y versión de transformación | Se retiraron A03, A15, H02 y H18 de la atribución municipal |
| Desfase catálogo histórico frente a `24059` | Dimensión con versión de snapshot, vigencia legal desconocida y cuarentena | No se inventó clave, región, población ni correspondencia temporal |
| Fuentes, nombres e IDs incompletos | Rechazo estructural por fila, motivos y linaje | Inventario aceptado separado de cuarentena |
| Variantes repetidas de fuente | PK por archivo/hash/fila; sin precedencia implícita | Las variantes siguen trazables |
| Agregados declarados podían mezclar registros retenidos | Producto elegible separado, con denominadores por clave | Las UCA posteriores reciben conteos filtrados y exclusiones |

No se alteraron componentes visuales, estilos ni diseño premium. El cambio en contenido y universo analítico responde al defecto de atribución documentado. Las rutas municipales permanecen disponibles, incluida la página del registro pendiente de Pozos.

## Conteos antes y después

[DERIVADO] Fuente: [reporte de validación](../../research/curated/mission03/validation-report.json), corte 2026-11-07; unidades de filas de inventario/catálogo. Las cifras no representan visitantes, ocupación ni capacidad ecológica.

| Indicador | Antes | Después |
|---|---:|---:|
| Filas de entrada auditadas, sin rutas | 4,961 | 4,961 |
| Aceptadas estructuralmente | No calculado en Misión 02 | 4,805 |
| Cuarentena, filas únicas | No calculado en Misión 02 | 156 |
| Inventario no municipal aceptado | No calculado | 4,747 |
| Filas de directorio municipal / páginas municipales | 59 | 59 |
| Indicadores municipales | 59 | 58 |
| Claves comparables con todos sus indicadores idénticos | 58 | 58 |
| Filas de fuente / IDs distintos | 112 / 110 | 112 / 110 |
| Grupos homónimos candidatos a revisión | 103 | 103 |
| Relaciones espurias de destinos hacia Pozos | 4 | 0 admitidas |
| Pozos: destinos / arqueología / eventos | 4 / 1 / 4 | `null` / `null` / `null` |

La conservación se verifica como `4,961 = 4,805 + 156`. Se conservaron 1,160 archivos crudos y 701,965,348 bytes, con coincidencia de hashes antes y después. Los motivos de cuarentena se superponen: 14 filas sin clave válida, 132 con `24059` sin correspondencia, nueve sin fuente, tres sin nombre, una sin ID y una con referencia nula de fuente. No deben sumarse como filas únicas.

Los agregados elegibles registran seis diferencias frente al inventario declarado: destinos en `24003` 5→4, `24006` 4→3, `24024` 4→3 y `24028` 10→6; alimentos en `24037` 73→72; alojamiento en `24054` 61→60. Las diferencias se deben a siete destinos sin fuente y dos establecimientos sin nombre. El universo municipal declarado mantiene sus agregados para regresión del portal; el universo elegible se entrega por separado. No se interpreta una exclusión documental como descenso de oferta turística real.

## Contrato producido y transferencia a las seis UCA

Se entregaron el [contrato formal](uca-01-almacenamiento/contrato-datos-v1.md) y el [catálogo procesable campaign-data-v1.0.0](uca-01-almacenamiento/contracts/campaign-data-v1.0.0.json). Su SHA-256 se incorpora al [manifiesto](../../research/curated/mission03/manifest.json). Se definen PK/FK, tipos, unidades, obligatorios/opcionales, nulos, linaje, variantes de fuente, licencias pendientes, coordenadas declaradas, tiempo territorial y elegibilidad por uso. Se reserva un esquema de intercambio para cada UCA, sin presentar análisis futuros como ejecutados.

| UCA | Producto que recibe / dependencia |
|---|---|
| 01 Almacenamiento | ETL, manifiesto, fuentes, dimensión histórica, cuarentena y controles reproducibles |
| 02 Minería | Inventario aceptado y agregados elegibles; denominadores, faltantes y sesgos de cobertura |
| 03 ML | Esquema de variables territoriales; target observado pendiente; no se entrenó modelo |
| 04 Estocásticos | Contrato para observaciones temporales y escenarios identificados; no hay calibración de demanda validada |
| 05 IO | Restricciones de elegibilidad y esquema de asignación; costos, respuesta y presupuesto operativo pendientes |
| 06 Marketing | Inventario preparatorio y límites de afirmaciones; derechos, operación y medición deben validarse antes del piloto |

La integración sigue la secuencia datos→análisis y escenarios→optimización→campaña y medición. `municipal-aggregates.json` se reserva para regresión; `eligible-municipal-aggregates.json` constituye la entrada nueva de conteos para las UCA. Ninguna fila se considera autorizada automáticamente para publicación ni para comparar límites territoriales en el tiempo.

## Pruebas y evidencia

Los resultados independientes se describen en [QA](uca-01-almacenamiento/mision-03-qa.md). La [comparación municipal](uca-01-almacenamiento/mision-03-regresion-municipal.json) acredita igualdad de todos los campos de las 58 claves comparables frente al checkpoint original. La igualdad se verifica con SHA-256 `77ef56e72165004242d26eb4187b1c4b4d066ef1cd285c6fd929c534e314ca76` antes y después.

| Verificación | Resultado / alcance |
|---|---|
| `npm run data:prepare` | Exit 0; conservación, FK, comparación municipal e inmutabilidad cruda; [log ETL](uca-01-almacenamiento/mision-03-etl.log) |
| `npm run test:data` | Ocho pruebas aprobadas; casos negativos y reconstrucción doble byte a byte frente a salidas persistidas, contrato y PK/FK |
| `npm run test:geo` | 42 pruebas aprobadas; rutas/geografía existentes |
| `npm run test:intel` | 78 pruebas aprobadas; claves, indicadores, recomendaciones y selección de destinos; 63 destinos × 58 claves conservan sus asociaciones |
| `node scripts/academic/compare-mission03-features.mjs` | 58 claves comparables sin cambios |
| `npm run check` | 0 errores, 0 warnings, 10 hints previos de símbolos sin uso; [log](uca-01-almacenamiento/mision-03-check.log) |
| `npm run build`, base `/san-luis-potosi-web` y sitio `https://elgueraai.github.io` | 309 páginas estáticas; aviso de chunks grandes; [log](uca-01-almacenamiento/mision-03-build.log) |
| `node scripts/academic/verify-mission03-build.mjs` | 59 páginas municipales, 58 indicadores y rutas principales presentes; sin vínculo local de Tanute atribuido a Pozos; [evidencia](uca-01-almacenamiento/mision-03-build-verification.json) |
| `git diff --check` | Sin defectos de whitespace en cambios con seguimiento |

Los scripts nuevos figuran en `package.json` como `data:prepare` y `test:data`; esta última suite queda integrada a `npm test` para ejecuciones futuras. En esta misión se ejecutaron las suites pertinentes al cambio, sin repetir signals, descargas o pruebas visuales ajenas al alcance. Los fixtures negativos no se incorporan al inventario observado. El build y las aserciones estáticas no constituyen QA visual exhaustiva, campaña desplegada ni validación de accesibilidad en navegador.

[DERIVADO] Se aprobaron 128 pruebas pertinentes: ocho de datos, 78 de inteligencia y 42 geográficas. El manifiesto final identifica la ejecución `983e13ce877ecd66f114`; el contrato tiene 10,956 bytes y SHA-256 `d55ab09196612b5ee51b5214cfb6a23d4e3459d3514f6650d8946e571799c903`. Tras ampliar el contrato se regeneraron los derivados y se repitió la comparación con los archivos persistidos; el retest final resultó satisfactorio.

## Archivos y evidencias

| Grupo | Archivos de esta misión |
|---|---|
| Corrección de datos | `research/scripts/entities/build-entities.mjs`, nuevo `integrity.mjs`; `research/entities/municipalities/index.json` |
| Consumidores | `src/lib/municipality.ts`, `src/data/portal.ts`, `src/lib/intel/features.ts`, `src/lib/intel/scoring.ts` |
| ETL y verificaciones | `scripts/academic/etl-mission03.mjs`, `compare-mission03-features.mjs`, `verify-mission03-build.mjs`; `package.json` |
| Pruebas | `tests/data-integrity/integrity.test.mjs`, `etl.test.mjs`; ampliaciones de `tests/intel/data.test.ts` y `scoring.test.ts` |
| Paquete local | `research/curated/mission03/`: baselines, hashes raw, entidades, fuentes, dimensión, cuarentena, candidatos, dos universos agregados, reporte y manifiesto |
| Expediente | Este consolidado; `uca-01-almacenamiento/mision-03-datos.md`, `contrato-datos-v1.md`, `contracts/campaign-data-v1.0.0.json`, `mision-03-qa.md`, evidencias de comparación/build y logs; `docs/bitacora/evidencias.md` |

## Riesgos pendientes y preparación de Misión 04

[SIN_DATOS] Persisten la versión contemporánea autenticada del catálogo municipal, intervalos legales cartográficos, correspondencias históricas y región de Pozos. Los puntos válidos numéricamente no acreditan pertenencia por polígono ni acceso. La revisión de derechos por recurso/afirmación, la vigencia de eventos, la operación de establecimientos y los candidatos homónimos requieren resolución posterior. Las 156 filas en cuarentena siguen disponibles mediante sus localizadores.

[SIN_DATOS] No se dispone de afluencia, ocupación, capacidades ecológicas, series de demanda ni eficacia real de campaña en el paquete. No se certifica actualidad por la fecha de consulta. No se entrenaron modelos, simularon visitantes ni contrataron servicios.

[HIPÓTESIS] La Misión 04 podrá diseñar medición agregada y consentida, eventos y ventanas de atribución, consentimiento/revocación, retención, destinatarios de coordenadas y pruebas de rechazo. Se conservará el inventario aceptado como base de cobertura, sin trasladar ubicaciones personales a nuevas analíticas. La implementación de la propuesta visual premium continuará sujeta a revisión humana. La publicación y cualquier integración con secretos, costos o servicios de pago requieren autorización específica.

El checkpoint queda listo para revisión humana del alcance técnico documentado. Las brechas de geografía actual, derechos y medición mantienen sus propias puertas de aceptación abiertas; no se presenta el paquete como inventario certificado para una campaña pública.
