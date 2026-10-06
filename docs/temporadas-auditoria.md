# Temporadas · auditoría de los 12 meses

Fuente de verdad visual del módulo «Qué hacer ahora». La tabla `STORY` de `src/data/seasons.ts` implementa esta auditoría; si cambia una, cambia la otra.

**Método.** Para cada mes revisé los registros de `research/generated/seasonal-calendar.json`, `events.json`, `climate-monthly.json` y `brochure-tables.json`, los destinos de `research/destinations/`, `research/source-registry/sources.json` y `research/pdf-registry/resources.json`. Busqué además en las páginas oficiales ya guardadas en `research/raw/pages/` y `research/raw/text/`.

**Criterio para elegir el tema principal**, en orden:
1. Especificidad del mes: un evento de un solo mes pesa más que una temporada de cinco meses, y esta más que una recomendación de todo el año.
2. Evidencia oficial.
3. Riqueza turística y cultural.
4. Fuerza visual.

La imagen se buscó **después** de elegir el tema.

Solo en diciembre amplié la investigación fuera de la capa existente, únicamente con fuentes oficiales. El resultado está en `research/generated/seasonal-additions-pass4.json`, un archivo aditivo: no modifica ningún archivo existente.

**Confianza:**
- **VERIFIED:** la fuente oficial ata el tema a ese mes.
- **PARTIAL:** el tema es oficial, pero el mes no es exclusivo o la fecha es móvil.
- **NEEDS_RESEARCH:** no hay fuente suficiente.

## Matriz

| Mes | Tema principal | Lugar / evento | Región | Municipio / localidad | Punto en el mapa | Fuente | Confianza | Imagen |
|---|---|---|---|---|---|---|---|---|
| Enero | Temporada de la Cascada de Tamul (nov–mar) | Cascada de Tamul, en panga o kayak por el Tampaón | Huasteca | Aquismón | H01 (aproximado, OSM) | Folleto oficial Huasteca (`brochure-huasteca`) | VERIFIED (temporada) | `px-11775031` Pangas al pie de Tamul |
| Febrero | Temporada de las cascadas de El Naranjo (nov–mar) | Minas Viejas, El Meco, El Salto | Huasteca | El Naranjo | H13, H14, H15 (aproximados) | Folleto oficial Huasteca | VERIFIED (temporada) | `wc-98007105` Minas Viejas |
| Marzo | Semana Santa indígena xi'iui | Barrio de San José; escenificación de la crucifixión | Zona Media | Ciudad del Maíz | M09 (verificado) | Folleto oficial Zona Media (`brochure-media`) | PARTIAL (fecha móvil: marzo o abril) | `wc-72476536` Iglesia del pueblo, Cd. del Maíz |
| Abril | Procesión del Silencio (Viernes Santo) | Inicia y termina en la Plaza del Carmen | Centro | San Luis Potosí | C03 (aproximado) | Secretaría de Cultura SLP (`cultura-slp-procesion-2026`; 3 abr 2026) | VERIFIED | `wc-21525467` Plaza del Carmen |
| Mayo | Media Luna, segura todo el año para nadar y bucear | Manantial de la Media Luna | Zona Media | Rioverde | M01 (aproximado) | Folleto oficial Zona Media | PARTIAL (todo el año; no hay evento oficial de mayo) | `wc-76389273` Laguna de la Media Luna |
| Junio | Fiesta patronal de San Juan Bautista y feria regional (24 jun) | Charrería, feria, carreras, exposición ganadera | Zona Media | Cerritos | MUN-CERRITOS (verificado, INEGI ITER 2020) | Folleto oficial Zona Media | VERIFIED | `wc-43676810` Parroquia de San Juan Bautista, Cerritos (nueva) |
| Julio | Festival Internacional de Danza Contemporánea Lila López | Capital y 5 municipios (24 jul – 2 ago 2026) | Centro | San Luis Potosí y otros | C01 (verificado) | Secretaría de Cultura federal (`cultura-gob-lila-lopez-2026`) | VERIFIED | `wc-41833060` Teatro de la Paz (interior) |
| Agosto | Feria Nacional Potosina (FENAPO) | 7–30 ago 2026; además, fiestas de la Asunción en el Barrio de Tlaxcala | Centro | San Luis Potosí | C01 (verificado), C09 (aproximado) | FENAPO, Gobierno del Estado (`fenapo-2026`) | VERIFIED | `wc-198070643` Entrada a la FENAPO (nueva, 1200 px) |
| Septiembre | Fiestas patronales de San Miguel Arcángel | Además, jaripeos y bailes en Tierra Nueva | Huasteca | Tancanhuitz | MUN-TANCANHUITZ (verificado, ITER), C13 (verificado) | Folleto oficial Huasteca; Turismo SLP (Tierra Nueva) | VERIFIED (evento) · PARTIAL (imagen) | `wc-44351463` Bordados de Tancanhuitz (nueva; foto tomada en CDMX) |
| Octubre | Veneración de San Francisco de Asís, 4 oct | Peregrinos en Real de Catorce | Altiplano | Catorce | A01 (verificado) | Secretaría de Turismo SLP (`turismo-slp-lugar-real-de-catorce`) | VERIFIED | `wc-119874344` Real de Catorce |
| Noviembre | Xantolo (Día de Muertos huasteco) | Altares, comparsas, danzas tének y nahuas | Huasteca | Varios; el folleto lo destaca en Tancanhuitz | MUN-TANCANHUITZ (verificado, ITER) | Gobierno del Estado (`slp-gob-xantolo-2025`); folleto Huasteca | VERIFIED | `wc-36732336` Altar de Xantolo (nueva) |
| Diciembre | Navidad Verde, agenda navideña del Gobierno del Estado | Árbol, Nacimiento, pastorelas, conciertos y videomapping en el Centro Histórico | Centro | San Luis Potosí | C01 (verificado) | Secretaría de Cultura SLP (`cultura-slp-navidad-verde-2025`); Secretaría de Turismo SLP (`turismo-slp-festival-navidad-verde`) | VERIFIED | `wc-50604762` Catedral Metropolitana de noche (una de las sedes) |

