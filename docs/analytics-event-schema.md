# Esquema de eventos de producto y privacidad

Código: `src/lib/intel/analytics.ts` (esquema y saneamiento, puro y con pruebas), `src/scripts/intel/analytics.ts`
(registro local), `src/scripts/intel/profile-store.ts` (perfil). Pruebas: `tests/intel/scoring.test.ts` (sección
analytics) y `scripts/verify/intel.mjs`.

## Estado actual: sin servidor

Esta versión no envía eventos a ningún lado. Se guardan en `localStorage` del navegador del visitante, con un máximo
de 300, para demostrar el esquema y alimentar la segmentación de la sesión. El visitante puede verlos contados,
exportarlos (JSON) y borrarlos desde `/descubre/`. El arreglo `adapters` está vacío a propósito: es el único punto de
extensión para un recolector futuro, que deberá llegar junto con un control de consentimiento explícito.

No hay métricas públicas de uso en el sitio, porque no existen usuarios medidos.

## Eventos

| Evento | Cuándo | Propiedades permitidas |
|---|---|---|
| `destination_view` | Se abre la página de un lugar | `place_id`, `region`, `kind` |
| `destination_added` | Se añade un lugar a Mi Ruta desde una sugerencia | `place_id`, `source` |
| `destination_removed` | Se quita un lugar | `place_id` |
| `route_generated` | Se calcula una ruta | `stops`, `mode`, `provider`, `from_cache` |
| `route_optimized` | Se acepta o descarta el orden optimizado | `stops`, `applied`, `saved_min`, `saved_km` |
| `recommendation_seen` | Se muestra una lista de recomendaciones | `place_ids`, `surface`, `top_score` |
| `recommendation_added` | Se añade una recomendación | `place_id`, `surface`, `score`, `rank` |
| `alternative_seen` | Se muestran alternativas de redistribución | `anchor_id`, `place_ids` |
| `category_selected` | Se elige o quita un interés | `interest`, `selected` |
| `region_selected` | Se filtra por región | `region` |
| `event_viewed` | Se abre una fiesta o evento | `event_id`, `region` |
| `profile_updated` | Cambia tiempo, transporte o presupuesto | `interests` (conteo), `duration`, `mode`, `budget` |

Emitidos hoy por la interfaz: `category_selected`, `profile_updated`, `recommendation_seen`, `recommendation_added`,
`destination_added` (desde sugerencias), `alternative_seen` y `route_optimized`. Los demás están definidos y
validados, a la espera de instrumentar sus páginas.

## Saneamiento (`sanitizeEvent`)

1. Un nombre de evento que no está en el esquema se descarta.
2. Solo sobreviven las propiedades declaradas para ese evento, con su tipo: `id` y `enum` (cadena corta
   `[A-Za-z0-9:_-]`, hasta 64 caracteres), `ids` (lista de hasta 20), `int` (se redondea) y `bool`.
3. Cualquier clave que coincida con el patrón prohibido se rechaza aunque alguien la añada al esquema:
   `lat`, `lon`, `lng`, `coord`, `gps`, `geo`, `position`, `accuracy`, `altitude`, `heading`, `speed`, `email`, `mail`,
   `phone`, `tel`, `name`, `address`, `ip`, `user`, `device`, `session`, `token`, `uuid`, `fingerprint`.
4. La marca de tiempo se trunca al minuto.

Una prueba recorre el esquema completo y falla si alguna propiedad coincide con el patrón prohibido.

## Qué guarda el navegador

| Clave | Almacén | Contenido | Cómo se borra |
|---|---|---|---|
| `slp:perfil:v1` | `localStorage` | Intereses, tiempo, transporte, presupuesto | «Borrar mis preferencias» |
| `slp:analitica:v1` | `localStorage` | Hasta 300 eventos saneados | «Borrar el registro local» |
| `slp:mi-ruta:v1` | `localStorage` | Identificadores de los lugares guardados | «Vaciar Mi Ruta» |
| `slp:mi-ruta:trip:v1` | `localStorage` | Paradas visitadas del recorrido (solo ids) | «Restablecer recorrido» |
| `slp:perfil:origen:v1` | `sessionStorage` | Clave del municipio de partida elegido | Se borra al cerrar la pestaña o con «Borrar mis preferencias» |
| `slp:mi-ruta:prefs:v1` | `sessionStorage` | Modo de transporte y municipio de inicio de Mi Ruta | Al cerrar la pestaña |
| `slp:wx:*` | `sessionStorage` | Clima de los seis puntos de referencia, 15 min | Caduca solo |
| `slp:route-cache:*` | `sessionStorage` | Rutas calculadas sin la posición del visitante, 30 min | Caduca solo |

## Ubicación

- Se solicita **solo** al pulsar «Usar mi ubicación» o «Iniciar recorrido»; nunca al cargar la página.
- Vive en la memoria de la página (`location-service.ts`). No se escribe en ningún almacén, no entra en ningún evento y
  no se envía a analítica. Las rutas calculadas desde la posición del visitante tampoco se persisten.
- Sale del dispositivo únicamente como coordenada de origen en la solicitud al servicio de rutas, cuando el visitante
  pide una ruta desde su posición (igual que en la versión anterior del portal).
- Si el permiso se niega o la posición no está disponible, se ofrece elegir un municipio de partida.

## Datos que no se piden

Nombre, correo, teléfono, dirección, edad, religión, orientación política ni información médica. El perfil son cuatro
preferencias de viaje.

## Diseño para una recolección futura

- Consentimiento previo, granular y revocable; sin él, el comportamiento actual (solo local).
- Identificador de sesión aleatorio y de corta duración, generado en el cliente y nunca ligado a una persona.
- Agregación mínima (por ejemplo, celdas con al menos 10 sesiones) antes de mostrar cualquier indicador.
- Retención limitada y documentada; exportación y borrado a petición.
- El tablero nunca mostrará ubicaciones individuales: solo agregados por municipio o región.
