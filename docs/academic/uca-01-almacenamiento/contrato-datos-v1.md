# Contrato de intercambio turístico — campaign-data-v1.0.0

Fecha: 2026-11-07, America/Mexico_City. Estado: contrato de preparación local; no certificación de geografía contemporánea ni autorización de publicación. La representación procesable se encuentra en [campaign-data-v1.0.0.json](contracts/campaign-data-v1.0.0.json). Los resultados de ejecución se documentan en [Misión 03](mision-03-datos.md).

Corrección de reproducibilidad: cada entrada del manifiesto declara `representation`. `utf8_lf_no_bom` identifica la representación canónica de texto (UTF-8, sin BOM, CRLF/CR convertidos a LF en memoria); `bytes` y `sha256` corresponden a esa representación, sin reescribir el origen. `original_bytes_immutable` preserva los tres baselines históricos exactamente. Los hashes de `raw_inputs` siempre corresponden a bytes físicos originales. Las salidas se generan como UTF-8/LF con newline final. Los hashes de versiones de fuente y el linaje usan la representación declarada de entrada; no deben interpretarse como hashes físicos de un archivo CRLF. Esta precisión conserva el contenido científico y permite reproducirlo desde los blobs de Git.

## Alcance, versiones y estados de evidencia

El grano de entrada corresponde a una ficha o asiento de directorio en un snapshot, no a una persona, visitante o negocio único. Los registros municipales son una dimensión, no atractivos. Las rutas editoriales y el contexto estatal de 2022 se conservan fuera de los controles fila a fila de entidades. [OBSERVADO] identifica valores presentes en snapshots locales, sin acreditar actualidad operativa. [DERIVADO] identifica conteos, validaciones e indicadores. [HIPÓTESIS] identifica parámetros propuestos; [SIMULADO] corresponde a resultados de escenarios identificados separadamente. [SIN_DATOS] identifica observaciones que no están disponibles. No se entrenaron modelos ni se produjeron escenarios en esta misión.

La versión mayor cambia ante modificaciones incompatibles de grano, claves o significado; la menor incorpora campos opcionales; el parche corrige documentación o validaciones sin reinterpretar observaciones. Cada entrega debe citar versión de contrato, hash de entradas, código de transformación y archivos de salida. No se introduce una fecha de ejecución variable en los productos deterministas. La fecha declarada de generación no sustituye el periodo de observación.

## Claves, tipos y nulos

| Elemento | Regla contractual | Unidad / nulabilidad |
|---|---|---|
| `dataset`, localizador de fila y SHA-256 de entrada | Identifican el asiento original incluso cuando no existe ID válido; el localizador técnico no es una clave territorial inventada | texto / entero base cero; obligatorios en linaje |
| ID de entidad | Texto no vacío; duplicados exactos bloquean todos los miembros del grupo, sin conservar arbitrariamente el primero | PK lógica por snapshot; ID ausente implica cuarentena |
| Clave municipal | Texto de cinco caracteres, patrón `^24[0-9]{3}$`, distinto de `24000`; debe existir en la dimensión admitida | FK; `null` significa desconocido, nunca municipio coincidente |
| Fuentes | Lista no vacía de IDs no nulos, cada uno resoluble a las variantes conservadas del registro | FK; no se acredita una licencia a partir del patrón del ID |
| Nombre | Texto no vacío; no se inventa para reparar registros sin nombre | obligatorio para elegibilidad estructural |
| Región | `altiplano`, `centro`, `zona-media`, `huasteca` o `null` | clasificación declarada; no se deriva por proximidad |
| Latitud, longitud | Número finito en WGS84, grados decimales; ambos presentes o ambos nulos; rangos globales y ventana local comprobados | latitud −90 a 90; longitud −180 a 180; no se imputan puntos |
| Coordenadas desconocidas | El par nulo puede conservarse para análisis no espacial | `null` no es `[0,0]`; par incompleto/ inválido bloquea aceptación estructural |
| Conteos municipales | Enteros no negativos de asientos que cumplen la regla de agrupación; fórmula y exclusiones explícitas | registros; cero significa conteo ejecutado en universo cubierto; desconocido = `null` |
| Fechas | ISO `YYYY-MM-DD` real y orden inicio ≤ fin cuando ambas existen | zona de fechas académicas America/Mexico_City; desconocido = `null` |
| Población | Valor histórico de ITER 2020 en su geografía original | personas en 2020; no se redistribuye al territorio posterior |

Los campos opcionales —descripción, región, contacto, punto, fecha de evento y URL— permanecen ausentes o nulos según el snapshot conservado. Su ausencia restringe el uso correspondiente; no se rellena con cadenas vacías, cero, centroides ni valores de otro municipio. Las colecciones vacías significan ausencia de relaciones admitidas, no ausencia demostrada de recursos turísticos en el territorio. Un valor válido sintácticamente no acredita vigencia ni exactitud territorial.

## Procedencia, licencias y coordenadas

Cada fila curada debe conservar el registro de entrada y su localizador, hash, referencias a fuentes y transformaciones. El linaje disponible es por fila: una lista de fuentes no acredita automáticamente cada campo. La atribución campo por campo necesita un localizador verificable adicional antes de convertir una afirmación editorial en contenido promocional confirmado.

Cada variante de fuente conserva el archivo de registro, su hash, fila y metadatos originales. La duplicación de `source_id` entre registros no se resuelve por precedencia silenciosa. El estado de derechos debe distinguir revisión pendiente de licencia comprobada, y delimitar datos, texto, imagen y acceso API. Los términos citados en la Misión 02 siguen siendo evidencia documental de esa revisión, sin una nueva comprobación en línea. La falta de campo de licencia no prueba falta de derechos; tampoco habilita redistribución. El paquete académico local no se considera exportación pública aprobada.

