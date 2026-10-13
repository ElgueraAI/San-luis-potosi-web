# Calidad y cobertura de los datos turísticos

Generado por `npm run intel:report` (`scripts/intel/report.mjs`) el 2026-10-13 a partir de `research/entities`
mediante `src/lib/intel`. No se edita a mano: se cambian los datos o los controles y se vuelve a ejecutar.

Documentos relacionados: `tourism-data-dictionary.md` (campos), `tourism-data-provenance.md` (fuentes),
`tourism-intelligence-limitations.md` (lo que estas cifras no dicen).

## 1. Registros por conjunto (datos observados)

| Conjunto | Registros | Con punto | Fuente oficial | Con imagen con licencia | Con descripción | Con municipio |
|---|---|---|---|---|---|---|
| Destinos y atractivos | 85 | 84 % | 89 % | 48 % | 64 % | 95 % |
| Arqueología | 3 | 67 % | 67 % | 0 % | 100 % | 67 % |
| Museos | 44 | 100 % | 100 % | 0 % | 0 % | 100 % |
| Recintos culturales | 183 | 100 % | 100 % | 0 % | 0 % | 100 % |
| Eventos | 152 | 97 % | 99 % | 0 % | 1 % | 97 % |
| Hospedaje | 709 | 95 % | 100 % | 0 % | 5 % | 100 % |
| Gastronomía y bebidas | 3,433 | 99 % | 100 % | 0 % | 1 % | 100 % |
| Recreación | 27 | 100 % | 100 % | 0 % | 0 % | 100 % |
| Servicios | 261 | 100 % | 100 % | 0 % | 0 % | 100 % |
| Movilidad | 5 | 100 % | 100 % | 0 % | 0 % | 100 % |
| Municipios | 59 | 98 % | 98 % | 0 % | 0 % | 98 % |

«Fuente oficial» = el registro tiene un id de fuente y su estado es verificado, listado (datos abiertos del SIC),
directorio oficial (Estadía) o registro (DENUE de INEGI). Una fila del DENUE es oficial como asiento de un registro;
no confirma que el negocio opere hoy. Museos, recintos, hospedaje y gastronomía no llevan fotografía por diseño
(`docs/media-coverage.md`).

## 2. Candidatos del recomendador (normalizados)

165 lugares pueden sugerirse: Destino 63 · Área natural protegida 14 · Catedral 4 · Zona arqueológica 3 · Museo 44 · Galería 19 · Casa de artesanía 12 · Balneario 6.
El sitio publica un subconjunto: solo los destinos con página (descripción verificada).

- Confianza del punto: verified 28 · approximate 116 · unknown 15 · official 6. Un lugar sin punto nunca entra en un cálculo de distancia o de ruta.
- Nivel de evidencia: alta 46 · media 10 · baja 109.
- Temporada declarada por una fuente oficial: 8 de 165. El resto no tiene evidencia de temporada y no se penaliza.
- Eventos con al menos un mes: 126 de 146 (fecha confirmada 11 · patrón oficial 82 · edición anterior 32 · sin fecha 21).

### Intereses por región

| Interés | Altiplano | Centro | Zona Media | Huasteca | Total | De ellos, derivados por regla |
|---|---|---|---|---|---|---|
| Naturaleza | 7 | 6 | 7 | 15 | 36 | 15 |
| Cascadas y agua | 3 | 1 | 4 | 11 | 19 | 5 |
| Aventura | 5 | 3 | 4 | 10 | 22 | 0 |
| Cultura | 19 | 39 | 10 | 18 | 87 | 65 |
| Historia | 16 | 15 | 10 | 10 | 51 | 19 |
| Arqueología | 0 | 1 | 1 | 8 | 10 | 8 |
| Gastronomía | 4 | 3 | 3 | 2 | 12 | 0 |
| Pueblos Mágicos | 1 | 2 | 1 | 2 | 6 | 0 |
| Arte | 10 | 38 | 7 | 9 | 64 | 38 |
| Fotografía | 4 | 0 | 1 | 0 | 6 | 0 |
| Relajación | 3 | 2 | 2 | 2 | 9 | 5 |
| Familia | 4 | 2 | 2 | 2 | 10 | 8 |

