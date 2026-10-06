/**
 * Visitor-facing Spanish text for events whose research notes are English
 * working notes. Each line restates the sourced content of the event record
 * (research/generated/events.json) or its seasonal record; nothing is added.
 * Images: only a photograph of the event itself or of its place; never an
 * unrelated picture (the same rule as Temporadas).
 */
export const EVENT_TEXT: Record<string, string> = {
  'ev-procesion-silencio': 'El Viernes Santo por la noche, la procesión inicia y termina en la Plaza del Carmen, en el Centro Histórico de la capital.',
  'ev-fenapo': 'La Feria Nacional Potosina, la feria del estado, se celebra en agosto en la capital.',
  'ev-lila-lopez': 'Festival Internacional de Danza Contemporánea con sedes en la capital y en Matehuala, Santa María del Río, Soledad, Villa de Pozos y Villa de Reyes. En 2026 celebró su edición 46.',
  'ev-xantolo': 'El Día de Muertos de la Huasteca: altares, comparsas y danzas tének y nahuas. En 2025 se celebró del 29 de octubre al 2 de noviembre; las fechas de 2026 aún no son oficiales.',
  'ev-san-francisco-catorce': 'Cada 4 de octubre, cientos de peregrinos veneran a San Francisco de Asís en Real de Catorce.',
  'ev-asuncion-tlaxcala': 'El Barrio de Tlaxcala, en la capital, celebra en agosto las fiestas de la Virgen de la Asunción.',
  'ev-san-miguel-tancanhuitz': 'Fiestas patronales de San Miguel Arcángel en Tancanhuitz, en septiembre.',
  'ev-semana-santa-tancanhuitz': 'El folleto oficial de la Huasteca destaca en Tancanhuitz la Semana Santa (marzo o abril) y el Xantolo (octubre y noviembre).',
  'ev-semana-santa-xiiui': 'Semana Santa indígena xi’iui en Ciudad del Maíz: al mediodía en el barrio de San José y, por la tarde, la escenificación de la crucifixión.',
  'ev-quema-diablos': 'El folleto oficial de la Zona Media la registra en Ciudad del Maíz, sin indicar el mes.',
  'ev-san-juan-cerritos': 'Cada 24 de junio, fiesta patronal y feria regional: charrería, juegos mecánicos, pabellón gastronómico, carreras de caballos y exposición ganadera.',
  'ev-san-nicolas-tolentino': 'Fiesta patronal que inicia el 10 de diciembre: carreras de caballos, jaripeos, fuegos artificiales, danzas y bailes.',
  'ev-fiestas-tierra-nueva': 'Jaripeos y bailes en septiembre, según la página oficial del destino.',
  'ev-navidad-verde': 'Agenda navideña del Gobierno del Estado: encendido del árbol, Nacimiento, pastorelas, conciertos y videomapping en plazas y templos del Centro Histórico. La edición 2025 fue del 1 de diciembre al 6 de enero.',
};
export const EVENT_IMAGE: Record<string, { id: string; caption: string }> = {
  'ev-xantolo': { id: 'wc-36732336', caption: 'Altar de Xantolo, Huasteca Potosina' },
  'sic-pci-417': { id: 'wc-36732336', caption: 'Altar de Xantolo, Huasteca Potosina' },
  'ev-fenapo': { id: 'wc-198070643', caption: 'Entrada a la Feria Nacional Potosina' },
  'ev-navidad-verde': { id: 'wc-50604762', caption: 'Catedral Metropolitana, una de las sedes' },
  'ev-san-juan-cerritos': { id: 'wc-43676810', caption: 'Parroquia de San Juan Bautista, Cerritos' },
  'ev-lila-lopez': { id: 'wc-41833060', caption: 'Teatro de la Paz, San Luis Potosí' },
  'ev-procesion-silencio': { id: 'wc-21525467', caption: 'Plaza del Carmen, donde inicia y termina la procesión' },
  'ev-san-francisco-catorce': { id: 'wc-119874344', caption: 'Real de Catorce' },
  'ev-semana-santa-xiiui': { id: 'wc-72476536', caption: 'Iglesia del pueblo, Ciudad del Maíz' },
  'sic-pci-414': { id: 'wc-72476536', caption: 'Iglesia del pueblo, Ciudad del Maíz' },
};