`verified`, `registry`, `approximate`, `municipal-seat` y `unavailable` mantienen la declaración original de coordenadas. Un punto de cabecera o aproximado no se convierte en entrada verificada de un atractivo. El control de ventana estatal no demuestra pertenencia a un polígono municipal, accesibilidad, operación ni seguridad. El contrato no almacena ubicaciones de usuarios.

## Tiempo territorial y elegibilidad

[OBSERVADO] El catálogo recibido mezcla claves históricas respaldadas por ITER 2020/PDU y una fila de Villa de Pozos sin clave. Su fecha de generación es 2026-10-05; no es la fecha de vigencia legal de todas las fronteras. [SIN_DATOS] No se dispone en este alcance de una versión contemporánea autenticada del Catálogo Único ni de correspondencias de límites. `valid_from` y `valid_to` desconocidos permanecen nulos. La fecha legal citada por la Misión 02 no se convierte en un intervalo cartográfico certificado. La clave `24059` se conserva como observada en DENUE, con correspondencia pendiente, sin reemplazar todos los nulos por ella.

Se establecen cuatro puertas independientes:

1. **Estructural:** PK válida, nombre, fuentes resolubles, coordenadas y fechas válidas. La cuarentena conserva fila original y motivos. Los candidatos por homonimia requieren revisión, sin fusionar sucursales automáticamente.
2. **Agrupación histórica:** clave válida que exista en el catálogo local documentado. Los registros sin correspondencia quedan fuera del agregado admitido. El resultado es un inventario por clave declarada, con compatibilidad temporal pendiente; no una reconstrucción de límites actuales.
3. **Análisis espacial o temporal:** requiere punto, precisión y periodo suficientes para la pregunta. Una aceptación estructural no autoriza distancias de acceso, tendencias temporales ni comparación entre límites distintos.
4. **Campaña pública:** requiere además revisión por recurso de derechos, vigencia del evento, operación, afirmaciones, acceso y medición consentida. Ninguna fila obtiene autorización automática por superar los controles de esta misión.

La aplicación conserva el directorio municipal y sus rutas. La capa de indicadores excluye municipios sin clave válida o sin los ocho conteos necesarios completos: destinos, museos, recintos, arqueología, eventos, alojamiento, alimentos y áreas protegidas. Los destinos sin clave no se atribuyen por semejanza de nombre. Los indicadores actuales siguen siendo proxies de oferta; no pasan a representar afluencia o saturación.

`municipal-aggregates.json` reconstruye las agregaciones declaradas, incluida la cuarentena, exclusivamente para comprobar regresión del portal. `eligible-municipal-aggregates.json` agrupa sólo filas estructuralmente aceptadas y entrega `declared_member_rows`, `accepted_member_rows`, `scope`, `unit` y `evidence_class`. Éste constituye la entrada de conteos para las UCA posteriores. `measures_as_declared.counts` conserva el valor previo de cada ficha municipal como evidencia de origen: no debe sustituir al agregado elegible. La separación conserva los indicadores de las claves válidas del portal y evita transferir sus defectos documentales al análisis nuevo.

## Entradas y salidas para las seis UCA

| UCA | Entrada admitida | Esquema de salida y aceptación | Transferencia a la campaña |
|---|---|---|---|
| 01 Almacenamiento | snapshots de entidades, fuentes y catálogo, todos con hash | entidades aceptadas, cuarentena con motivos, variantes de fuente, dimensión temporal, manifiesto y comparación; reproducibilidad byte a byte | límites de inventario y elegibilidad |
| 02 Minería | filas aceptadas y exclusiones; claves compatibles con universo declarado | `dataset_version, territory_basis, municipality_id, variable, value, unit, denominator, missing_count, evidence_class, formula_version, input_hashes`; EDA documentada, sin asociación de cesta sin transacciones | afinidades de oferta y sesgo de cobertura |
| 03 Aprendizaje de Máquina | variables territoriales de oferta con metadatos de UCA 02; objetivo observado sólo si existe | `model_version, input_hashes, feature_schema, split_protocol, metrics, limitations`; esquema reservado, no dataset de entrenamiento producido | criterios territoriales evaluables; ningún público observado inventado |
| 04 Modelos Estocásticos | observaciones temporales admisibles o parámetros expresamente hipotéticos | `scenario_id, parameter_version, distribution, unit, seed, method, input_hashes, evidence_class, interval`; resultados simulados separados de observaciones | escenarios y reglas de pausa propuestas |
| 05 Investigación de Operaciones | inventario elegible, restricciones documentadas, presupuesto autorizado y escenarios identificados | `allocation_version, destination_id, period, channel, amount_mxn, objective, constraints, feasibility, baseline, input_hashes, evidence_class`; propuesta, sin ROI observado | asignación justificable y límites |
| 06 Mercadotecnia | evidencias y restricciones anteriores; derechos y vigencia aprobados para publicación | `piece_id, destination_id, claim_sources, rights_status, channel, period, utm_policy, kpi_definition, evidence_class`; medición futura `date, channel, piece_id, impressions, clicks, intentions, cost_mxn, attribution_window, timezone, source_snapshot` | campaña integral con trazabilidad y consentimiento |

[SIN_DATOS] Las salidas analíticas de UCA 02–06 son esquemas de intercambio y puertas de aceptación: no se declaran ejecutadas en esta misión. Impresiones, clics, conversiones, costos reales, afluencia, ocupación y capacidades ecológicas no tienen tabla observada poblada. El valor faltante permanece nulo; las personas compradoras propuestas mantienen estado [HIPÓTESIS].
