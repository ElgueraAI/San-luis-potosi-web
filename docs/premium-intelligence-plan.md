# Plan: inteligencia turística premium, señales externas y planificador con IA

Rama `feature/premium-intelligence-integrations`, creada desde `edea4db` (checkpoint-K) el 13 de octubre de 2026.
Continúa `smart-tourism-architecture.md`. Este documento es la entrega de la Fase 0: inventario, auditoría de
fórmulas, matriz de impacto, arquitectura objetivo y criterios de aceptación. Las fases 1 a 4 lo actualizan al cerrar.

## 1. Estado verificado al iniciar

| Comprobación | Resultado |
|---|---|
| `git branch --show-current` | `feature/smart-tourism-engine` (árbol limpio) |
| `git log -6 --oneline` | `edea4db` K · `907f1ae` J · `d93b12a` I · `cb29b23` H · `3e1de43` G · `292952a` F |
| `git remote -v` | `origin https://github.com/ElgueraAI/San-luis-potosi-web.git` |
| Ramas públicas | `deploy/github-pages-mvp` = `origin/deploy/github-pages-mvp` = `27e0f4a`; `main` = `122d6bb`; etiqueta `v0.1.0-mvp` |
| `npm run check` | 0 errores, 0 advertencias, 10 sugerencias |
| `npm run build` | 308 páginas, sin errores |
| Rama nueva | `feature/premium-intelligence-integrations` desde `edea4db` |

El checkpoint-K está completo en la rama: `src/lib/intel/` (14 módulos), `src/scripts/intel/` (8), las tres páginas y
el tablero. Nada se publica, se fusiona ni se sube desde esta rama.

## 2. Inventario técnico

**Dependencias de ejecución:** `astro` 7, `maplibre-gl` 6, `pmtiles`, dos familias tipográficas de Fontsource.
**De desarrollo:** `@astrojs/check`, `typescript`, `playwright-core`. No hay React, ni librería de gráficas, ni marco de
pruebas: las pruebas usan `node:test` empaquetadas con el esbuild que trae Vite.

**Estilos:** `src/vendor/scrollcraft/scrollcraft.css` (motor de escena de la portada), `tokens.css` (marca, tipos,
fondos `data-ground`, tonos `data-tone`, acentos regionales `data-region`), `base.css`, `portal.css`, `intel.css`.

**Componentes reutilizables:** `PageHeader` (cabecera con o sin foto), `Photo` (WebP adaptable con dimensiones
intrínsecas), `MapView` + `scripts/map.ts` (MapLibre con teselas de OpenFreeMap, cargado al acercarse al visor),
`RouteButton` y `route-store` (Mi Ruta), `Weather` + `scripts/weather.ts` (Open-Meteo, una solicitud por página,
caché de 15 minutos).

**Rutas:** todas salen de `src/i18n/routes.ts`, que aplica la ruta base de GitHub Pages. Ningún componente escribe una
ruta a mano.

**Pruebas:** `tests/geo` (42) y `tests/intel` (66) con `npm run test`; suites de navegador en `scripts/verify/`
(`intel.mjs` 104 comprobaciones, `routing.mjs` 93, `navigation.mjs` 63, `pages.mjs` capturas y desbordes,
`links.mjs` enlaces internos, `keyboard.mjs`, `interactions.mjs`). Las suites de navegador simulan a los proveedores.

**Servidor:** ninguno en producción. `serverless/route-proxy/worker.js` es un Worker opcional, no desplegado, que
guardaría la clave de openrouteservice.

**Geometría municipal:** la base no contiene polígonos municipales, solo el contorno del estado y las cabeceras
(INEGI). El mapa de oportunidades usa puntos en las cabeceras; no se dibujan fronteras.

## 3. Auditoría de fórmulas

No se recalibra nada en esta rama. Las constantes viven en el código y los documentos de método las repiten; esta
tabla fija qué implementa cada una y qué se puede decir con ella.

### 3.1 Exposición estimada (proxy)

