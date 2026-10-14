# Evaluación de APIs externas para la distribución inteligente del turismo

Checkpoint M. Código: `src/lib/signals/` (modelo común, guardas y adaptadores), `src/scripts/signals/` (cliente del
navegador), `serverless/signals-proxy/` (Worker que guardaría las claves), página `/inteligencia-turistica/senales/`.
Pruebas: `tests/signals/` y `scripts/verify/signals.mjs`. Presupuesto de consultas: `api-quota-budget.md`.

## Estado en una línea

**Ninguna API con clave está conectada.** El proyecto no tiene cuentas en BestTime, TomTom ni Flightradar24, y el
Worker no está desplegado. Los adaptadores están escritos contra la documentación pública y probados con respuestas
de ejemplo con la forma documentada; nada de eso demuestra que la integración real funcione. Open-Meteo es la única
fuente externa en uso, sin clave, y ya lo estaba antes de esta fase.

| Proveedor | Estado | Motivo |
|---|---|---|
| Open-Meteo | **Activa** (sin cambios) | Sin clave; consulta directa desde el navegador, una por página, caché de 15 min |
| BestTime | **Solo simulada** | Requiere cuenta y clave privada; la cobertura en San Luis Potosí no está verificada |
| TomTom Traffic | **Solo simulada**; lista para activarse con cuenta | Cuota gratuita amplia y cobertura declarada para México; falta la cuenta y desplegar el Worker |
| Flightradar24 | **Solo simulada**; el Worker apunta al entorno de pruebas | Los datos reales requieren suscripción; el entorno de pruebas requiere una clave propia |

## Método

La documentación se leyó el 13 de octubre de 2026 en las páginas oficiales enlazadas abajo. En las tablas, **leído**
significa que la cifra o el campo aparece en esa documentación; **no confirmado** significa que no pudo leerse (página
que solo carga con JavaScript, término no publicado, cifra de un tercero) o que la documentación no lo aclara. Precios
y cuotas cambian: hay que volver a leerlos antes de activar cualquier proveedor.

## Clases de dato

El modelo común (`TourismSignal`, `src/lib/signals/types.ts`) obliga a declarar dos cosas en cada valor:

| `evidenceType` | Significado | Ejemplos |
|---|---|---|
| `observed` | Medido o reportado por el proveedor para un momento | Velocidad actual de TomTom, concurrencia «en vivo» de BestTime, vuelos registrados |
| `estimated` | Producido por un modelo del proveedor | Previsión horaria de BestTime, velocidad de flujo libre, clima de Open-Meteo (también el «actual»: es un análisis de modelo, no una estación) |
| `simulated` | Respuesta de ejemplo del proyecto o del entorno de pruebas del proveedor | Todo lo que hoy muestra `/inteligencia-turistica/senales/` |
| `none` | No hay valor | Proveedor apagado, sin cobertura, sin cuota, error |

| `status` | Cuándo |
|---|---|
| `live` | Valor del momento presente |
| `forecast` | Previsión o patrón típico |
| `historical` | Periodo pasado (vuelos de un día) |
| `stale` | Valor anterior en caché, mostrado porque no se pudo actualizar; conserva su hora original |
| `unavailable` | Sin valor, con una nota que se muestra al visitante |
| `simulated` | Respuesta de ejemplo |

Reglas que el código hace cumplir (con pruebas): el estado `simulated` lo asigna el cliente al leer un ejemplo, no el
adaptador, así que ningún ejemplo puede presentarse como real; un valor que el proveedor no envía queda en `null`;
ninguna cifra se reescala entre lugares; un vuelo nunca se convierte en pasajeros ni en turistas. Los ejemplos usan
identificadores `demo-…` y nombres «de ejemplo», para no poner una cifra inventada junto a un museo, una carretera o
un aeropuerto reales.

## BestTime: concurrencia relativa

Documentación: <https://documentation.besttime.app/app/> · Precios: <https://besttime.app/subscription/pricing>