**Temporadas** (Primavera, Verano, Otoño, Invierno): reutilizan la historia de abril, julio, octubre y enero, con fotos propias distintas de las de cualquier mes.

## Diciembre, en detalle

**Opciones comparadas**

| Opción | Fuente | Especificidad | Riqueza | Evidencia | Imagen |
|---|---|---|---|---|---|
| **Navidad Verde (elegida)** | Cultura SLP, nota del 29 nov 2025: «Del 1 de diciembre al 6 de enero…», con sedes en Plaza de Fundadores, Teatro de la Paz, Basílica de Guadalupe, Catedral Metropolitana y templos del Centro Histórico. Secretaría de Turismo (visitasanluispotosi.com/festival-navidad): «Festival de la Navidad Verde», con árbol, Nacimiento, videomapping «Regalo de Luz», pastorelas y plazas del Centro. Cultura SLP, conciertos del 23 y 24 dic 2025 en Plaza de Fundadores. | Propia de diciembre | Alta: cultural, gratuita, en el centro turístico | Dos dependencias estatales | Catedral Metropolitana de noche, una de las sedes oficiales (foto ya aprobada) |
| Fiesta patronal de San Nicolás Tolentino (inicia el 10 dic) | Folleto oficial Zona Media | Propia de diciembre | Media: carreras de caballos, jaripeos, fuegos artificiales, danzas | Un folleto | No hay foto con licencia libre |
| Peregrinaciones guadalupanas (12 dic) | Secretaría de Seguridad SLP, «Operativo Guadalupano 2025» (5–15 dic) | Propia de diciembre | Alta en lo religioso, pero ninguna fuente de turismo la promueve | Solo un operativo de seguridad, no una recomendación turística | — |
| Cascadas de El Naranjo / Tamul (nov–mar) | Folleto oficial Huasteca | Baja: cinco meses | Alta | Folleto | Sí |
| Frío extremo en el Altiplano | Folleto oficial Altiplano | Es una advertencia, no una recomendación | — | Folleto | — |