| | |
|---|---|
| Implementación | `municipalityFeatures()` en `src/lib/intel/features.ts`; pesos en `EXPOSURE_WEIGHTS` |
| Entradas | `counts.lodging` del municipio (DENUE + Estadía); destinos del municipio con prioridad editorial A; si algún lugar del municipio es Pueblo Mágico |
| Expresión | `0.5 · ln(1 + hospedaje) / ln(1 + máx. estatal de hospedaje) + 0.3 · mín(1, destinosA / 3) + 0.2 · [tiene Pueblo Mágico]`, recortado a 0–1 y redondeado a tres decimales |
| Rango | 0 a 1 |
| Justificación de pesos | Juicio de diseño: la oferta de alojamiento instalada es la única señal cuantitativa de visibilidad que existe en la base, por eso pesa la mitad; la prioridad editorial y el distintivo federal ajustan |
| Supuestos | Más hospedaje registrado y más promoción implican mayor visibilidad para quien planea un viaje |
| Interpretación admisible | Qué tan visible es hoy el municipio, de forma relativa dentro del estado |
| Limitaciones | No mide visitantes, ocupación ni saturación. Subestima municipios con mucha visita de un día. La prioridad A es una decisión del proyecto. El DENUE no confirma operación |

### 3.2 Potencial de diversificación

| | |
|---|---|
| Implementación | `municipalityFeatures()`; pesos en `POTENTIAL_WEIGHTS` |
| Entradas | Exposición estimada; atractivos puntuables (destinos, museos, arqueología, áreas protegidas); eventos; índice de infraestructura |
| Expresión | `(1 − exposición) × (0.6 · atractivo + 0.4 · infraestructura)`, con `atractivo = mín(1, ln(1 + atractivos + eventos/2) / ln 9)` e `infraestructura = ln(1 + hospedaje + alimentos) / ln(1 + máx. estatal)`. Vale 0 si el municipio no tiene atractivos ni eventos |
| Rango | 0 a 1 |
| Justificación de pesos | Juicio de diseño: tener qué ofrecer pesa más que tener dónde atender; la escala logarítmica evita que la capital aplaste al resto y se satura en ocho atractivos |
| Supuestos | Un municipio es una oportunidad si tiene oferta y servicios y hoy está poco expuesto |
| Interpretación admisible | Orden relativo de municipios donde una sugerencia adicional tendría sustento en la base |
| Limitaciones | Hereda las de sus insumos. No dice nada sobre capacidad de carga, calidad ni interés real del visitante |

### 3.3 Concentración del hospedaje

| | |
|---|---|
| Implementación | `concentration()` y `topShare()` en `features.ts` |
| Entradas | Registros de hospedaje por municipio |
| Expresión | Herfindahl–Hirschman `Σ (vᵢ / Σv)²`; y participación de los cinco valores mayores `Σ top5 / Σv` |
| Rango | 0 a 1 (1 = todo en un municipio; el mínimo con 59 municipios iguales sería 0.017) |
| Justificación | Índice estándar de concentración; no tiene pesos |
| Supuestos | Cada registro cuenta igual |
| Interpretación admisible | Qué tan repartida está la oferta de alojamiento registrada |
| Limitaciones | Cuenta establecimientos, no cuartos ni ocupación |

### 3.4 Puntaje del recomendador

| | |
|---|---|
| Implementación | `scorePlace()` y `rank()` en `src/lib/intel/scoring.ts`; pesos en `WEIGHTS` |
| Entradas | Perfil (intereses, tiempo, transporte), punto de partida o desvío, mes, clima actual, índice de infraestructura del municipio, nivel de evidencia del registro |
| Expresión | `base = 100 × Σ wᵢ·vᵢ / Σ wᵢ` sobre los factores con datos; pesos: intereses 0.36, distancia 0.20, temporada 0.16, servicios 0.10, clima 0.09, evidencia 0.09. `puntaje = mín(100, base + bono de evento + bono de diversificación)` |
| Rango | 0 a 100, entero |
| Justificación de pesos | Juicio de diseño documentado en `recommendation-engine.md`: lo que el visitante declara pesa más; la distancia es el segundo límite real |
| Supuestos | Alcance cómodo `(horas / 3) × velocidad media`; distancia en línea recta desde el origen |
| Interpretación admisible | Orden de afinidad con las preferencias declaradas y el contexto disponible |
| Limitaciones | No es una probabilidad ni una calificación de calidad. La cifra tiene resolución de un punto pero no esa precisión: por eso la interfaz nueva la acompaña de una banda cualitativa |