| Aspecto | Lo leído | Estado |
|---|---|---|
| Qué devuelve | Previsión semanal por hora de un establecimiento (`analysis[].day_raw`, 0 a 100 relativo al máximo semanal del propio establecimiento; `intensity_nr` de −2 a 2; 999 = cerrado) y concurrencia en vivo (`venue_live_busyness`, puede pasar de 100; `venue_live_forecasted_delta` de −100 a 100) | Leído |
| Origen del dato | «Derived from anonymized mobile signals» / «anonymized, aggregated location signals» | Leído |
| Cobertura | «150+ countries»; el dato en vivo solo «donde la densidad lo permite» | Leído en general; **San Luis Potosí no confirmado** |
| Autenticación | Par de claves: privada (crea previsiones, lee en vivo; «should be kept secret») y pública (solo consulta previsiones ya creadas) | Leído |
| Costo por llamada | Previsión nueva 2 créditos (fallida 1, salvo error del servidor); en vivo 1; consulta con clave pública 1; búsqueda de lugares 1 por cada 20 | Leído |
| Límites de frecuencia | 300 solicitudes por minuto por omisión; previsión y en vivo 10 por segundo; búsqueda 30 por minuto y 300 por hora; excederlos devuelve 429 | Leído |
| Prueba gratuita | «Limited free credits», sin tarjeta; cantidad no publicada | Leído; cantidad **no confirmada** |
| Precios | Basic medido: mínimo US$29 al mes y US$0.04 por crédito; Pro medido: US$99 al mes más US$0.009 por crédito (baja por volumen); paquetes desde US$96 al mes; posible descuento académico a cambio de un enlace | Leído en la página de precios |
| Almacenamiento | La previsión queda guardada en el servidor del proveedor; «venue filter» devuelve caché de hasta un mes | Leído. **Términos de uso y almacenamiento propio no leídos** |
| CORS | La documentación muestra `fetch` desde el navegador pero no declara CORS | No confirmado; irrelevante: la clave privada nunca va al navegador |
| Ruta del dato en vivo | La página muestra `/forecast/live` y `/forecasts/live` en distintos ejemplos | **Ambigua**; el Worker usa `/forecasts/live` y debe comprobarse con una cuenta |
| Ventana horaria de `day_raw` | El adaptador supone que los 24 valores empiezan a las 6:00 | **No confirmado** en la lectura; comprobar con la primera respuesta real |

**Utilidad para la distribución turística.** Es la única de las cuatro que acerca algo parecido a «cuándo hay más
gente», y por eso la más atractiva para sugerir horarios tranquilos. Sus límites para este proyecto son serios:

- El valor es **relativo a cada establecimiento**. Un 80 % en un museo pequeño y un 80 % en la Catedral no son la
  misma cantidad de personas. El módulo «¿Cuándo conviene visitar?» solo compara horas de un mismo lugar en un mismo
  día (tranquila ≤ 40 % del máximo del día; concurrida ≥ 80 %) y lo dice en pantalla.
- Funciona con establecimientos con nombre y dirección, no con cascadas, sierras ni áreas naturales, que son buena
  parte de la oferta potosina.
- Sin cuenta no se sabe cuántos de los 15 museos del piloto tienen datos. Fuera de la capital es razonable esperar
  poca cobertura; si no hay datos, la interfaz dice «Sin información de concurrencia para este establecimiento» y no
  rellena nada.

**Piloto propuesto** (`serverless/signals-proxy/catalog.json`): 15 museos del Sistema de Información Cultural, de 3 a
4 por región, con nombre y dirección oficiales. Se excluyó uno marcado como cerrado temporalmente. Cobertura: sin
verificar en los 15.

**Decisión:** preparada, no activada. Activarla consume créditos de prueba de cantidad desconocida y después exige un
plan de pago; requiere tu autorización.

## TomTom Traffic: contexto vial

Documentación: <https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/product-information/introduction> ·
Flujo: <https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/flow-segment-data> ·
Incidentes: <https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-incidents/incident-details> ·
Cobertura: <https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/product-information/market-coverage> ·
Precios: <https://docs.tomtom.com/pricing>

| Aspecto | Lo leído | Estado |
|---|---|---|
| Flujo por tramo | `GET /traffic/services/4/flowSegmentData/{style}/{zoom}/{format}?key&point=lat,lon`; devuelve `currentSpeed`, `freeFlowSpeed`, `currentTravelTime`, `freeFlowTravelTime`, `confidence` (0 a 1), `roadClosure`, `frc` (clase de vía) y la geometría del tramo más cercano al punto | Leído |
| Incidentes | `GET /traffic/services/5/incidentDetails?key&bbox=…`; caja de **10,000 km² como máximo**; por incidente: `iconCategory`, `magnitudeOfDelay`, `events[].description`, `from`, `to`, `delay` (s), `length` (m), `roadNumbers`, `startTime`, `endTime`, `lastReportTime`, `probabilityOfOccurrence`; descripciones traducibles con `language` | Leído |
| Cobertura | México figura con ✔ en flujo y en incidentes («detailed data») | Leído. La densidad real en carreteras secundarias de la Huasteca o el Altiplano **no está confirmada** |
| Cuota gratuita mensual | Flujo por tramo 20,000; detalle de incidentes 2,500; teselas de tráfico 200,000 (vectoriales y raster, aparte); «no credit card needed» | Leído |
| Qué pasa al agotar la cuota | La página plantea la pregunta pero la respuesta no se pudo leer | **No confirmado**: no se sabe si rechaza o cobra. Por eso el Worker tiene topes muy por debajo |
| Precio por encima de la cuota | La página muestra tramos de volumen sin precio por solicitud | **No confirmado** |
| Frecuencia de actualización | No declarada en las páginas leídas | No confirmado |
| CORS y errores | `Access-Control-Allow-Origin: *`; 403 clave inválida, 429 demasiadas solicitudes, 5xx | Leído |
| Términos de almacenamiento y de mostrar sobre un mapa que no es de TomTom | No leídos | **No confirmado**: revisar antes de dibujar tramos sobre OpenFreeMap |
| Versión | La documentación recomienda las APIs «Orbis» para integraciones nuevas | Leído; el adaptador usa las versiones 4 y 5 documentadas y debe revisarse al activar |