Huecos de categoría (interés sin ningún candidato en una región): Arqueología en Altiplano; Fotografía en Centro; Fotografía en Huasteca.

## 3. Controles de calidad

| Control | Severidad | Hallazgos |
|---|---|---|
| `placeholder` | warning | 141 |
| `unknown-municipality` | error | 132 |
| `duplicate-name` | warning | 103 |
| `no-coordinates` | warning | 15 |
| `no-municipality` | info | 14 |
| `no-source` | warning | 9 |
| `near-duplicate-name` | info | 6 |
| `missing-name` | error | 3 |

Controles sin hallazgos: `duplicate-id`, `impossible-coordinates`, `outside-slp`, `region-mismatch`, `contradictory-dates`, `date-month-mismatch`, `impossible-month`, `malformed-url`.

Lectura de los hallazgos principales:

- `unknown-municipality`: filas del DENUE asignadas a la clave 24059 (Villa de Pozos, municipio creado en 2024). El catálogo
  municipal del proyecto viene del Censo 2020 y aún no tiene esa clave, así que la discrepancia se reporta y no se corrige en silencio.
- `placeholder`: establecimientos que el DENUE registra literalmente como «sin nombre». No se muestran como recomendación.
- `duplicate-name`: sucursales o registros homónimos en el mismo municipio dentro de los registros DENUE y SIC.
- `no-coordinates`: destinos sin punto aceptable; quedan fuera de todo cálculo geoespacial (no se les inventa uno).

La revisión de enlaces es solo sintáctica (`malformed-url`). Este script no consulta las URL externas, para respetar los
límites de las fuentes; los enlaces internos se verifican con `scripts/verify/links.mjs` sobre el sitio compilado.

### Errores (primeros 12 de 135)

| Control | Conjunto | Id | Detalle |
|---|---|---|---|
| `missing-name` | Hospedaje | denue-12288934 | registro sin nombre |
| `unknown-municipality` | Hospedaje | denue-11412912 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-6392991 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-6710324 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-6392740 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-6810964 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-6507850 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-7374987 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-8019523 | municipio 24059 no existe en el catálogo INEGI |
| `unknown-municipality` | Hospedaje | denue-11401736 | municipio 24059 no existe en el catálogo INEGI |
| `missing-name` | Gastronomía y bebidas | denue-12289596 | registro sin nombre |
| `unknown-municipality` | Gastronomía y bebidas | denue-9810133 | municipio 24059 no existe en el catálogo INEGI |

### Advertencias y notas (primeras 30 fuera de los registros masivos)

| Control | Conjunto | Id | Detalle |
|---|---|---|---|
| `no-coordinates` | Destinos y atractivos | A03 | sin punto (unavailable) |
| `no-source` | Destinos y atractivos | A03 | registro sin fuente |
| `no-source` | Destinos y atractivos | A05 | registro sin fuente |
| `no-coordinates` | Destinos y atractivos | A09 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | A15 | sin punto (unavailable) |
| `no-source` | Destinos y atractivos | A15 | registro sin fuente |
| `no-source` | Destinos y atractivos | C02 | registro sin fuente |
| `no-source` | Destinos y atractivos | C04 | registro sin fuente |
| `no-source` | Destinos y atractivos | C06 | registro sin fuente |
| `no-coordinates` | Destinos y atractivos | C12 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | C14 | sin punto (unavailable) |
| `no-source` | Destinos y atractivos | C14 | registro sin fuente |
| `no-coordinates` | Destinos y atractivos | H02 | sin punto (unavailable) |
| `no-source` | Destinos y atractivos | H03 | registro sin fuente |
| `no-coordinates` | Destinos y atractivos | H09 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | H18 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | M05 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | M06 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | M08 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | M10 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | M14 | sin punto (unavailable) |
| `no-coordinates` | Destinos y atractivos | M15 | sin punto (unavailable) |
| `no-source` | Destinos y atractivos | M15 | registro sin fuente |
| `no-coordinates` | Arqueología | arq-tanute | sin punto (unknown) |
| `duplicate-name` | Museos | sic-museo-2503 | 2 registros «Museo de Sitio de la Universidad Autónoma de San Luis Potosí» en el mismo municipio: sic-museo-2503, sic-museo-2170 |
| `duplicate-name` | Recintos culturales | sic-auditorio-750 | 2 registros «Auditorio Rafael Nieto» en el mismo municipio: sic-auditorio-750, sic-auditorio-1671 |
| `near-duplicate-name` | Recintos culturales | sic-galeria-400 | «Galería IV» ≈ «Galería I» (sic-galeria-495) |
| `near-duplicate-name` | Recintos culturales | sic-galeria-400 | «Galería IV» ≈ «Galería II» (sic-galeria-497) |
| `near-duplicate-name` | Recintos culturales | sic-galeria-400 | «Galería IV» ≈ «Galería III» (sic-galeria-493) |
| `near-duplicate-name` | Recintos culturales | sic-galeria-495 | «Galería I» ≈ «Galería II» (sic-galeria-497) |