### 3.5 Bonos de relevancia y diversificación

| | |
|---|---|
| Implementación | `scorePlace()`; constantes `RELEVANCE_GATE`, `EVENT_BONUS`, `DIVERSITY_BONUS_MAX`, `LOW_EXPOSURE`, `MIN_POTENTIAL` |
| Entradas | Puntaje base; evento del municipio en el mes y el estado de su fecha; regiones y municipios ya presentes en Mi Ruta; exposición y potencial del municipio |
| Expresión | Solo si `base ≥ 55`: evento confirmado +4, patrón oficial +3, última edición +1.5; región nueva +3, o municipio nuevo +1.5; oferta poco expuesta `+3 × potencial` si exposición < 0.4 y potencial ≥ 0.3. El bono de diversificación se limita a 6 |
| Rango | Evento 0 a 4; diversificación 0 a 6 |
| Justificación | Pequeños a propósito: ordenan entre lugares ya relevantes sin poder convertir uno irrelevante en recomendado |
| Supuestos | Un visitante valora un evento en su mes y variedad territorial, siempre después de la relevancia |
| Interpretación admisible | Ajuste de orden, nunca penalización: ningún lugar pierde puntos por ser conocido |
| Limitaciones | El escenario simulado muestra que casi no cambian la lista (30 % frente a 29 % de sugerencias en municipios poco expuestos). El efecto real depende de datos que no existen |

### 3.6 Oportunidad de diversificación (alternativas)

`alternativesFor()` en `src/lib/intel/diversify.ts`. Un candidato pasa filtros (similitud ≥ 0.3, brecha de exposición
≥ 0.1, infraestructura ≥ 0.15, evidencia no baja, a menos de 110 km en auto o 45 minutos de desvío) y después se
puntúa: `100 × Σ wᵢ·cᵢ / Σ wᵢ` con similitud 0.30, coste 0.20, brecha de exposición 0.20, infraestructura 0.10,
novedad 0.10, temporada 0.05 y evidencia 0.05. Mismas reservas: pesos de diseño, exposición como proxy.

## 4. Matriz de impacto

| Componente | Fase | Cambio | Riesgo |
|---|---|---|---|
| `src/pages/inteligencia-turistica/index.astro` | 1 | Se reescribe como relato de seis capítulos | Medio: `scripts/verify/intel.mjs` comprueba textos del tablero y se actualiza con él |
| `src/components/intel/Dashboard.astro` | 1 | Se sustituye por componentes de capítulo en `src/components/intel/` | Medio |
| `src/styles/intel.css` | 1 | Tarjetas editoriales, banda de afinidad | Bajo: las clases `rk*` se conservan |
| `src/scripts/intel/cards.ts`, `discover.ts`, `descubre.astro` | 1 | Jerarquía visual, primera tarjeta destacada, indicador de temporada | Medio: la lógica y los atributos `data-*` no cambian |
| `src/styles/tokens.css` | 1 | Se añaden tonos (`forest`, `teal`) y la paleta de gráficas | Bajo: solo adiciones |
| Nuevos `src/lib/charts/`, `src/scripts/intel/dashboard.ts`, `opportunity-map.ts` | 1 | Geometría de gráficas y su interacción | Nuevo |
| Nuevos `src/lib/signals/`, `serverless/signals-proxy/` | 2 | Capa de proveedores externos y Worker | Nuevo, apagado por defecto |
| Nuevos `src/lib/planner/`, `src/pages/planea-con-ia.astro` | 3 | Planificador y asistente | Nuevo |
| `HomeHero`/portada, encabezado, menú, búsqueda | 3 | Una entrada «Planea tu viaje con IA» | Bajo |

