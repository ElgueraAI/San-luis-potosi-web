# Segmentación y mercadotecnia inteligente

Código: `src/lib/intel/segments.ts` (segmentos y fila de variables), `src/lib/intel/marketing.ts` (evidencia y matriz de
campañas). Interfaz: `/inteligencia-turistica/segmentos/`. Pruebas: `tests/intel/segments.test.ts`.

## Principio

No se entrenó ningún modelo. El portal no tiene observaciones de visitantes reales, y un K-Means entrenado con
sesiones ficticias describiría la ficción. Esta etapa entrega la **base**: segmentos interpretables por regla, la fila
numérica que usaría un modelo y el esquema de eventos que la alimentaría. El entrenamiento espera a los datos.

## Segmentos interpretables

Ocho segmentos, nombrados a partir de la taxonomía real de intereses de la base:

| Segmento | Interés que lo define | Intereses de apoyo (peso) |
|---|---|---|
| Explorador natural | Naturaleza | Cascadas y agua 0.8 · Fotografía 0.5 · Relajación 0.3 |
| Aventurero | Aventura | Cascadas y agua 0.6 · Naturaleza 0.5 |
| Viajero cultural | Cultura | Arte 0.8 · Historia 0.5 |
| Explorador patrimonial | Historia | Arqueología 0.9 · Cultura 0.4 · Pueblos Mágicos 0.3 |
| Viajero gastronómico | Gastronomía | Cultura 0.3 · Pueblos Mágicos 0.3 |
| Explorador de pueblos | Pueblos Mágicos | Historia 0.4 · Gastronomía 0.4 · Fotografía 0.4 · Cultura 0.3 |
| Viajero familiar | Familia | Relajación 0.6 · Cascadas y agua 0.4 · Cultura 0.2 |
| Escapada de fin de semana | Duración: fin de semana (1) o 2 días (0.8) | Relajación 0.5 · Gastronomía 0.3 · Pueblos Mágicos 0.3 |

### Señal de interés de una sesión

Por cada interés, de 0 a 1:

```
señal = mín(1, 1·[declarado] + 0.6·guardado + 0.4·comportamiento)
```

- **Declarado**: lo eligió en `/descubre/`.
- **Guardado**: frecuencia del interés entre los lugares de Mi Ruta, normalizada por el interés más frecuente.
- **Comportamiento**: señales del registro local (`interestSignals`): interés elegido 1, lugar añadido 2, lugar visto
  0.5; normalizadas igual.

Lo declarado pesa más que lo inferido: una preferencia expresada es mejor evidencia que una coincidencia de etiquetas.

### Afinidad y asignación

```
afinidad(segmento) = 0.6 · señal(interés que lo define) + 0.4 · media ponderada de la señal en sus intereses de apoyo
```

Para la escapada de fin de semana, el 0.6 corresponde a la duración del viaje. La sesión se asigna al segmento de
mayor afinidad si alcanza **0.25**; por debajo, la interfaz dice «Perfil aún sin definir». Un segmento definido por
duración solo compite si la duración coincide. Rango: 0 a 1 (se muestra de 0 a 100).

Limitaciones: los pesos son juicio de diseño; los segmentos no son mutuamente excluyentes (se muestra el ranking
completo); no hay validación externa porque no hay datos contra los cuales validar.

## La fila de variables (esquema analítico futuro)

`sessionFeatures()` produce una fila por sesión, solo números, sin identificador ni ubicación. Es exportable hoy (junto
con el registro local) para ejercitar el esquema.

| Grupo | Columnas |
|---|---|
| Intereses (12) | `interest_<interés>`: señal de 0 a 1 |
| Viaje | `duration_ordinal` (0–3), `mode_car`, `mode_bike`, `mode_foot`, `budget_ordinal` (0–2) |
| Ruta guardada | `stops`, `regions`, `municipalities`, `share_flagship` (proporción de destinos prioridad A), `share_low_exposure` (proporción en municipios con exposición < 0.4) |
| Respuesta al recomendador | `recommendations_seen`, `recommendations_added`, `add_rate`, `optimized` |
| Contexto | `month` |

## Ruta hacia modelos

| Etapa | Requisito mínimo de datos | Técnica | Para qué |
|---|---|---|---|
| 0. Hoy | Ninguno | Reglas | Segmentos explicables desde el primer día |
| 1. Línea base | ≥ 300 sesiones observadas con consentimiento, ≥ 2 meses | K-Means sobre variables estandarizadas; k por silueta y codo | Comprobar si los ocho segmentos aparecen en los datos |
| 2. Estructura | ≥ 1,000 sesiones | Agrupamiento jerárquico (Ward) | Ver cómo se anidan los segmentos; fusionar o dividir |
| 3. Atípicos | ≥ 1,000 sesiones | DBSCAN | Viajes fuera de patrón (rutas muy largas, un solo interés extremo) |
| 4. Tiempo | ≥ 6 meses | Cohortes por mes de visita y ciudad emisora | Estacionalidad y efecto de campañas |
| 5. Recomendación | Interacciones por lugar suficientes | Aprender pesos (regresión logística sobre «añadido / visto») | Sustituir pesos de diseño por pesos estimados |

Los umbrales son reglas prácticas de arranque, no garantías estadísticas. Criterios de aceptación de un modelo:
estabilidad de los grupos entre periodos, interpretabilidad (cada grupo se describe con sus variables) y utilidad
(cambia alguna recomendación o campaña). Hasta cumplirlos, las reglas siguen vigentes.

Requisitos previos, hoy inexistentes: aviso y consentimiento explícito, un recolector propio (el arreglo `adapters`
de `src/scripts/intel/analytics.ts` es el único punto de extensión), política de retención y agregación mínima antes de
publicar cualquier resultado.

## Matriz de campañas

Estructura: **segmento × región × temporada × interés × mensaje × canal × llamada a la acción**.

| Columna | Clase | Origen |
|---|---|---|
| Segmento, interés | Definición | `segments.ts` |
| Región | Propuesta contrastada | La región elegida debe tener oferta afín en la base (`campaignSupport > 0`; lo verifica una prueba) |
| Oferta en la base | **Dato observado** | Lugares candidatos afines al segmento en esa región |
| Temporada | Propuesta apoyada en datos | Temporada oficial (folletos) y calendario de eventos cuando existen; en otro caso, juicio editorial |
| Mensaje, canal, llamada a la acción | **Propuesta estratégica** | Redacción del proyecto |

Un lugar pertenece a la oferta de un segmento si tiene el interés que lo define, o dos de los de apoyo
(`matchesSegment`). Para cada segmento se calculan además los **municipios por impulsar**: exposición menor a 0.40,
infraestructura mayor o igual a 0.15 y lugares afines, ordenados por `lugares × potencial de diversificación`. Es el
puente entre mercadotecnia y redistribución: a quién hablarle de qué municipio.

### Reglas de redacción

- Toda fila lleva la etiqueta «Propuesta estratégica».
- Ninguna cifra de alcance, conversión, retorno ni resultado: ninguna campaña se ha ejecutado. Una prueba rechaza
  porcentajes y términos de desempeño en los mensajes.
- Ningún mensaje afirma afluencia («sin gente», «saturado») ni hechos que la base no sostenga.
- Las llamadas a la acción apuntan a funciones reales del portal.

### Cómo se evaluaría

Con el esquema de eventos más un parámetro de campaña en la URL (sin identificador personal): rutas generadas,
recomendaciones añadidas y municipios distintos por sesión, comparados entre campañas. Es trabajo futuro y depende de
la recolección con consentimiento.
