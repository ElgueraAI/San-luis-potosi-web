// Events research, pass 6 (2026-10-06). Writes two additive files; nothing existing is modified:
//   research/generated/events-additions-pass6.json
//   research/source-registry/sources-pass6.json
//
// Sources (all official, read on 2026-10-06; raw copies under research/raw/, git-ignored):
//   - CEFIM, Gobierno del Estado: municipal infographics 2022 (research/raw/cefim/*.pdf), one per
//     municipality, each with a «fiestas populares» paragraph. Dates there are recurring patterns
//     («del 12 al 20 de enero», «el 3 de mayo»): RECURRENT_OFFICIAL_PATTERN, never a 2026 date.
//   - Secretaría de Turismo (visitasanluispotosi.com/dia-de-muertos/): the Xantolo cycle and the
//     2025 municipal Día de Muertos / Xantolo programmes (HISTORICAL_LAST_CONFIRMED, 2025).
//   - turismo.slp.gob.mx/lugares/villa-hidalgo/: San José, 19 de marzo.
//   - slp.gob.mx, cultura.slp.gob.mx, inpode.slp.gob.mx news: 2026 editions with dates.
//   - matehuala.gob.mx: Feria de la Charamusca 2025.
// Nothing is inferred: a range copied as written, a month only where the source names it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const R = (...p) => path.join(root, ...p);
const TODAY = '2026-10-06';

