# Metodología de redistribución turística y optimización de viaje

Código: `src/lib/intel/features.ts` (indicadores municipales), `src/lib/intel/diversify.ts` (motor de redistribución),
`src/lib/intel/trip.ts` y `src/scripts/geo/route-optimizer.ts` (optimización). Pruebas: `tests/intel/diversify.test.ts`,
`tests/intel/data.test.ts`. Para verlo sobre los datos reales: `node scripts/intel/preview.mjs A01,H01,C01`.

## Problema y enfoque

La oferta turística registrada del estado está concentrada: pocos municipios reúnen la mayor parte de los atractivos
emblemáticos y del hospedaje, y 29 de los 59 no tienen ningún atractivo puntuable en la base
(`tourism-data-quality.md` § 4). El motor busca, para un lugar que al visitante ya le interesa, una **alternativa
relevante en un municipio menos expuesto y a un coste adicional pequeño**.

Tres decisiones lo definen:

1. **Primero relevancia, después diversificación.** Un candidato debe pasar todos los filtros antes de puntuarse. Un
   lugar no se recomienda por ser poco conocido.
2. **Nada de afluencia.** No existen datos de visitantes, ocupación ni saturación. Lo que se usa es un *proxy de
   exposición*, y se nombra así en cada tarjeta. Ninguna frase dice ni sugiere que un sitio esté saturado.
3. **Solo suma.** En el recomendador principal la diversificación es un bono de hasta 6 puntos para lugares ya
   relevantes (`recommendation-engine.md`). Un destino emblemático nunca pierde puntos por serlo.

## Indicadores municipales (derivados)

Todos se calculan en `municipalityFeatures()` a partir de conteos observados de `research/entities`.

### Índice de infraestructura

| | |
|---|---|
| Variables | Registros de hospedaje y de alimentos y bebidas del municipio (DENUE de INEGI + directorio Estadía) |
| Fórmula | `ln(1 + hospedaje + comida) ÷ ln(1 + máximo estatal de esa suma)` |
| Rango | 0 a 1 |
| Fuente | INEGI DENUE (archivo estatal, consultado 2026-10-06); Estadía, Secretaría de Turismo de SLP |
| Interpretación | Presencia relativa de servicios para comer y dormir. La escala logarítmica evita que la capital aplaste al resto |
| Limitaciones | El DENUE es un registro estadístico: no confirma operación actual, categoría, capacidad ni disponibilidad. Cuenta establecimientos, no cuartos |

### Proxy de exposición turística

| | |
|---|---|
| Variables | Registros de hospedaje; destinos con prioridad editorial A; presencia de un Pueblo Mágico |
| Fórmula | `0.5 · ln(1+hospedaje)/ln(1+máx) + 0.3 · mín(1, destinosA/3) + 0.2 · [tiene Pueblo Mágico]` |
| Rango | 0 a 1 |
| Fuente | INEGI DENUE y Estadía (hospedaje); libro de planeación del proyecto (prioridad A); SECTUR y Secretaría de Turismo (Pueblos Mágicos) |
| Interpretación | Qué tan visible es hoy el municipio para un visitante: oferta de alojamiento instalada, promoción editorial y distintivo federal. Los valores más altos corresponden a Catorce, Xilitla, San Luis Potosí y Aquismón |
| Limitaciones | **No mide visitantes, ocupación ni saturación.** La prioridad A es una decisión editorial del proyecto. El hospedaje refleja oferta, no demanda. Los pesos 0.5 / 0.3 / 0.2 son juicio de diseño |

### Potencial de diversificación

| | |
|---|---|
| Variables | Proxy de exposición; atractivos puntuables y eventos; índice de infraestructura |
| Fórmula | `(1 − exposición) × (0.6 · atractivo + 0.4 · infraestructura)`, con `atractivo = mín(1, ln(1 + atractivos + eventos/2) ÷ ln 9)`; vale 0 si no hay atractivos ni eventos |
| Rango | 0 a 1 |
| Interpretación | Municipios que tienen qué ofrecer y dónde atender al visitante, y que hoy están poco expuestos. Alimenta el bono «oferta poco expuesta» y el tablero |
| Limitaciones | Hereda las de sus insumos. Un valor alto no garantiza capacidad de carga ni calidad de la experiencia |

### Índice de cobertura

Fracción de seis tipos de registro presentes en el municipio (destinos; museos o recintos; eventos; hospedaje; comida;
áreas protegidas o arqueología). Rango 0 a 1. Mide **cobertura de la base de datos**, no del territorio: un valor bajo
puede significar que falta investigar, no que falte oferta.

### Concentración

Índice de Herfindahl–Hirschman (`Σ sᵢ²`, 0 a 1) y participación de los cinco primeros municipios, para atractivos
puntuables y para hospedaje registrado. Los valores vigentes se publican en `tourism-data-quality.md` y en el tablero.

## Diversification Opportunity Score (DOS)

Para un lugar de referencia `a` (una parada guardada o una de las primeras recomendaciones) y un candidato `c`:

### Filtros (todos obligatorios)

