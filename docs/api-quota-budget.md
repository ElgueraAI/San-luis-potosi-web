# Cuotas y presupuesto de consultas a proveedores externos

Checkpoint M. Objetivo: **US$0 de gasto obligatorio** durante la etapa académica, y ningún gasto que no hayas
autorizado. Fuentes de las cuotas: `external-api-evaluation.md` (lectura del 13 de octubre de 2026). Código:
`serverless/signals-proxy/worker.js` (límites que obligan), `src/lib/signals/guard.ts` y `src/scripts/signals/client.ts`
(cortesía en el navegador).

## Estado actual del gasto

| Proveedor | Activación | Consultas reales hechas por el proyecto | Gasto |
|---|---|---|---|
| BestTime | Simulada | 0 | US$0 |
| TomTom Traffic | Simulada | 0 | US$0 |
| Flightradar24 | Simulada | 0 | US$0 |
| Open-Meteo | Activa (desde antes de esta fase) | La del uso normal del sitio, sin clave | US$0 |
| Modelo de lenguaje (fase 3) | Desactivado | 0 | US$0 |

No hay cuentas, claves ni medios de pago registrados en ningún proveedor.

## Cuotas y políticas conocidas

| Proveedor | Cuota o precio | Límite de frecuencia | Qué pasa al pasarse | Estado del dato |
|---|---|---|---|---|
| BestTime | Créditos de prueba de cantidad no publicada; Basic medido desde US$29 al mes + US$0.04 por crédito. Previsión nueva = 2 créditos, en vivo = 1 | 300/min; previsión y en vivo 10/s | HTTP 429 por frecuencia; por créditos, no confirmado | Precios y costos leídos; cantidad de prueba no confirmada |
| TomTom Traffic | Gratis al mes: 20,000 de flujo por tramo, 2,500 de detalle de incidentes; sin tarjeta | No publicado en lo leído | **No confirmado** si rechaza o cobra | Cuotas leídas |
| Flightradar24 | Entorno de pruebas sin créditos; Explorer US$9 al mes con 30,000 créditos | No leído | No leído | Explorer leído en el blog del proveedor; resto no confirmado |
| Open-Meteo | Gratis, no comercial | < 10,000/día, 5,000/hora, 600/min, 300,000/mes | Puede bloquear la aplicación o la IP sin aviso | Leído |

## Presupuesto conservador

Los límites que **obligan** están en el Worker (`BUDGETS`), porque un límite que solo existe en el navegador del
visitante no protege nada: cualquiera puede borrar su almacenamiento o llamar al Worker sin pasar por la página.
Cada uno se puede bajar con variables `LIMIT_<PROVEEDOR>_DAY` y `LIMIT_<PROVEEDOR>_MONTH`.

| Proveedor | Tope diario (Worker) | Tope mensual (Worker) | Unidad | Margen frente a la cuota gratuita |
|---|---|---|---|---|
| BestTime | 20 | 100 | créditos | No hay cuota gratuita conocida: cualquier uso puede ser de pago tras la prueba |
| TomTom | 300 | 2,000 | solicitudes (flujo + incidentes juntas) | 2,000 < 2,500, la menor de las dos cuotas: aun si todas fueran de incidentes, no se sale de lo gratuito |
| Flightradar24 | 20 | 200 | solicitudes; en el entorno de pruebas no se cuentan | El entorno de pruebas no gasta créditos |
| Modelo de lenguaje | 60 | 600 | solicitudes | Se define en la fase 3 |
| Por visitante | 40 | — | solicitudes de cualquier proveedor | Un solo visitante no puede agotar el día |

Topes de cortesía en el navegador (`CLIENT_LIMITS`), para no desperdiciar ni insistir: BestTime 12/60, TomTom
60/600, Flightradar24 6/60, Open-Meteo 200/3,000 (día/mes, por navegador).

### Estimación de consumo

| Proveedor | Demanda máxima sin topes | Con caché y topes |
|---|---|---|
| TomTom | 6 accesos × (flujo cada 5 min + incidentes cada 10 min) las 24 h ≈ 1,728 de flujo y 864 de incidentes al día, si siempre hubiera alguien mirando | Como mucho 300 al día y 2,000 al mes. Con poco tráfico real, el consumo será muy inferior, porque solo se consulta cuando alguien pulsa «Consultar accesos» |
| BestTime | 15 museos × 2 créditos = 30 créditos por renovar todas las previsiones; la previsión vale 7 días ≈ 130 créditos al mes, más 1 por cada lectura en vivo cada 15 min | Como mucho 100 créditos al mes. Fuera de la prueba gratuita, en el plan medido más barato equivaldría a unos US$4 en créditos más el mínimo de US$29: **no se activa sin tu autorización** |
| Flightradar24 | 1 consulta por día consultado | Caché de 1 hora; en el entorno de pruebas, US$0 |
| Open-Meteo | 1 solicitud por página con clima y visitante | Caché de 15 min por navegador; muy por debajo de 10,000 al día con tráfico académico |

### Costo proyectado

| Proveedor | Mientras siga simulado | Si se activa dentro de los topes |
|---|---|---|
| BestTime | US$0 | Créditos de prueba; después, plan de pago (mínimo US$29 al mes) |
| TomTom | US$0 | US$0 si la cuota gratuita y la ausencia de tarjeta funcionan como dice la documentación |
| Flightradar24 | US$0 | US$0 en el entorno de pruebas; datos reales desde US$9 al mes (descartado) |
| Open-Meteo | US$0 | US$0 |

## Mecanismos

### Caché