**Decisión.** Diciembre cuenta la historia de **Navidad Verde**. Es lo único de diciembre que respaldan a la vez la Secretaría de Cultura y la Secretaría de Turismo del Estado, y ocurre en el corazón turístico de la capital. «Buena temporada para las cascadas de El Naranjo» es verdad, pero cubre de noviembre a marzo: ya cuenta la historia de febrero y en diciembre pasa a «También este mes». La fiesta de San Nicolás Tolentino también pasa a «También este mes» y a la lista de fiestas, con su punto INEGI en el mapa.

**Cautelas**
- Las fechas de 2026 no están publicadas, así que el texto dice que la edición 2025 fue del 1 de diciembre al 6 de enero y que las de 2026 aún no se anuncian.
- La página de la Secretaría de Turismo menciona del 4 al 15 de diciembre sin año; es de una edición anterior. Prevalece la nota fechada de Cultura SLP.

## Alternativas descartadas en otros meses

- **Marzo y abril (Semana Santa móvil).**
  - Marzo lleva la Semana Santa xi'iui y abril la Procesión del Silencio, para no repetir y porque la Procesión tiene fecha oficial confirmada (3 abr 2026).
  - En 2027 la Semana Santa cae en marzo (21–28 mar): ambas historias aplican a ambos meses.
  - Por eso marzo es PARTIAL.
- **Mayo.**
  - Ningún registro oficial es propio de mayo.
  - La Taza (M05, «en temporada de calor») tiene promoción discreta y sin meses, así que se descartó.
  - Queda la Media Luna (todo el año) como PARTIAL. **NEEDS_RESEARCH:** buscar en la agenda oficial un evento de mayo.
- **Junio.**
  - Antes se usaba la advertencia de verano del Altiplano con una foto de desierto. Era una advertencia, no una recomendación, y hay un evento propio del mes: San Juan Bautista en Cerritos.
- **Agosto.**
  - FENAPO es el evento oficial más grande del mes.
  - Las fiestas de la Asunción en Tlaxcala quedan como segundo punto.
  - Se descartó la foto del «Domo San Luis» porque muestra publicidad de marca.
- **Septiembre.**
  - Antes se usaba el Sótano de las Golondrinas, que es de todo el año.
  - Septiembre tiene dos eventos propios: San Miguel Arcángel en Tancanhuitz y los jaripeos de Tierra Nueva. Se eligió Tancanhuitz por su peso cultural en la Huasteca.
  - No existe foto libre de la fiesta. La imagen son bordados de Tancanhuitz fotografiados en una exposición en CDMX, y el pie de foto lo dice.
- **Noviembre.**
  - Antes se usaba una máscara de huehue de Xilitla.
  - Ahora es un altar de Xantolo fotografiado en la Huasteca Potosina (Commons, CC BY-SA 4.0), que corresponde al texto oficial («altares, comparsas…»).
  - H18 (Xantolo) no tiene punto porque es una tradición regional. El mapa marca Tancanhuitz, donde el folleto oficial ubica «Semana Santa y Xantolo».

## Posibles conflictos entre fuentes

- **Navidad Verde:** la página de Turismo dice «4 al 15 de diciembre» sin año; Cultura SLP dice «1 de diciembre al 6 de enero» (edición 2025). Se cita la nota fechada.
- **Xantolo:** la edición oficial de 2025 fue del 29 oct al 2 nov; el evento dice «finales de octubre – 2 de noviembre». No se reutilizan fechas de 2025 como si fueran de 2026.
- **Quema de diablos (Ciudad del Maíz):** está en el folleto, pero sin mes en ninguna fuente leída. Sigue `pending` y no se usa.
- **Cascada El Salto:** el folleto dice que corre «en lluvias y en Semana Santa», sin meses. No se asigna a un mes; solo aparece como punto de El Naranjo.

## Coordenadas añadidas

Tres cabeceras municipales nombradas por registros oficiales, sin destino propio. Se tomaron de **INEGI ITER 2020** (`research/raw/inegi/iter_24_cpv2020_csv.zip`, fuente ya registrada `inegi-iter-2020`), con el mismo método que Tierra Nueva (C13), que coincide al metro con su punto existente.

| Localidad | Lat | Lon | Clave |
|---|---|---|---|
| Cerritos | 22.427666 | −100.279597 | 240080001 |
| Tancanhuitz | 21.597319 | −98.966388 | 240120001 |
| San Nicolás Tolentino | 22.248535 | −100.552076 | 240300001 |