**Utilidad.** Útil como contexto para decidir: un acceso a la Huasteca cerrado o muy lento cambia el plan del día.
Velocidad y cierres son observaciones del proveedor; la velocidad de flujo libre es una estimación suya. No dice nada
de cuántos visitantes van a un destino: tráfico no es afluencia turística.

**Diseño elegido.** Seis accesos fijos (cabeceras de San Luis Potosí, Matehuala, Rioverde, Ciudad Valles, Xilitla y
Tamasopo, coordenadas INEGI); el flujo responde por el tramo más cercano a ese punto, y la interfaz lo nombra «Acceso
a …», no como una carretera concreta. Incidentes en una caja de unos 41 × 40 km alrededor de cada punto (todas por
debajo del máximo, probado). **No recalcula ni optimiza rutas:** OSRM y openrouteservice siguen siendo el motor de
rutas, sin tráfico, y la página lo dice. Una capa de tramos sobre el mapa queda pendiente hasta tener datos reales y
haber leído los términos de visualización.

**Decisión:** la candidata más clara para activarse primero (cuota gratuita amplia, cobertura declarada, sin tarjeta
según la documentación). Requiere crear la cuenta y desplegar el Worker, ambas decisiones tuyas.

## Flightradar24: conectividad aérea

Documentación: <https://fr24api.flightradar24.com/docs/getting-started> ·
Entorno de pruebas: <https://fr24api.flightradar24.com/docs/sandbox-environment> ·
Créditos: <https://fr24api.flightradar24.com/docs/credit-overview> ·
Soporte: <https://support.fr24.com/support/solutions/articles/3000128177-can-i-test-the-api-before-purchasing-a-subscription->

| Aspecto | Lo leído | Estado |
|---|---|---|
| Documentación oficial | Las páginas de la documentación solo cargan con JavaScript y no pudieron leerse con las herramientas usadas | **No leída directamente** |
| Entorno de pruebas | Según el artículo de soporte: mismos caminos bajo `/api/sandbox/…`, datos estáticos predefinidos con el mismo esquema, sin consumir créditos, con una clave de pruebas distinta de la de producción | Leído en soporte (artículo de hace casi dos años) |
| Autenticación | `Authorization: Bearer <token>` y `Accept-Version: v1` | Leído en resultados de búsqueda y ejemplos del proveedor, no en la página de referencia |
| Planes | Explorer US$9 al mes con 30,000 créditos (blog del proveedor); Essential US$99 al mes (solo un tercero) | Explorer leído en el blog; Essential **no confirmado** |
| Retención de datos | El encargo menciona una restricción de almacenamiento; no se encontró el texto | **No confirmado**; el Worker guarda cada respuesta 1 hora como máximo |
| Campos de `flight-summary` | El adaptador usa `orig_icao`, `dest_icao`, `datetime_takeoff`, `datetime_landed` | **No confirmado**; comprobar con la primera respuesta del entorno de pruebas |
| Aeropuerto | Ponciano Arriaga, IATA SLP, ICAO MMSP | Dato conocido del aeropuerto |

**Utilidad.** Secundaria. Contar vuelos de llegada y salida describe conectividad, no demanda: **un vuelo no es un
número de pasajeros y un pasajero no es un turista**. Estimar pasajeros exigiría capacidad, ocupación y un modelo
validado, que no existen; el adaptador no lo intenta y una prueba lo verifica. Incluso conectado al entorno de
pruebas, el resultado se etiqueta como simulado, porque son datos estáticos de muestra que no describen ningún día
real.

