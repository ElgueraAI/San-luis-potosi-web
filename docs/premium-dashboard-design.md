# Diseño del tablero premium de inteligencia turística

Checkpoint L. Páginas: `/inteligencia-turistica/` (reescrita en seis capítulos) y `/descubre/` (tarjetas editoriales).
Ninguna fórmula, peso ni resultado del escenario cambió: `src/lib/intel/` no se tocó.

## Dirección

Revista editorial sobre una plataforma de datos. Se conserva la identidad del portal (Cormorant Garamond para títulos y
cifras, Manrope para texto, radios casi cuadrados, filetes finos) y se añade contraste entre capítulos: la página ya no
es una sucesión de fondos marfil.

| Capítulo | Fondo | Clase de dato |
|---|---|---|
| A. Inteligencia para descubrir mejor | Fotografía con degradado oscuro | — |
| Problema, pregunta, solución | Papel | — |
| B. Radiografía turística del estado | Carbón `#1e2624` | Observado |
| C. Mapa de oportunidades | Verde petróleo `#142f33` | Observado y derivado, por capa |
| D. Calendario y estacionalidad | Editorial claro `#f5f2eb` | Observado |
| E. Diversificación inteligente | Verde bosque `#0f2a25` | Derivado |
| F. Escenario académico | Marfil, marco punteado | Simulado |
| Arquitectura / Límites | Carbón / editorial | — |

Tokens nuevos en `src/styles/tokens.css`: tonos `forest`, `teal`, `carbon`, `editorial` y la paleta de gráficas
`--viz-*`. Solo son adiciones.

**Fotografía del inicio:** panorámica de Cerro de San Pedro (`wc-50604767`, Sixto Emmanuel Picones, CC BY-SA 4.0,
Wikimedia Commons), que ya estaba en el conjunto de medios del portal. El crédito se imprime sobre la imagen y sigue en
Créditos. No se descargó ninguna imagen nueva.

## Reglas de color de las gráficas

1. **Los acentos regionales de la marca no se usan como serie.** Fallan la prueba de separación para daltonismo
   (ΔE 3.9 entre Centro y Zona Media). Las gráficas usan cuatro tonos propios, comprobados con el validador de paletas
   (banda de luminosidad, croma mínimo, ΔE ≥ 8 con deuteranopía y protanopía, ΔE ≥ 15 con visión normal, contraste 3:1)
   sobre cada fondo donde aparecen:

   | Región | Fondo claro | Fondo oscuro |
   |---|---|---|
   | Altiplano | `#b8620a` | `#c2751c` |
   | Centro | `#a8377a` | `#c2609e` |
   | Zona Media | `#1f6fb2` | `#3b93d1` |
   | Huasteca | `#2f7d32` | `#4e9f3d` |

2. Una región siempre se nombra en texto (leyenda o etiqueta directa); el color nunca es la única clave.
3. Las magnitudes usan una rampa de un solo tono con cinco clases (`ramp()` en `src/lib/charts/geometry.ts`); el
   valor siempre está escrito en la celda.
4. Los textos usan los colores de texto, no el de la serie. Dentro del mapa de árbol el texto es tinta oscura sobre
   los cuatro tonos (contraste ≥ 5.5:1).
5. El escenario simulado no usa color de región: barras en tinta, marco punteado y etiqueta fija.

## Gráficas

Once formas distintas; cada una responde una pregunta y lleva unidad, fuente, corte y alternativa tabular o textual.

| Capítulo | Pregunta | Forma | Alternativa |
|---|---|---|---|
| B | ¿Qué tipo de atractivos hay en cada región? | Matriz de calor con cifras | Es una tabla |
| B | ¿Cuántos municipios quedan cortos de información? | Gráfica de unidades (un cuadro por municipio) | Tabla adjunta |
| B | ¿Dónde está el hospedaje registrado? | Mapa de árbol por región y municipio | «Ver como tabla» |
| B | ¿Qué experiencias sostiene la base? | Columnas apiladas (declarado / derivado, con trama) | «Ver como tabla» |
| B | ¿Qué municipios están mejor documentados? | Matriz de puntos de presencia | Es una tabla; cada punto tiene texto «sí / no» |
| C | Cinco capas del territorio | Símbolos proporcionales en MapLibre | Lista de municipios y panel |
| D | ¿Cuántos eventos hay por región y mes? | Rejilla de calor interactiva | Es una tabla de botones |
| D | ¿Cuándo llueve en cada región? | Pequeños múltiplos de área | «Ver como tabla» |
| E | ¿Qué municipios tienen servicios pero poca exposición? | Dispersión con tamaño | «Ver como tabla» |
| E | ¿Dónde hay más potencial de diversificación? | Paleta (lollipop) ordenada | Cifra en cada fila |
| E | Antes y después | Tarjetas con barra de componentes | Texto de cada componente |
| F | Proporción de sugerencias por configuración | Barras comparativas | Tabla compacta |
| F | Variación frente a «solo relevancia» | Barras divergentes en puntos porcentuales | Cifra en cada fila |