const CEFIM = 'cefim-infografias-2022';
const CEFIM_URL = 'https://cefimslp.gob.mx/infografias/2022/';
// [municipality, name, date pattern as written by the source, months, category, recurrence rule]
const C = [
  ['Ahualulco', 'Fiesta de la Virgen de la Candelaria', 'Del 26 de febrero al 2 de marzo', [2, 3], 'Fiesta patronal y feria', 'FREQ=YEARLY;26 feb–2 mar'],
  ['Alaquines', 'Fiestas del Señor del Santo Entierro (Cristo Milagroso)', 'Del 25 al 29 de mayo', [5], 'Fiesta religiosa', 'FREQ=YEARLY;25–29 may'],
  ['Aquismón', 'Feria de Santiago Apóstol y Santa Ana', '25 y 26 de julio', [7], 'Feria y fiesta religiosa', 'FREQ=YEARLY;25–26 jul'],
  ['Aquismón', 'Fiesta de San Isidro Labrador', '15 de mayo', [5], 'Fiesta religiosa', 'FREQ=YEARLY;15 may'],
  ['Aquismón', 'Fiesta de San Miguel Arcángel, santo patrono', '29 de septiembre', [9], 'Fiesta patronal', 'FREQ=YEARLY;29 sep'],
  ['Armadillo de los Infante', 'Fiesta de la Purísima Concepción', '8 de diciembre', [12], 'Fiesta patronal', 'FREQ=YEARLY;8 dic'],
  ['Axtla de Terrazas', 'Fiestas de Santa Catarina', 'Inician el 25 de noviembre', [11], 'Fiesta patronal', 'FREQ=YEARLY;desde 25 nov'],
  ['Cárdenas', 'Fiesta de San Nicolás Tolentino, santo patrono', '9 de septiembre', [9], 'Fiesta patronal y peregrinación', 'FREQ=YEARLY;9 sep'],
  ['Cárdenas', 'Feria de la Primavera', 'En mayo', [5], 'Feria', 'FREQ=YEARLY;mayo'],
  ['Cedral', 'Fiestas de la Virgen de la Asunción', 'Del 31 de julio al 15 de agosto', [7, 8], 'Fiesta patronal y feria', 'FREQ=YEARLY;31 jul–15 ago'],
  ['Cerro de San Pedro', 'Fiesta de San Pedro, santo patrono', '29 de junio', [6], 'Fiesta patronal', 'FREQ=YEARLY;29 jun'],
  ['Charcas', 'Fiestas de la Virgen de Charcas', 'Del 31 de agosto al 8 de septiembre', [8, 9], 'Fiesta patronal', 'FREQ=YEARLY;31 ago–8 sep'],
  ['Charcas', 'Fiesta de la Virgen del Rosario', 'Del 30 de septiembre al 8 de octubre', [9, 10], 'Fiesta religiosa', 'FREQ=YEARLY;30 sep–8 oct'],
  ['Ciudad del Maíz', 'Feria Regional de Ciudad del Maíz', 'Del 12 al 20 de enero', [1], 'Feria', 'FREQ=YEARLY;12–20 ene'],
  ['Ciudad del Maíz', 'Fiesta de la Purísima Concepción', '8 de diciembre', [12], 'Fiesta religiosa', 'FREQ=YEARLY;8 dic'],
  ['Ciudad del Maíz', 'Fiesta de San José (Villa de San José)', '19 de marzo', [3], 'Fiesta religiosa', 'FREQ=YEARLY;19 mar'],
  ['Ciudad Fernández', 'Fiesta del Dulce Nombre de Jesús', 'Del 1 al 14 de enero', [1], 'Fiesta religiosa', 'FREQ=YEARLY;1–14 ene'],
  ['Ciudad Fernández', 'Fiesta popular del Refugio', 'Del 26 de junio al 4 de julio', [6, 7], 'Fiesta popular', 'FREQ=YEARLY;26 jun–4 jul'],
  ['Ciudad Valles', 'Fiestas de Santiago Apóstol y Santa Ana', '25 y 26 de julio', [7], 'Fiesta patronal', 'FREQ=YEARLY;25–26 jul'],
  ['Coxcatlán', 'Fiesta de San Juan Bautista', '24 de junio, con novenario y peregrinación en las comunidades', [6], 'Fiesta patronal', 'FREQ=YEARLY;24 jun'],
  ['Ébano', 'Fiesta conmemorativa petrolera', '18 de marzo', [3], 'Conmemoración', 'FREQ=YEARLY;18 mar'],
  ['El Naranjo', 'Día de la Santa Cruz', '3 de mayo', [5], 'Fiesta religiosa', 'FREQ=YEARLY;3 may'],
  ['El Naranjo', 'Conmemoración de la Virgen de Fátima', '13 de mayo', [5], 'Fiesta religiosa', 'FREQ=YEARLY;13 may'],
  ['El Naranjo', 'Fiesta de la Virgen de Guadalupe', 'Del 2 al 12 de diciembre', [12], 'Fiesta religiosa', 'FREQ=YEARLY;2–12 dic'],
  ['Guadalcázar', 'Fiestas de Navidad y Feria Popular', 'Del 16 al 25 de diciembre; feria del 22 al 25', [12], 'Fiesta popular y feria', 'FREQ=YEARLY;16–25 dic'],
  ['Huehuetlán', 'Fiesta de San Diego de Alcalá', '12 y 13 de noviembre, con novenario y peregrinación', [11], 'Fiesta patronal', 'FREQ=YEARLY;12–13 nov'],
  ['Lagunillas', 'Fiesta de San Antonio de Padua', '13 de junio', [6], 'Fiesta patronal', 'FREQ=YEARLY;13 jun'],
  ['Lagunillas', 'Fiestas de diciembre: Virgen de Guadalupe y feria', '12 de diciembre; fiesta con baile y feria el 24', [12], 'Fiesta religiosa y feria', 'FREQ=YEARLY;12 y 24 dic'],
  ['Matehuala', 'Fiesta del Cristo de Matehuala', 'Del 1 al 15 de enero', [1], 'Fiesta religiosa', 'FREQ=YEARLY;1–15 ene'],
  ['Matehuala', 'Fiesta de San Antonio', '13 de junio', [6], 'Fiesta religiosa', 'FREQ=YEARLY;13 jun'],
  ['Matehuala', 'Fiestas de la fundación de Matehuala', 'Del 8 al 16 de julio', [7], 'Conmemoración', 'FREQ=YEARLY;8–16 jul'],
  ['Mexquitic de Carmona', 'Fiesta de la Virgen de Guadalupe en el Desierto', '12 de diciembre', [12], 'Fiesta religiosa y peregrinación', 'FREQ=YEARLY;12 dic'],
  ['Moctezuma', 'Fiestas de Santa Anita', 'Del 24 al 28 de julio, con desfiles alegóricos y danzas', [7], 'Fiesta patronal', 'FREQ=YEARLY;24–28 jul'],
  ['Rayón', 'Feria Regional Comercial', 'Del 1 al 5 de mayo', [5], 'Feria', 'FREQ=YEARLY;1–5 may'],
  ['Rayón', 'Fiesta religiosa de julio', '4 de julio', [7], 'Fiesta religiosa', 'FREQ=YEARLY;4 jul'],
  ['Rioverde', 'Fiestas de Santa Catarina y Feria Regional', 'Del 16 al 25 de noviembre: feria, verbena, entrada de cera y danzas', [11], 'Fiesta patronal y feria', 'FREQ=YEARLY;16–25 nov'],
  ['Rioverde', 'Fiesta religiosa de julio', 'Del 10 al 18 de julio', [7], 'Fiesta religiosa', 'FREQ=YEARLY;10–18 jul'],
  ['Rioverde', 'Fiestas típicas', '24 de octubre', [10], 'Fiesta popular', 'FREQ=YEARLY;24 oct'],
  ['Salinas', 'Fiesta patronal de Nuestro Padre Jesús', 'Bajada de la imagen el último domingo de febrero, con concurso de danzas chichimecas; fiesta el primer viernes de marzo', [2, 3], 'Fiesta patronal y feria', 'FREQ=YEARLY;último domingo de febrero – primer viernes de marzo'],
  ['San Antonio', 'Fiesta de San Antonio de Padua', '13 de junio', [6], 'Fiesta patronal', 'FREQ=YEARLY;13 jun'],
  ['San Ciro de Acosta', 'Feria Regional de San Ciro de Acosta', 'Del 22 al 31 de enero: danzas, charreadas, bailes y juegos pirotécnicos', [1], 'Feria', 'FREQ=YEARLY;22–31 ene'],
  ['San Ciro de Acosta', 'Fiesta de la Virgen de Guadalupe', '12 de diciembre', [12], 'Fiesta religiosa', 'FREQ=YEARLY;12 dic'],
  ['San Martín Chalchicuautla', 'Xantolo: desfile y concurso de comparsas', 'Día de Muertos (fines de octubre – 2 de noviembre)', [10, 11], 'Tradición y patrimonio vivo', 'FREQ=YEARLY;Xantolo'],
  ['San Vicente Tancuayalab', 'Fiesta de San Francisco de Asís, santo patrono', '4 de octubre', [10], 'Fiesta patronal', 'FREQ=YEARLY;4 oct'],
  ['San Vicente Tancuayalab', 'Fiesta de la Virgen de Guadalupe', 'En diciembre', [12], 'Fiesta religiosa', 'FREQ=YEARLY;diciembre'],
  ['Santa Catarina', 'Fiesta de San Francisco de Asís, con danzas autóctonas', '4 de octubre', [10], 'Fiesta religiosa', 'FREQ=YEARLY;4 oct'],
  ['Santa María del Río', 'Fiesta de la Asunción y Feria Nacional del Rebozo', 'Del 1 al 15 de agosto', [8], 'Fiesta patronal y feria', 'FREQ=YEARLY;1–15 ago'],
  ['Santo Domingo', 'Fiesta de Santo Domingo, santo patrono', '4 de agosto, con jaripeos y carreras de caballos', [8], 'Fiesta patronal', 'FREQ=YEARLY;4 ago'],
  ['Tamasopo', 'Feria Regional de Tamasopo', 'Del 10 al 19 de marzo, con muestra gastronómica', [3], 'Feria', 'FREQ=YEARLY;10–19 mar'],
  ['Tamazunchale', 'Feria Anual Guadalupana', '12 de diciembre', [12], 'Feria y fiesta religiosa', 'FREQ=YEARLY;12 dic'],
  ['Tamazunchale', 'Fiesta de San Juan Bautista', '24 de junio', [6], 'Fiesta religiosa', 'FREQ=YEARLY;24 jun'],
  ['Tamazunchale', 'Semana Santa con huehues', 'Semana Santa (marzo o abril): procesiones, representaciones y bendición de pan y cereales', [3, 4], 'Tradición', 'FREQ=YEARLY;Semana Santa'],
  ['Tampacán', 'Fiesta de la Asunción de la Virgen', '15 de agosto', [8], 'Fiesta patronal', 'FREQ=YEARLY;15 ago'],
  ['Tampamolón Corona', 'Fiesta patronal de Santiago Apóstol', '24 y 25 de julio, con danzas Las Varitas y La Malinche', [7], 'Fiesta patronal', 'FREQ=YEARLY;24–25 jul'],
  ['Tamuín', 'Semana Santa en Tamuín', 'Semana Santa (marzo o abril)', [3, 4], 'Fiesta popular', 'FREQ=YEARLY;Semana Santa'],
  ['Tanlajás', 'Semana Santa y Día de Muertos con máscaras', 'Semana Santa; 1 y 2 de noviembre', [3, 4, 11], 'Tradición', 'FREQ=YEARLY;Semana Santa y Día de Muertos'],
  ['Tanquián de Escobedo', 'Fiestas Patronales de San José', 'Del 15 al 19 de marzo: feria con exposición ganadera, artesanal y gastronómica', [3], 'Fiesta patronal y feria', 'FREQ=YEARLY;15–19 mar'],
  ['Vanegas', 'Feria Regional y fiesta de San Juan', 'Feria del 10 al 15 de junio; San Juan el 24 de junio', [6], 'Feria y fiesta patronal', 'FREQ=YEARLY;10–15 y 24 jun'],
  ['Venado', 'Fiestas de la Purísima Concepción', 'Del 1 al 8 de diciembre; el día 8, feria y danza de matlachines', [12], 'Fiesta patronal y feria', 'FREQ=YEARLY;1–8 dic'],
  ['Venado', 'Santa Cruz y procesión del Señor de las Injurias', 'En mayo', [5], 'Fiesta religiosa', 'FREQ=YEARLY;mayo'],
  ['Villa de Arriaga', 'Fiesta de la Virgen de Guadalupe', 'Del 2 al 12 de diciembre', [12], 'Fiesta religiosa', 'FREQ=YEARLY;2–12 dic'],
  ['Villa de Guadalupe', 'Día de la Santa Cruz', '3 de mayo', [5], 'Fiesta religiosa', 'FREQ=YEARLY;3 may'],
  ['Villa de Guadalupe', 'Fiesta de la Virgen de Guadalupe', '12 de diciembre', [12], 'Fiesta religiosa', 'FREQ=YEARLY;12 dic'],
  ['Villa de la Paz', 'Fiesta de la Virgen de la Paz y Feria Regional', 'Del 16 al 24 de enero', [1], 'Fiesta patronal y feria', 'FREQ=YEARLY;16–24 ene'],
  ['Villa de Ramos', 'Fiesta de San Juan Nepomuceno y feria', '16 de mayo', [5], 'Fiesta patronal y feria', 'FREQ=YEARLY;16 may'],
  ['Villa de Reyes', 'Fiesta de San Francisco de Asís, santo patrono', 'Del 25 de septiembre al 4 de octubre', [9, 10], 'Fiesta patronal', 'FREQ=YEARLY;25 sep–4 oct'],
  ['Villa Juárez', 'Fiesta de Santa Gertrudis y feria regional', '16 de noviembre, con corridas de toros', [11], 'Fiesta patronal y feria', 'FREQ=YEARLY;16 nov'],
  ['Xilitla', 'Feria de Xilitla', 'Del 1 al 15 de mayo', [5], 'Feria', 'FREQ=YEARLY;1–15 may'],
  ['Xilitla', 'Fiesta de San Agustín', 'Del 27 de agosto al 2 de septiembre; el 28, peregrinaciones y danzas de Soledad, Varitas y Rebozo', [8, 9], 'Fiesta patronal', 'FREQ=YEARLY;27 ago–2 sep'],
  ['Zaragoza', 'Fiesta de San Antonio de Padua, santo patrono', '13 de junio, con peregrinaciones', [6], 'Fiesta patronal', 'FREQ=YEARLY;13 jun'],
];
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const events = C.map(([muni, name, pattern, months, category, rule]) => ({
  event_id: `cefim-${slug(muni)}-${slug(name).slice(0, 40)}`,
  event_name: name, municipality: muni, category, typical_month: pattern, months,
  date_status: 'RECURRENT_OFFICIAL_PATTERN', recurrence_rule: rule, start_date: null, end_date: null,
  source_id: CEFIM, source_url: CEFIM_URL, verification_status: 'verified',
  notes: 'Patrón anual publicado por el CEFIM (Gobierno del Estado) en la infografía municipal 2022; no confirma las fechas de 2026.',
}));