| Filtro | Regla | Motivo |
|---|---|---|
| Ubicable | `a` y `c` tienen punto | Sin punto no hay comparación geoespacial |
| Otro municipio | `municipio(c) ≠ municipio(a)` | Redistribuir es cambiar de municipio |
| Similitud | `similitud(a, c) ≥ 0.30` y al menos un interés en común | Relevancia |
| Perfil | Si el visitante eligió intereses, `c` comparte al menos uno | Relevancia |
| Menos expuesto | `exposición(a) − exposición(c) ≥ 0.10` | Si no, no es una alternativa de redistribución |
| Con servicios | `infraestructura(c) ≥ 0.15` | Hay dónde comer o dormir registrado |
| Información confiable | Evidencia de `c` alta o media | No se envía al visitante a un registro débil |
| Coste razonable | Con ruta: desvío ≤ 45 min. Sin ruta: ≤ 110 km en auto, 25 km en bicicleta, 6 km a pie, en línea recta desde `a` | No empeorar el viaje |

**Similitud** = índice de Jaccard sobre los rasgos de ambos lugares: sus intereses más su región. Compartir región
suma (dos pueblos mineros del Altiplano se parecen más que uno del Altiplano y uno de la Huasteca), pero sin un
interés en común la similitud es 0.

### Puntaje

```
DOS = 100 × Σ wᵢ·cᵢ ÷ Σ wᵢ      (componentes con datos)
```

| Componente | Peso | Valor (0 a 1) |
|---|---|---|
| Similitud de intereses | 0.30 | Jaccard descrito arriba |
| Coste adicional | 0.20 | `1 − desvío/45 min`, o `1 − km/alcance` sin ruta |
| Menor exposición (proxy) | 0.20 | `mín(1, (exposición(a) − exposición(c)) ÷ 0.5)` |
| Infraestructura | 0.10 | Índice de infraestructura del municipio de `c` |
| Variedad territorial | 0.10 | 1 si añade una región nueva al viaje; 0.6 si solo cambia de municipio |
| Temporada | 0.05 | 1 en temporada oficial; 0.3 fuera; sin declaración oficial: sin datos |
| Calidad de la información | 0.05 | Alta 1; media 0.7 |

Rango 0 a 100. Se interpreta como «qué tan buena oportunidad de diversificar es `c` para quien quiere ir a `a`»; no es
una medida de calidad del lugar. `diversifyTrip()` toma la mejor alternativa por lugar de referencia, empezando por
los municipios más expuestos, sin repetir lugar ni municipio.

### Qué ve el visitante

> Te interesa Real de Catorce. También puedes explorar Charcas, en Charcas: comparte Historia y la región Altiplano;
> queda a 67 km en línea recta de Real de Catorce.

Debajo, las razones (qué comparten, cuánto añade, la comparación de exposición con sus dos valores y la leyenda «no
mide afluencia», los servicios registrados con «no confirma disponibilidad») y la tabla de componentes.

## Optimizar mi viaje

- **Problema.** Camino hamiltoniano abierto de coste mínimo sobre las paradas guardadas: se visita cada una exactamente
  una vez y no se regresa al inicio. Si el visitante fijó un punto de partida, ese punto queda primero.
- **Costes.** Una sola matriz de tiempos por carretera del proveedor de rutas (una solicitud, en caché 30 min). Nunca
  distancia en línea recta.
- **Método.** Programación dinámica de Held–Karp, exacta, hasta 12 puntos (menos de un millón de pasos). Por encima:
  vecino más cercano desde cada inicio posible, mejorado con 2-opt y Or-opt hasta que ninguno mejora.
- **Garantías.** No se elimina ninguna parada; el orden propuesto nunca es peor que el original según la matriz; nada
  cambia hasta que el visitante pulsa «Aplicar orden optimizado».
- **Lo que se muestra.** Ruta original y ruta optimizada con distancia y tiempo, el cambio, y una frase con el ahorro
  (`savingsSentence`). El ahorro es la diferencia entre dos sumas de la matriz: estimación del proveedor, sin tráfico
  en tiempo real. Si el ahorro es menor a un minuto o al 1 %, se dice que no hay mejora apreciable.
- **Balance con la diversidad.** La optimización reordena, no selecciona: el conjunto de lugares (y por tanto su
  diversidad regional) es el mismo antes y después. La diversidad entra al elegir qué añadir («Cerca de tu recorrido»,
  «Alternativas para descubrir»), donde el coste es el desvío.

## Lugares cerca del recorrido

`corridorCandidates()` mide la distancia de cada lugar a la **geometría de la ruta calculada** (no al origen), con el
mismo ajuste a la línea que usa la navegación en vivo. El corredor tiene 12 km de semiancho en auto, 3.5 km en
bicicleta y 1.2 km a pie: la distancia a la que el desvío estimado llega a 45 minutos.

`desvío estimado (min) = 2 × distancia a la ruta × 1.4 ÷ velocidad × 60`, con 45 km/h en auto, 13 km/h en bicicleta y
4.5 km/h a pie, y 1.4 como factor de sinuosidad. Es una **estimación** y la interfaz lo dice. «Medir desvíos por
carretera» sustituye las estimaciones por valores del proveedor con **una** solicitud de matriz
(`[salidas…, lugares…]`), solo cuando el visitante lo pide. Renderizar la lista no consulta al proveedor.

## Limitaciones

- Sin datos de demanda, el efecto real sobre la distribución de visitantes no puede medirse; el tablero lo presenta
  como escenario simulado, etiquetado.
- Los pesos y umbrales son decisiones de diseño documentadas, no parámetros estimados.
- La similitud usa etiquetas editoriales e intereses derivados del tipo oficial; no conoce la experiencia real.
- El proxy de exposición puede subestimar municipios con mucha visita de un día y poco hospedaje.
- El desvío estimado supone caminos transitables hasta el lugar; en la sierra puede ser mayor.