**Alternativas más útiles**, sin integrar: estadística mensual de pasajeros de la Agencia Federal de Aviación Civil
(AFAC), DATATUR de la Secretaría de Turismo federal y los reportes de tráfico de Grupo Aeroportuario Centro Norte
(OMA), que opera el aeropuerto. Son fuentes públicas y miden pasajeros; conviene evaluarlas antes que una suscripción.

**Decisión:** solo adaptador y entorno de pruebas. Datos reales descartados por costo frente a utilidad.

## Open-Meteo: clima

Términos: <https://open-meteo.com/en/terms> · Licencia de los datos: CC BY 4.0

| Aspecto | Lo leído | Estado |
|---|---|---|
| Uso gratuito | Solo no comercial (sitios sin suscripción ni publicidad, investigación pública, contenido educativo) | Leído; el portal académico encaja |
| Límites | Menos de 10,000 llamadas al día, 5,000 por hora, 600 por minuto y 300,000 al mes | Leído |
| Licencia | CC BY 4.0, con atribución | Leído; el portal ya la cita |
| Clave | No se menciona para el uso gratuito; el portal la usa sin clave | Leído (no se menciona) |
| Bloqueo | Puede bloquear aplicaciones o IP que abusen, sin aviso | Leído |

**Uso actual, sin duplicar:** `src/scripts/weather.ts` hace una sola solicitud por página para todos los puntos, con
caché de 15 minutos. `openMeteoSignals()` solo traduce esa respuesta al modelo común; no hace una solicitud nueva. El
recomendador sigue usando el clima como ya lo hacía (`recommendation-engine.md`); no se añadió lógica meteorológica.
Distinción que se mantiene: el valor «actual» es un análisis de modelo (`estimated`, `live`), la probabilidad de
lluvia del día es un pronóstico (`forecast`) y el clima mensual del tablero es un promedio modelado 2016–2025, no un
pronóstico.

**Decisión:** activa, sin cambios.

## Comparación

| | BestTime | TomTom Traffic | Flightradar24 | Open-Meteo |
|---|---|---|---|---|
| Señal | Concurrencia relativa por hora | Velocidad, cierres, incidentes | Vuelos | Clima |
| Clase | Estimada (previsión) y observada (en vivo) | Observada; flujo libre estimado | Histórica (real) o simulada (pruebas) | Estimada (modelo) |
| Sirve para | Sugerir horas tranquilas en un lugar | Avisar del estado de un acceso | Describir conectividad | Ajustar actividades al aire libre |
| No sirve para | Comparar lugares, contar personas | Medir afluencia, recalcular rutas | Contar pasajeros o turistas | Avisos de seguridad |
| Cobertura en SLP | Sin verificar; probable solo en ciudades | Declarada para México | Un aeropuerto | Todo el estado (modelo) |
| Requiere | Cuenta, créditos, Worker | Cuenta, Worker | Cuenta (pruebas) o suscripción | Nada |
| Costo esperado | Créditos de prueba; luego pago | US$0 dentro de la cuota | US$0 en pruebas | US$0 |
| Estado | Simulada | Simulada, lista | Simulada (pruebas) | Activa |

## Qué se comprobó y cómo

- **Adaptadores** (`tests/signals/signals.test.ts`): cada uno con la respuesta documentada, con respuestas vacías,
  malformadas o sin cobertura, y con valores fuera de rango.
- **Guardas y Worker** (`tests/signals/*.test.ts`, 35 pruebas): caché, deduplicación, topes diarios y mensuales,
  cortacircuitos, 429, reintentos acotados, valores anteriores, interruptores, listas permitidas y enfriamiento tras un
  429 o un 5xx.
- **Navegador** (`scripts/verify/signals.mjs`): 12 comprobaciones en modo simulado y 23 con el Worker real corriendo
  en local, claves ficticias y un proveedor falso del propio script. «Live» en esa prueba significa «a través del
  proxy», no datos reales.

Ninguna de estas pruebas contactó a un proveedor.

## Lo que hace falta para pasar de simulado a real

1. Tu autorización para crear cuentas (TomTom primero; BestTime solo si aceptas el costo).
2. Desplegar el Worker con su almacenamiento de contadores (`serverless/signals-proxy/README.md`).
3. Leer los términos de almacenamiento y de visualización de cada proveedor.
4. Comprobar con la primera respuesta real los puntos marcados «no confirmado»: ventana horaria de BestTime, ruta de
   su dato en vivo, campos de Flightradar24 y densidad de TomTom fuera de las ciudades.
5. Verificar la cobertura de BestTime en los 15 museos y retirar del piloto los que no tengan datos.