// conflict worth keeping visible: Ébano's brochure line «31 de junio» is not a date
events.push({
  event_id: 'cefim-ebano-feria-tradicional', event_name: 'Feria Tradicional de Ébano', municipality: 'Ébano', category: 'Feria',
  typical_month: 'Junio (la fuente escribe «31 de junio», que no existe)', months: [6], date_status: 'DATE_PENDING', recurrence_rule: null,
  start_date: null, end_date: null, source_id: CEFIM, source_url: CEFIM_URL, verification_status: 'verified',
  notes: 'Fecha inválida en la fuente; se conserva el mes y se marca como pendiente.',
});

// 2026 editions with dates (official news)
const N = [
  ['slp-gob-saucito-2026', 'Fiestas patronales del Señor del Saucito', 'San Luis Potosí', 'Fiesta patronal · patrimonio cultural inmaterial del Estado', '2026-02-23', '2026-03-15', [2, 3], 'Del 23 de febrero al 15 de marzo de 2026', 'https://slp.gob.mx/noticias/2026/2/25/gobierno-estatal-fortalece-la-protecci%C3%B3n-de-las-tradiciones-del-saucito/', 'Misas, peregrinaciones, novenario y festivales de danza (Gobierno del Estado). Reconocidas como Patrimonio Cultural Inmaterial del Estado.'],
  ['slp-gob-fenahuap-2026', 'Feria Nacional de la Huasteca Potosina (FENAHUAP)', 'Ciudad Valles', 'Feria', '2026-03-27', '2026-04-05', [3, 4], 'Del 27 de marzo al 5 de abril de 2026 (64.ª edición)', 'https://slp.gob.mx/noticias/2026/3/28/64%C2%AA-edici%C3%B3n-de-la-feria-nacional-de-la-huasteca-potosina-en-ciudad-valles/', 'Conflicto de fuentes: la infografía municipal del CEFIM (2022) la ubica del 8 al 28 de mayo; prevalece la edición 2026 confirmada.'],
  ['slp-gob-semana-santa-2026', 'Semana Santa en San Luis Potosí: programa estatal', null, 'Tradición religiosa', '2026-03-27', '2026-04-11', [3, 4], 'Del 27 de marzo al 11 de abril de 2026', 'https://slp.gob.mx/noticias/2026/4/1/semana-santa-fortalece-tradiciones-y-atrae-visitantes-a-san-luis/', 'Más de 100 actividades en todo el estado: Procesión del Silencio, Procesión de los Cristos, viacrucis viviente en Villa de Pozos, Quema de Judas.'],
  ['slp-gob-fenae-2026', 'Feria Nacional de la Enchilada (FENAE)', 'Soledad de Graciano Sánchez', 'Feria gastronómica', '2026-04-04', null, [4], 'Inició el 4 de abril de 2026; durante la semana de Pascua (CEFIM)', 'https://slp.gob.mx/noticias/2026/4/4/as%C3%AD-arranc%C3%B3-la-fenae-2026/', 'La infografía del CEFIM la sitúa en la semana de la Resurrección (abril).'],
  ['inpode-trail-rioverde-2026', 'Serial Trail Mágico en Rioverde', 'Rioverde', 'Deporte y aventura', '2026-11-07', '2026-11-08', [11], '7 y 8 de noviembre de 2026', 'https://inpode.slp.gob.mx/eventos/2026/4/21/serial-trail-magico-en-rio-verde/', 'Carrera de montaña organizada por el INPODE.'],
  ['inpode-trail-soledad-2026', 'Serial Trail Mágico en Soledad', 'Soledad de Graciano Sánchez', 'Deporte y aventura', '2026-12-05', '2026-12-06', [12], '5 y 6 de diciembre de 2026', 'https://inpode.slp.gob.mx/eventos/2026/4/21/serial-trail-magico-en-soledad/', 'Carrera de montaña organizada por el INPODE; fechas según la agenda de Turismo SLP.'],
  ['slp-gob-estudiantinas-2026', 'Noche de tunas y callejoneada de máscaras', 'San Luis Potosí', 'Música y tradición', '2026-05-09', '2026-05-16', [5], 'Concierto de estudiantinas el 9 de mayo y callejoneada de máscaras y antifaces el 16 de mayo de 2026', 'https://slp.gob.mx/noticias/2026/4/27/invitan-a-concierto-de-estudiantinas-y-callejoneada-de-m%C3%A1scaras-y-antifaces/', 'Secretaría de Cultura del Estado, Teatro de la Paz y Centro Histórico.'],
  ['cultura-slp-rondallas-2026', '2.º Festival de Rondallas Potosinas', 'San Luis Potosí', 'Música', '2026-02-14', '2026-02-14', [2], '14 de febrero de 2026', 'https://cultura.slp.gob.mx/eventos/2026/2/3/2do-festival-de-rondallas-potosinas/', 'Museo Nacional de la Máscara.'],
];
for (const [id, name, muni, category, start, end, months, pattern, url, notes] of N) {
  events.push({ event_id: id, event_name: name, municipality: muni, category, typical_month: pattern, months,
    date_status: 'CONFIRMED_CURRENT_YEAR', recurrence_rule: null, start_date: start, end_date: end,
    source_id: id, source_url: url, verification_status: 'verified', notes });
}
events.push(
  { event_id: 'cultura-slp-festival-luna-2026', event_name: 'Festival de la Luna', municipality: 'Matehuala', category: 'Festival cultural', typical_month: 'Junio (edición 2026; fecha exacta no publicada en la nota)', months: [6], date_status: 'HISTORICAL_LAST_CONFIRMED', recurrence_rule: null, start_date: null, end_date: null, source_id: 'cultura-slp-festival-luna-2026', source_url: 'https://cultura.slp.gob.mx/noticias/2026/6/26/gobierno-estatal-acerca-la-cultura-al-altiplano-con-el-festival-de-la-luna/', verification_status: 'verified', notes: 'La nota no indica si es anual.' },
  { event_id: 'matehuala-charamusca-2025', event_name: 'Feria de la Charamusca', municipality: 'Matehuala', category: 'Feria gastronómica', typical_month: 'Del 17 al 20 de abril de 2025 (Semana Santa)', months: [4], date_status: 'HISTORICAL_LAST_CONFIRMED', recurrence_rule: null, start_date: '2025-04-17', end_date: '2025-04-20', source_id: 'matehuala-gob-conoce', source_url: 'https://matehuala.gob.mx/m/conoce-matehuala/', verification_status: 'verified', notes: 'Edición 2025 publicada por el Ayuntamiento de Matehuala.' },
  { event_id: 'turismo-slp-villa-hidalgo-san-jose', event_name: 'Fiesta de San José', municipality: 'Villa Hidalgo', category: 'Fiesta patronal', typical_month: '19 de marzo', months: [3], date_status: 'RECURRENT_OFFICIAL_PATTERN', recurrence_rule: 'FREQ=YEARLY;19 mar', start_date: null, end_date: null, source_id: 'turismo-slp-lugar-villa-hidalgo', source_url: 'https://turismo.slp.gob.mx/lugares/villa-hidalgo/', verification_status: 'verified', notes: null },
  { event_id: 'turismo-slp-campeonato-charro', event_name: 'Congreso y Campeonato Nacional Charro (edición LXXX)', municipality: 'San Luis Potosí', category: 'Charrería', typical_month: 'Del 14 de octubre al 3 de noviembre (año no indicado en la página)', months: [10, 11], date_status: 'HISTORICAL_LAST_CONFIRMED', recurrence_rule: null, start_date: null, end_date: null, source_id: 'turismo-slp-campeonato-charro', source_url: 'https://visitasanluispotosi.com/campeonato-nacional-charro/', verification_status: 'verified', notes: 'Sede: Arena Potosí. Campeonato nacional que rota de sede: no es una fiesta anual del estado.' },
);