**Librería:** ninguna. SVG y HTML generados en la compilación (`src/lib/charts/geometry.ts`, con pruebas en
`tests/intel/charts.test.ts`) y una capa de interacción (`src/scripts/intel/dashboard.ts`). La comparación con D3,
Observable Plot y Chart.js está en `premium-intelligence-plan.md` § 6. Las gráficas se ven completas sin JavaScript.

### Reglas de conteo y de lectura

- **Calendario.** Un evento cuenta una vez en cada mes que abarca; por eso la suma de los meses (173) es mayor que el
  número de eventos con mes conocido (125). Los eventos de todo el año y los que no tienen mes confirmado se listan
  aparte y no entran en la rejilla. El mes seleccionado al abrir es el mes actual del dispositivo.
- **Mapa de árbol.** Área proporcional a los registros de hospedaje. Los municipios con menos de 1.2 % del total se
  agrupan en «Otros» dentro de su región. Los registros con una clave municipal ausente del catálogo 2020 no se dibujan
  y el pie lo dice.
- **Mapa.** El área del círculo, no el radio, sigue el valor. Valor cero se dibuja como anillo vacío con la leyenda
  «sin registro en la base». La base no tiene polígonos municipales verificados: no se dibujan fronteras.
- **Paleta de potencial.** La línea completa equivale a 1; no se reescala al máximo.
- **Casos.** Salida real de `alternativesFor()` para Real de Catorce, Cascada de Tamul y el Centro Histórico de la
  capital, con el mes de la compilación y viaje en auto. Si ningún candidato pasa los filtros, se dice.
- **Escenario.** Los resultados salen de `runScenario()` sin modificación. El eje de variación muestra ±20 puntos
  porcentuales.

## Interacción y movimiento

- Índice de capítulos fijo bajo el encabezado, con el capítulo actual marcado.
- Un solo globo de datos para toda la página: aparece con el puntero, con el foco del teclado y al tocar; `Escape` lo
  cierra.
- Calendario: mes (cabecera), celda (mes y región), filtro de región y comparación entre dos meses.
- Casos: pestañas con flechas izquierda y derecha.
- Escenario: tres configuraciones; cambian la cifra principal, la barra resaltada y la variación.
- Mapa: cinco capas; selección por clic o por la lista «Municipio»; gestos cooperativos para no secuestrar el
  desplazamiento de la página.
- Movimiento: entrada del inicio, barras que crecen al entrar en pantalla, transición de radio y color al cambiar de
  capa. Con `prefers-reduced-motion` no hay animación (el portal fija `data-motion="static"` antes de pintar).
- MapLibre se carga solo cuando el capítulo C se acerca (900 px). Si las teselas no cargan, el mapa usa un fondo
  liso y la lista y el panel siguen funcionando.

## `/descubre/`

La lógica del recomendador no cambió. Cambió la presentación:

- La primera sugerencia abre la lista con imagen grande; las siguientes alternan imagen y texto.
- El puntaje se presenta primero como palabra y después como cifra marcada «puntaje orientativo»:
  85 o más «Muy afín a tu viaje», 70 a 84 «Afín a tu viaje», 55 a 69 «Puede interesarte», menos de 55 «Afinidad baja».
  Las bandas son solo de presentación (`AFFINITY_BANDS` en `src/scripts/intel/cards.ts`); no alimentan ningún cálculo.
- «Por qué te recomendamos este lugar» en un bloque destacado.
- Indicador de temporada en cada tarjeta: en temporada, fuera de temporada, aviso oficial de clima o «sin temporada
  oficial declarada».
- Evidencia media o baja se explica en una línea, además de la etiqueta.
- Un lugar sin fotografía verificada lo dice en su marcador; no se le asigna la foto de otro lugar.
- Contador de intereses elegidos y «Quitar todos».

## Responsividad

Comprobado en 360 × 800, 390 × 844, 768 × 1024, 1440 × 900 y 1920 × 1080 con `scripts/verify/premium-shots.mjs`
(capturas por capítulo, desbordes, errores de consola, áreas táctiles). En teléfono las tablas anchas, la dispersión y
las columnas quedan en paneles desplazables con nombre accesible y foco; el mapa de árbol cambia de proporción y
oculta nombres en celdas medianas; el índice de capítulos se desplaza en horizontal.

## Lo que no se hizo

- No hay polígonos municipales. Se usarían los del Marco Geoestadístico de INEGI tras verificar licencia y versión.
- La comparación antes/después es por descripción y por las capturas nuevas; no se generó una lámina lado a lado.
- Las páginas siguen solo en español.