| Endpoint | Caché en el Worker (compartida por todos los visitantes) | Caché en el navegador |
|---|---|---|
| BestTime, previsión | 7 días | 7 días (sesión) |
| BestTime, en vivo | 15 min | 15 min |
| TomTom, flujo | 5 min | 5 min |
| TomTom, incidentes | 10 min | 10 min |
| Flightradar24 | 1 hora | 1 hora |
| Open-Meteo | — (no pasa por el Worker) | 15 min |

Un segundo visitante que pide lo mismo dentro del plazo no genera ninguna llamada al proveedor (probado).

### Solicitudes solo a petición

Nada se consulta por desplazar la página, mover el mapa ni con un temporizador. BestTime se consulta al elegir un
establecimiento; TomTom al pulsar «Consultar accesos»; Flightradar24 al pulsar su botón. Dos solicitudes iguales
simultáneas comparten una sola llamada.

### Reintentos y respuestas 429

| Situación | Navegador | Worker |
|---|---|---|
| Red caída o error 5xx | Un reintento como máximo | Responde 502 y **enfría al proveedor 60 s**: nadie lo llama en ese tiempo |
| Error 4xx | Sin reintento | Sin reintento |
| 429 del proveedor | Sin reintento; abre su cortacircuitos el tiempo de `Retry-After` (mínimo 60 s) | Enfría al proveedor el tiempo de su `Retry-After` (por omisión 15 min, máximo 6 h), para todos los visitantes |
| 429 por presupuesto del Worker | Igual que un 429 del proveedor | No llama al proveedor |
| Proveedor apagado o sin clave en el Worker | «Integración desactivada», sin reintento ni cortacircuitos | 503 con el código `provider-disabled` o `provider-not-configured` |

Durante el enfriamiento, el Worker responde sin llamar al proveedor y sin gastar presupuesto. El navegador consulta
los accesos de uno en uno, así que ante el primer rechazo deja de pedir: en la prueba con un proveedor que responde
429 o 500, el módulo entero llegó a él **2 veces como máximo** (antes de esta corrección llegaban 12).

### Cortacircuitos del navegador

Tres fallos seguidos de un proveedor lo pausan 5 minutos en ese navegador; un acierto reinicia la cuenta. Mientras
está abierto se muestra el último valor guardado, marcado como «Dato anterior (no actualizado)» con su hora original,
o «No disponible» si no hay ninguno. Un proveedor que falla nunca derriba la página: el cliente no lanza excepciones.

### Riesgo de concurrencia del almacenamiento

Los contadores viven en Workers KV, que **no es transaccional**: el Worker lee el contador, compara con el tope y
escribe el nuevo valor. Dos solicitudes simultáneas pueden leer el mismo valor y pasar las dos, así que un tope puede
rebasarse en tantas unidades como solicitudes lleguen a la vez. Según la documentación de Cloudflare (no releída en
esta fase), una escritura en KV puede tardar en verse desde otras ubicaciones de su red, lo que agranda ese margen
cuando los visitantes llegan desde regiones distintas.

Cómo se acota hoy:

1. Los topes por omisión están muy por debajo de las cuotas gratuitas (TomTom: 2,000 frente a 2,500 y 20,000), así que
   un rebase de algunas decenas sigue dentro de lo gratuito.
2. El tope por visitante y la carga uno a uno limitan las ráfagas.
3. La caché compartida hace que la mayoría de las solicitudes repetidas no lleguen al contador.

Para un tope exacto haría falta un contador atómico (Durable Objects de Cloudflare o equivalente). Queda como mejora
antes de cualquier proveedor de pago.

### Cómo se evita un gasto inesperado

1. **Apagado por omisión, en dos lugares.** El navegador usa ejemplos (`mock`) salvo que una variable diga `live` y
   exista la URL del Worker. El Worker no llama a nadie salvo que `SIGNALS_ENABLED` nombre al proveedor.
2. **Falla cerrado.** Sin clave, sin almacenamiento de contadores o con el proveedor apagado, el Worker responde sin
   llamar al proveedor.
3. **Lista permitida.** El navegador solo envía un identificador del catálogo; no puede pedir previsiones de
   establecimientos arbitrarios. Esto importa en BestTime, donde cada establecimiento nuevo cuesta créditos.
4. **Topes diarios, mensuales y por visitante**, aplicados antes de llamar al proveedor.
5. **Pruebas sin red.** Las pruebas unitarias y de navegador usan ejemplos y un proveedor falso; nunca consumen
   créditos. `scripts/verify/signals.mjs` solo habla con `127.0.0.1`.
6. **Sin medios de pago.** Recomendación: no registrar una tarjeta en ningún proveedor durante la etapa académica, y
   activar las alertas de consumo del panel de cada proveedor que las ofrezca al crear la cuenta.
7. **Interruptor de emergencia.** Vaciar `SIGNALS_ENABLED` (o poner `LLM_MODE=disabled`) en el Worker corta todas las
   llamadas al instante, sin volver a publicar el sitio. El sitio sigue funcionando: cada módulo muestra
   «Integración desactivada».

### Métricas de consumo

`GET /v1/status` del Worker devuelve, por proveedor: si está activo, si tiene clave (sí o no, nunca la clave), sus
topes y lo usado hoy y en el mes. La tabla de `/inteligencia-turistica/senales/` muestra el consumo contado en ese
navegador y el modo de cada proveedor. Hoy el consumo de los tres proveedores con clave es 0.

## Antes de activar un proveedor

1. Volver a leer su página de precios y cuotas; corregir este documento si algo cambió.
2. Confirmar qué pasa al agotar la cuota gratuita (TomTom).
3. Bajar los topes del Worker si la cuota real es menor que la documentada.
4. Activar de uno en uno, empezando por TomTom, y revisar `/v1/status` al día siguiente.