// Xantolo / Día de Muertos 2025 municipal programmes (Secretaría de Turismo)
const html = fs.readFileSync(R('research/raw/visitaslp/dia-de-muertos.html'), 'utf8');
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/&#8211;/g, '–').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim()));
const MONTH = { septiembre: 9, octubre: 10, octobre: 10, noviembre: 11 };
const byMuni = {};
for (const r of rows.slice(1)) if (r[0]) (byMuni[r[0].replace(/^Capital /, '')] ??= []).push(r);
for (const [muni, rs] of Object.entries(byMuni)) {
  const dates = rs.flatMap((r) => [...(r[2] ?? '').matchAll(/(\d{1,2})(?:[^\d]{1,12}(\d{1,2}))?\s+de\s+(septiembre|octubre|octobre|noviembre)/gi)].map((m) => ({ d: +m[1], m: MONTH[m[3].toLowerCase()] })));
  if (!dates.length) continue;
  const key = (x) => x.m * 100 + x.d;
  const first = dates.reduce((a, b) => (key(b) < key(a) ? b : a)), last = dates.reduce((a, b) => (key(b) > key(a) ? b : a));
  const M = ['', '', '', '', '', '', '', '', '', 'septiembre', 'octubre', 'noviembre'];
  const same = key(first) === key(last);
  const span = same ? `el ${first.d} de ${M[first.m]}` : `del ${first.d} de ${M[first.m]} al ${last.d} de ${M[last.m]}`;
  // localities of Catorce keep their name; the municipality is Catorce
  const municipality = { 'Real de Catorce': 'Catorce', 'Estación Catorce': 'Catorce' }[muni] ?? muni;
  events.push({
    event_id: `turismo-slp-xantolo-2025-${slug(muni)}`, event_name: `Xantolo y Día de Muertos en ${muni}`, municipality,
    category: 'Tradición y patrimonio vivo',
    typical_month: `Programa 2025: ${span} (${rs.length} ${rs.length === 1 ? 'actividad' : 'actividades'})`,
    months: [...new Set(dates.map((x) => x.m))].sort((a, b) => a - b), date_status: 'HISTORICAL_LAST_CONFIRMED', recurrence_rule: null,
    start_date: `2025-${String(first.m).padStart(2, '0')}-${String(first.d).padStart(2, '0')}`, end_date: `2025-${String(last.m).padStart(2, '0')}-${String(last.d).padStart(2, '0')}`,
    source_id: 'turismo-slp-dia-de-muertos', source_url: 'https://visitasanluispotosi.com/dia-de-muertos/', verification_status: 'verified',
    notes: `Actividades 2025: ${rs.slice(0, 4).map((r) => r[1]).join('; ')}${rs.length > 4 ? '…' : ''}. Las fechas de 2026 aún no se publican.`,
  });
}

