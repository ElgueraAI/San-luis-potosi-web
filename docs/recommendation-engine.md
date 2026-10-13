# Motor de recomendación explicable

Código: `src/lib/intel/scoring.ts` (puntaje), `src/lib/intel/context.ts` (contexto), `src/lib/intel/taxonomy.ts`
(intereses). Interfaz: `/descubre/` (`src/scripts/intel/discover.ts`) y Mi Ruta (`src/scripts/intel/route-recos.ts`).
Pruebas: `tests/intel/scoring.test.ts`. Para ver rankings reales: `node scripts/intel/preview.mjs`.

## Por qué reglas y no un modelo entrenado

El portal no tiene observaciones de visitantes (visitas, reservas, calificaciones). Sin esos datos, un modelo entrenado
solo podría aprender de etiquetas inventadas. Un puntaje por reglas con pesos documentados es defendible, reproducible y
explica cada resultado. La ruta hacia modelos estadísticos está en `smart-marketing-methodology.md` y depende de reunir
datos observados con consentimiento.

## Fórmula

```
base   = 100 × Σ wᵢ·vᵢ ÷ Σ wᵢ          (solo los factores i que tienen datos)
puntaje = mín(100, base + bono por evento + bono por diversificación)
```

Cada factor devuelve un valor `vᵢ` entre 0 y 1, o `null` si no hay datos. **Un factor sin datos sale del denominador**:
no suma ni resta. Así, no tener temporada oficial, que falle el clima o no dar un punto de partida nunca baja un lugar.

| Factor | Peso | Variables | Valor |
|---|---|---|---|
| Coincidencia con intereses | 0.36 | Intereses del perfil; intereses del lugar (declarados o derivados) | `0.75·cobertura + 0.25·enfoque`. Cobertura = coincidencias ÷ mín(intereses elegidos, 3). Enfoque = coincidencias ÷ intereses del lugar. Una coincidencia derivada del tipo de lugar vale 0.8. Sin intereses elegidos: sin datos |
| Distancia o desvío | 0.20 | Punto de partida, punto del lugar, tiempo y transporte; o desvío respecto a la ruta | Línea recta: 1 hasta medio alcance, baja linealmente a 0.05 en 1.5 alcances. Con ruta: 1 hasta +10 min, baja a 0.1 en +60 min |
| Temporada | 0.16 | Meses que recomienda la fuente oficial; mes del viaje | En temporada 1; fuera 0.3; aviso oficial de clima 0.6; sin declaración oficial: sin datos |
| Servicios de apoyo (proxy) | 0.10 | Índice de infraestructura del municipio | Solo en viajes con noche: `0.4 + 0.6·índice`; sin hospedaje registrado `0.6·índice` con advertencia |
| Clima actual | 0.09 | Open-Meteo en el punto de referencia; si el lugar es al aire libre | Al aire libre: seco 1, lluvia 0.4, tormenta 0.15. Bajo techo 0.9. Sin clima o tipo desconocido: sin datos |
| Calidad de la información | 0.09 | Nivel de evidencia del registro | Alta 1, media 0.7, baja 0.4 |

Los pesos suman 1. Los intereses pesan más porque son lo único que el visitante declara; la distancia es el segundo
límite real de un viaje; la temporada pesa cuando una fuente oficial la afirma; clima y evidencia ajustan sin dominar.
Son una decisión de diseño revisable (constante `WEIGHTS`), no un resultado estadístico.

### Bonos (solo suman)

Se aplican únicamente a lugares ya relevantes (`base ≥ 55`). **Primero relevancia, después diversificación.**

| Bono | Puntos | Condición |
|---|---|---|
| Evento del mes | Fecha confirmada 4 · patrón oficial 3 · última edición conocida 1.5 | Evento en el municipio del lugar durante el mes del viaje. Un evento sin fecha no cuenta |
| Región nueva | 3 | Hay lugares en Mi Ruta y ninguno está en la región del lugar |
| Municipio nuevo | 1.5 | Igual, por municipio (si no aplicó el de región) |
| Oferta poco expuesta | `3 × potencial de diversificación` | Municipio con exposición (proxy) < 0.4 y potencial ≥ 0.3 |