## 4. Cobertura territorial

- Municipios: 59; con al menos un atractivo puntuable (destino, museo, zona arqueológica, área protegida): 30.
- Concentración de atractivos puntuables (Herfindahl–Hirschman, 0–1): 0.105; los 5 municipios con más atractivos reúnen el 51 %.
- Concentración del hospedaje registrado: 0.09; los 5 municipios con más registros reúnen el 57 %.

Municipios sin atractivo puntuable (29): Alaquines, Armadillo de los Infante, Axtla de Terrazas, Cárdenas, Cedral, Coxcatlán, Ebano, Lagunillas, Matlapa, Moctezuma, San Antonio, San Ciro de Acosta, San Martín Chalchicuautla, San Nicolás Tolentino, Santo Domingo, Soledad de Graciano Sánchez, Tamazunchale, Tampacán, Tampamolón Corona, Tanlajás, Tanquián de Escobedo, Vanegas, Villa de Arista, Villa de Arriaga, Villa de Guadalupe, Villa de Pozos, Villa de Ramos, Villa Hidalgo, Villa Juárez.

### Mayor potencial de diversificación (indicador derivado; ver `tourism-redistribution-methodology.md`)

| Municipio | Región | Atractivos | Eventos | Hospedaje | Comida | Índice de infraestructura | Exposición (proxy) | Potencial de diversificación |
|---|---|---|---|---|---|---|---|---|
| Ciudad Fernández | Zona Media | 6 | 3 | 11 | 40 | 0.56 | 0.35 | 0.53 |
| Salinas | Altiplano | 3 | 2 | 6 | 24 | 0.49 | 0.19 | 0.51 |
| Guadalcázar | Altiplano | 5 | 1 | 3 | 0 | 0.20 | 0.14 | 0.51 |
| Charcas | Altiplano | 4 | 3 | 12 | 17 | 0.48 | 0.35 | 0.45 |
| Matehuala | Altiplano | 3 | 5 | 34 | 70 | 0.66 | 0.45 | 0.42 |
| Huehuetlán | Huasteca | 2 | 2 | 3 | 3 | 0.28 | 0.14 | 0.42 |
| Tamuín | Huasteca | 3 | 2 | 11 | 22 | 0.50 | 0.35 | 0.42 |
| Ciudad Valles | Huasteca | 5 | 3 | 80 | 222 | 0.81 | 0.54 | 0.41 |
| Cerritos | Zona Media | 1 | 2 | 7 | 30 | 0.52 | 0.21 | 0.40 |
| Ahualulco | Centro | 1 | 1 | 0 | 13 | 0.38 | 0.00 | 0.40 |
| San Vicente Tancuayalab | Huasteca | 1 | 2 | 3 | 14 | 0.41 | 0.14 | 0.40 |
| Ciudad del Maíz | Zona Media | 5 | 7 | 6 | 19 | 0.46 | 0.49 | 0.40 |
| Villa de Reyes | Centro | 1 | 2 | 7 | 26 | 0.50 | 0.21 | 0.40 |
| Mexquitic de Carmona | Centro | 1 | 2 | 1 | 7 | 0.31 | 0.07 | 0.40 |
| Soledad de Graciano Sánchez | Centro | 0 | 3 | 12 | 130 | 0.70 | 0.26 | 0.40 |

Los tres índices son derivados por este proyecto a partir de conteos observados. No son visitantes, ocupación ni
saturación, y cambian cuando cambian los registros de origen.