const sources = [
  [CEFIM, 'Coordinación Estatal para el Fortalecimiento Institucional de los Municipios (CEFIM), Gobierno del Estado', 'cefimslp.gob.mx', 'Infografías municipales 2022 (58 municipios)', CEFIM_URL, 'official-municipal-profiles', 'Each infographic has a «fiestas populares» paragraph. Recurring patterns, 2022 publication.'],
  ['turismo-slp-dia-de-muertos', 'Secretaría de Turismo de San Luis Potosí', 'visitasanluispotosi.com', 'Día de Muertos · Xantolo: ciclo de fechas y programas municipales 2025', 'https://visitasanluispotosi.com/dia-de-muertos/', 'official-tourism-page', 'Cycle 29 Sep – 30 Nov; 2025 programmes of about 30 municipalities.'],
  ['turismo-slp-campeonato-charro', 'Secretaría de Turismo de San Luis Potosí', 'visitasanluispotosi.com', 'Campeonato Nacional Charro', 'https://visitasanluispotosi.com/campeonato-nacional-charro/', 'official-tourism-page', 'Edition LXXX; year not stated.'],
  ['turismo-slp-conexion-aerea', 'Secretaría de Turismo de San Luis Potosí', 'visitasanluispotosi.com', 'Conexión aérea: aerolíneas y destinos del Aeropuerto Internacional Ponciano Arriaga', 'https://visitasanluispotosi.com/conexion-aerea/', 'official-tourism-page', 'Airlines and frequencies as published.'],
  ['turismo-slp-lugar-villa-hidalgo', 'Secretaría de Turismo de San Luis Potosí', 'turismo.slp.gob.mx', 'Villa Hidalgo', 'https://turismo.slp.gob.mx/lugares/villa-hidalgo/', 'official-tourism-page', 'San José, 19 de marzo.'],
  ['matehuala-gob-conoce', 'H. Ayuntamiento de Matehuala', 'matehuala.gob.mx', 'Conoce Matehuala', 'https://matehuala.gob.mx/m/conoce-matehuala/', 'official-municipal', 'Feria de la Charamusca and Semana Santa 2025.'],
  ['cultura-slp-festival-luna-2026', 'Secretaría de Cultura del Estado', 'cultura.slp.gob.mx', 'Festival de la Luna (Matehuala)', 'https://cultura.slp.gob.mx/noticias/2026/6/26/gobierno-estatal-acerca-la-cultura-al-altiplano-con-el-festival-de-la-luna/', 'official-news', null],
  ...N.map(([id, name, , , , , , , url]) => [id, /inpode/.test(url) ? 'Instituto Potosino de Cultura Física y Deporte (INPODE)' : /cultura\.slp/.test(url) ? 'Secretaría de Cultura del Estado' : 'Gobierno del Estado de San Luis Potosí', new URL(url).hostname, name, url, 'official-news', null]),
].map(([source_id, institution, domain, title, url, source_type, notes]) => ({ source_id, institution, domain, title, url, source_type, region: null, destination: null, retrieval_date: TODAY, accessibility_status: 'accessible', verification_status: 'official', notes }));