El bono por diversificación tiene un máximo de 6 puntos. Ningún lugar pierde puntos por ser conocido: la exposición
solo decide quién recibe un bono, nunca una penalización.

### Alcance cómodo (supuesto)

`alcance = (horas disponibles ÷ 3) × velocidad media`, con 5, 10, 20, 22 y 40 horas para medio día, 1 día, 2 días, fin
de semana y 3 a 5 días, y 60 km/h en auto, 14 km/h en bicicleta y 4.5 km/h a pie. Es un supuesto del proyecto, se
muestra como tal y se mide en línea recta. La distancia por carretera se calcula en Mi Ruta con el servicio de rutas.

### Lugares sin punto

Nunca entran en un cálculo de ruta. Para no dejarlos fuera del orden ni premiarlos, la distancia se mide a la cabecera
de su municipio (INEGI) y la tarjeta lo dice. Si tampoco hay municipio, la distancia toma un valor neutro (0.5),
también declarado.

## Qué devuelve cada recomendación

- **Puntaje** 0–100, `base` y bonos por separado.
- **Razones**: una frase por cada factor o bono que tuvo datos y aportó. No existe razón sin dato.
- **Advertencias**: fuera de temporada, aviso oficial de clima, lluvia actual en lugares al aire libre, lejanía, falta
  de hospedaje registrado, información limitada, lugar sin punto.
- **Nivel de evidencia** de la recomendación: el menor entre el del registro y la cobertura de factores
  (< 40 % del peso con datos: baja; < 60 %: media).
- **Cómo se calculó**: tabla con cada factor, su peso y su valor, incluidos los que no tuvieron datos, y las fuentes.

La lista aplica dos reglas que no alteran puntajes: máximo tres lugares por municipio y exclusión de lo que ya está en
Mi Ruta. Si el visitante eligió intereses, un lugar sin ninguna coincidencia no se sugiere.

## Motor de contexto

`buildContext()` reúne lo que se sabe del viaje en ese momento; todo es opcional:

| Entrada | Origen | Si falta |
|---|---|---|
| Mes, estación, hora | Reloj del dispositivo | — |
| Punto de partida | Ubicación con permiso explícito, o municipio elegido | La distancia queda sin datos |
| Clima actual | Open-Meteo, una solicitud para seis puntos de referencia, caché de 15 min | El clima queda sin datos y la interfaz lo dice |
| Eventos | Conjunto de eventos con su estado de fecha | Sin bono |
| Ruta guardada | Ids de Mi Ruta | Sin bonos de región o municipio |
| Desvíos | Geometría de la ruta calculada (`route-aware.ts`) | Se usa la línea recta al punto de partida |

`contextTags()` produce las etiquetas cortas de la tarjeta («Cerca de tu recorrido», «Buena opción para esta
temporada», «Evento durante tu viaje», «El clima actual puede afectarla», «Desvío considerable»), cada una ligada a un
factor con datos. `climateNote()` añade el clima mensual modelado como contexto, etiquetado como promedio y no como
pronóstico.

## Límites

- No hay afluencia, ocupación, precios, horarios ni tráfico: ningún factor los usa y ninguna frase los menciona.
- El presupuesto no altera el puntaje porque la base no tiene precios oficiales.
- 18 destinos publicados tienen punto aproximado (OSM) y lo indican; su distancia hereda esa imprecisión.
- Los intereses derivados (museos, áreas protegidas, catedrales) vienen del tipo oficial, no de una revisión del lugar.
- El clima corresponde a seis puntos de referencia, no a cada sitio; la interfaz no hace afirmaciones de seguridad.
- Los pesos son juicio de diseño. Calibrarlos exige datos observados de comportamiento, que hoy no existen.
