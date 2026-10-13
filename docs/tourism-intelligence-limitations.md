# Límites del sistema de inteligencia turística

Qué puede afirmar el sistema, qué no, y por qué. Complementa `research-gaps.md` (vacíos de datos del portal) y
`smart-tourism-next-phase.md` § Known limits (rutas y navegación).

## Clases de información

| Clase | Qué es | Ejemplos | Cómo se muestra |
|---|---|---|---|
| **Observado** | Leído de una fuente oficial | Municipios, destinos, museos, eventos, registros DENUE, población 2020 | «Datos observados», con su fuente |
| **Derivado** | Calculado por el proyecto con fórmula publicada | Puntaje de recomendación, exposición (proxy), potencial de diversificación, infraestructura, cobertura, segmento | «Indicador derivado», «proxy», «estimado» |
| **Simulado** | Resultado de ejecutar los motores con perfiles sintéticos | Escenario del tablero | «Datos simulados para demostración académica» |
| **En tiempo real** | Solo dos cosas | La ubicación del visitante (su navegador, con permiso) y el clima actual (Open-Meteo) | Se dice de dónde viene |

Las tres primeras nunca se mezclan en una misma cifra ni en una misma gráfica.

## Lo que no existe en la base y, por tanto, no se afirma

| No hay datos de… | Consecuencia |
|---|---|
| Afluencia, visitantes, saturación | Ninguna frase dice que un lugar esté lleno o vacío. Se usa «exposición estimada (proxy)» |
| Ocupación o disponibilidad hotelera | «Hospedaje registrado», con la leyenda «no confirma disponibilidad» |
| Tráfico, cierres, estado del camino | Tiempos del proveedor «sin tráfico en tiempo real» |
| Tiempos de espera, aforo | No se mencionan |
| Precios | El presupuesto no altera el puntaje |
| Calificaciones u opiniones | No hay estrellas ni reseñas |
| Horarios (salvo las dos zonas del INAH) | Se pide confirmar con el recinto |
| Fechas 2026 de la mayoría de las fiestas | Cada evento lleva su estado: confirmada, patrón oficial, edición anterior o sin fecha |
| Resultados de campañas | La matriz es «Propuesta estratégica», sin cifras de desempeño |
| Comportamiento de usuarios reales | No hay métricas públicas ni modelo entrenado |

## Límites por componente

**Datos.** De los destinos publicados, 18 tienen punto aproximado (OpenStreetMap) y 8 no tienen punto: estos últimos
nunca entran en un cálculo de ruta. 29 de 59 municipios no tienen atractivo puntuable en la base, lo que puede reflejar falta de
investigación y no falta de oferta. El DENUE es un registro estadístico: incluye 141 establecimientos «sin nombre» y no
confirma operación; 132 filas usan la clave municipal 24059 (Villa de Pozos), ausente del catálogo del Censo 2020. La
última estadística turística oficial localizada es de 2022.

**Recomendador.** Los pesos son juicio de diseño, no parámetros estimados. Los intereses de museos, áreas protegidas y
catedrales se derivan del tipo oficial. La distancia desde el origen es en línea recta y el «alcance cómodo» es un
supuesto. Solo 8 lugares tienen temporada declarada por una fuente oficial; para el resto la temporada no cuenta.

**Contexto.** El clima corresponde a seis puntos de referencia, no a cada sitio, y el sistema no emite avisos de
seguridad: «puede afectar esta experiencia» es todo lo que los datos sostienen. El clima mensual es un promedio
modelado 2016–2025, no una normal oficial.

**Recorrido.** El desvío mostrado es una estimación geométrica hasta que el visitante pide medirlo; la medición usa
tiempos del proveedor sin tráfico. Los umbrales de navegación siguen sin prueba en carretera real.

**Redistribución.** El proxy de exposición combina oferta de hospedaje, prioridad editorial y distintivo de Pueblo
Mágico: puede subestimar municipios con mucha visita de un día. El efecto sobre la distribución real de visitantes no
puede medirse sin datos de demanda. La similitud usa etiquetas, no la experiencia del lugar.

**Optimización.** Minimiza tiempo de traslado según la matriz del proveedor. No considera horarios de apertura,
duración de cada visita, pernoctas ni preferencias de orden.

**Segmentación y mercadotecnia.** Segmentos por regla, sin validación externa. Los canales y mensajes son hipótesis.

**Escenario simulado.** Perfiles sintéticos, lista de sugerencias como unidad. No predice elecciones de nadie.

## Modos de fallo y comportamiento

| Situación | Comportamiento |
|---|---|
| Falla el clima | El factor de clima queda sin datos; la interfaz lo dice y sigue recomendando |
| Falla el servicio de rutas | Se muestran los lugares guardados; no hay línea, ni corredor, ni desvíos, ni distancia por carretera |
| El proveedor responde 429 | Mensaje de espera; sin reintento automático (política existente) |
| Permiso de ubicación denegado o posición no disponible | Se ofrece elegir un municipio de partida |
| Lugar sin coordenadas | Fuera de todo cálculo de ruta; distancia medida a la cabecera municipal y declarada así |
| Sin temporada oficial | No penaliza; el factor no cuenta |
| Sin imagen | Marcador contextual con el tipo de lugar |
| Sin conexión tras calcular | La ruta, las sugerencias y el avance permanecen en pantalla |
| No carga `/data/intel.json` | Mi Ruta conserva sus sugerencias por reglas anteriores; «Descubre» avisa y no inventa una lista |
| Almacenamiento bloqueado | El perfil vive en memoria durante la visita |

## Lo que haría falta para ir más lejos

Una fuente oficial y vigente de afluencia u ocupación por municipio; recolección de eventos con consentimiento;
verificación de coordenadas en campo; y la agenda 2026 de fiestas municipales. Hasta entonces, cada vacío se muestra
como vacío.