fs.writeFileSync(R('research/generated/events-additions-pass6.json'), JSON.stringify({
  generated: TODAY,
  pass: '6 — events calendar completeness',
  rule: 'Additive to events.json and seasonal-additions-pass4.json (untouched). date_status: CONFIRMED_CURRENT_YEAR · RECURRENT_OFFICIAL_PATTERN · HISTORICAL_LAST_CONFIRMED · DATE_PENDING. No 2026 date is inferred from a pattern.',
  xantolo_cycle: { source_id: 'turismo-slp-dia-de-muertos', steps: [['29 de septiembre', 'San Miguel Arcángel: inicio de las fiestas y primera ofrenda'], ['18 de octubre', 'San Lucas: segunda ofrenda'], ['28 de octubre', 'San Judas Tadeo: preparativos'], ['30 y 31 de octubre', 'Altares; ofrenda a los niños angelitos'], ['1 de noviembre', 'Todos Santos'], ['2 de noviembre', 'Fieles Difuntos: la fiesta grande'], ['30 de noviembre', 'San Andrés: despedida y levantamiento del arco']] },
  events,
}, null, 1) + '\n');
fs.writeFileSync(R('research/source-registry/sources-pass6.json'), JSON.stringify({ generated: TODAY, rule: 'Additive to sources.json (untouched).', sources }, null, 1) + '\n');
console.log(`events ${events.length} · sources ${sources.length}`);
const byM = Array.from({ length: 12 }, (_, i) => events.filter((e) => e.months.includes(i + 1)).length);
console.log('by month', byM.join(' '));
