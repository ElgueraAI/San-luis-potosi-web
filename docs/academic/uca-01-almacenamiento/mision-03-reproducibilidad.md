# Misión 03 — Corrección de reproducibilidad del checkpoint

Fecha: 2026-11-07, America/Mexico_City. Rama: `feature/academic-multiagents`. Referencia anterior: `00d2ca39aeecf7feba863838c509bb15a6b80dba`.

## Causa y decisión

[OBSERVADO] El índice estaba vacío al comenzar. La regla global `* text=auto eol=lf` y `core.autocrlf=true` convertían el baseline al preparar Git. El archivo de trabajo `research/curated/mission03/baseline-audit.json` tenía 624 CRLF. Su SHA-256 original era `eee23acff98cec44027536405282b613156e3c80811247e67337c82d4abd6411`; su representación LF tenía SHA-256 `1fafe018123bc964e47134ebe7ab7763e993c1d4c75b0f2b832abdebe3bb070d`. El manifiesto anterior esperaba los bytes originales.

[OBSERVADO] También presentaban CRLF dos entradas activas del ETL: `research/source-registry/sources.json` y `research/generated/municipality-region-map.json`. Por tanto, proteger sólo el baseline no resolvía la diferencia entre plataformas. Se localizaron otros JSON históricos con CRLF fuera del alcance; no se reescribieron indiscriminadamente.

Se distinguen tres representaciones:

- Los baselines `baseline-audit.json`, `municipalities-before.json` y `raw-manifest-before.json` constituyen evidencias históricas. Se preservan sus bytes originales mediante `-text` específico en `.gitattributes`; no se cambian sus contenidos ni hashes.
- Las entradas de texto ordinarias se representan en memoria como UTF-8 sin BOM y con LF. El manifiesto declara `representation:utf8_lf_no_bom`; sus tamaños, hashes y localizadores corresponden a esa representación. No se reescriben los archivos de origen. Los hashes referenciados por versiones de fuente y linaje cambian cuando la representación anterior era CRLF; los valores turísticos y los localizadores de fila se conservan.
- Los archivos crudos se verifican siempre por bytes físicos originales. Las salidas derivadas usan `JSON.stringify`, UTF-8/LF y salto final, sin reloj, rutas absolutas ni aleatoriedad. El manifiesto no contiene su propio hash.

## Implementación y trazabilidad

Se ajustaron `.gitattributes`, `etl-mission03.mjs`, el contrato y su explicación; se añadió una prueba de equivalencia LF/CRLF/BOM y `scripts/academic/verify-mission03-git.mjs`. Se regeneraron sólo los productos del ETL: cambiaron hashes y referencias de representación, sin alterar las 4,805 filas aceptadas, las 156 retenidas ni los valores analíticos. Las 58 claves comparables mantienen todos sus indicadores originales; su hash comparativo sigue siendo `77ef56e72165004242d26eb4187b1c4b4d066ef1cd285c6fd929c534e314ca76`.

El manifiesto vigente identifica la ejecución `22ffef0f00bdeb56a245`. El contrato canónico tiene SHA-256 `e903da4ffa0aa37c41372456097eb13a62866bb0c2a9ccb1e213dd7a10a8c404`. Las cifras y hashes previos de los informes originales describen ejecuciones anteriores; este anexo documenta la representación y la ejecución que las suceden.

## Reproducción desde Git

```powershell
npm run data:prepare
npm run test:data
npm run test:intel
npm run test:geo
npm run check
node scripts/academic/compare-mission03-features.mjs
node scripts/academic/verify-mission03-git.mjs
# Después del checkpoint:
node scripts/academic/verify-mission03-git.mjs --ref HEAD
```

El verificador compara cada entrada del working tree y del índice/commit con el hash del manifiesto bajo su representación declarada. Para los baselines exige además igualdad de bytes físicos. Exporta únicamente los blobs de entrada a un directorio temporal aislado e importa desde allí el ETL y su helper; compara todas sus salidas byte a byte contra Git. Los datos crudos privados se suministran por una unión temporal al directorio original, se leen y se verifican por hash. No se incorporan al commit ni se publican. Esta prueba reproduce los insumos de Git en aislamiento con raw externo; no equivale a descargar nuevamente fuentes ni a ejecutar Windows y Linux reales.

[SIN_DATOS] Las brechas territoriales, derechos por recurso y vigencia operativa de Misión 03 permanecen abiertas. No se modificó el código visual ni se inició la Misión 04. Los materiales previos ajenos se mantienen en el working tree.

## Resultados verificados antes del commit

[DERIVADO] Se aprobaron 129 pruebas: nueve de datos (incluidas dos reconstrucciones independientes y comparación de salidas persistidas), 78 de inteligencia y 42 geográficas. Astro check examinó 203 archivos: cero errores, cero warnings y diez hints previos. El build con base `/san-luis-potosi-web/` produjo 309 páginas y superó las aserciones estáticas de rutas y datos. Los 1,160 archivos crudos conservaron sus hashes originales.

[DERIVADO] El verificador de Git comprobó 24 entradas y nueve salidas desde una exportación aislada del índice. Para el baseline, working tree, blob Git y manifiesto coinciden exactamente en `eee23acff98cec44027536405282b613156e3c80811247e67337c82d4abd6411`. Para entradas ordinarias se comprobó explícitamente la representación canónica, no se exigió igualdad de los bytes físicos CRLF con LF. La primera ejecución aislada fue bloqueada por el sandbox al crear la unión temporal; la ejecución con permiso terminó correctamente y eliminó esa unión.

La regla específica `whitespace=cr-at-eol` permite a Git reconocer el CRLF histórico del baseline sin reportarlo como espacios finales; no altera sus bytes ni desactiva las demás comprobaciones de whitespace. No se incluyeron raw, documentos privados ni credenciales en la selección; el mayor artefacto es el snapshot de entidades de 11,580,203 bytes. El escaneo por patrones no equivale a una garantía exhaustiva contra cualquier secreto posible.