**Permanece intacto:** `src/lib/intel/` (fórmulas, pesos, escenario), `src/scripts/geo/` (rutas, navegación,
optimizador, caché), `scripts/map.ts` y `MapView`, el proveedor de rutas y su política, `research/` (fuente de verdad),
la portada salvo su llamada a la acción, las páginas de destinos, municipios, eventos y directorios, y el flujo de
despliegue `.github/workflows/deploy.yml`.

## 5. Arquitectura objetivo

```
Navegador (GitHub Pages, estático)
 ├─ /inteligencia-turistica/   capítulos · gráficas SVG generadas en la compilación · mapa MapLibre bajo demanda
 ├─ /descubre/                 recomendador (sin cambios de lógica)
 ├─ /planea-con-ia/            cuestionario → planificador determinista → (opcional) redacción con LLM
 └─ src/lib/signals            caché · cuotas · cortacircuitos · adaptadores
        │  solo si PUBLIC_SIGNALS_PROXY_URL existe y el proveedor está activado
        ▼
Cloudflare Worker (no desplegado)   claves en Secrets · lista de proveedores · límites del lado servidor
        ▼
BestTime · TomTom Traffic · Flightradar24 · proveedor de LLM
```

Open-Meteo sigue consultándose directo desde el navegador: no requiere clave.

Principios: el sitio funciona completo sin el Worker; cada señal externa lleva proveedor, hora de obtención, tipo de
evidencia y estado (`live`, `forecast`, `historical`, `stale`, `unavailable`, `simulated`); una señal simulada nunca
se presenta junto a una observada sin su etiqueta; el LLM solo redacta sobre una selección que el recomendador ya
hizo y su salida se valida contra el catálogo.

## 6. Decisión sobre gráficas

SVG y HTML generados en la compilación por componentes propios (`src/lib/charts`), con una capa de interacción en
TypeScript. No se añade D3, Observable Plot ni Chart.js.

| Criterio | SVG propio | D3 modular | Observable Plot | Chart.js |
|---|---|---|---|---|
| Peso en el cliente | 0 KB de librería; ~6 KB de interacción | 30–90 KB según módulos | ~200 KB con D3 | ~70 KB |
| Accesibilidad | Marcado propio: títulos, tablas alternativas, foco | Depende del autor | Limitada | Canvas: requiere alternativa aparte |
| Astro estático | Se renderiza en la compilación; visible sin JavaScript | Requiere hidratar | Requiere hidratar | Requiere hidratar |
| Datos | Usa directamente `src/lib/intel` | Igual | Igual | Igual |
| Mantenimiento | Geometría con pruebas unitarias | API amplia | Poco control de marcado | Configuración |

Con 59 municipios, 154 lugares y 145 eventos no hay volumen que justifique una librería; el mapa sí usa MapLibre, que
ya está en el proyecto y se carga solo cuando el capítulo se acerca al visor.

## 7. Criterios de aceptación

Fase 1: seis capítulos navegables; formas de gráfica distintas, cada una con título, unidad, fuente y alternativa
tabular; mapa de oportunidades con leyenda que marca los proxies; calendario con filtros de mes y región;
`/descubre/` conserva su comportamiento (la suite `intel.mjs` pasa); sin desbordes en 360, 390, 768, 1440 y 1920;
`prefers-reduced-motion` respetado.

Fase 2: `docs/external-api-evaluation.md` con lo verificado en la documentación oficial; adaptadores con pruebas
sobre respuestas de ejemplo; caché, cuotas y cortacircuitos probados; ningún proveedor de pago activo; estado de cada
API declarado.

Fase 3: el planificador entrega un itinerario solo con lugares del catálogo, con y sin LLM; la salida del modelo se
valida con esquema y se descarta si cita un id desconocido; `LLM_MODE=disabled` por defecto.

Fase 4: suites en verde, sin `localhost` ni secretos en el build, ruta base comprobada con la capitalización del
repositorio, y un informe que distingue implementado, probado, simulado, pendiente y bloqueado.

## 8. Lo que requiere al usuario

Crear cuentas o claves (BestTime, TomTom, Flightradar24, proveedor de LLM), desplegar el Worker, activar cualquier
servicio con facturación, y publicar. Todo lo demás se desarrolla y se prueba sin esas credenciales.
