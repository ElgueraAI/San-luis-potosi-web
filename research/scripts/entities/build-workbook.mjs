// Writes the human-readable master catalogue:
//   C:\Users\jerry\slp-library\Biblioteca_Visual_San_Luis_Potosi_Web_ENRIQUECIDA.xlsx
// The original workbook is only read. Its 11 sheets are copied byte for byte
// into the new file, and the catalogue sheets (00_README … 16_Pendientes) are
// added after them. JSON under research/entities stays the machine source.
//   node research/scripts/entities/build-workbook.mjs [--src <xlsx>] [--out <xlsx>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const R = (...p) => path.join(root, ...p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const SRC = arg('--src', 'C:/Users/jerry/slp-library/Biblioteca_Visual_San_Luis_Potosi_Web.xlsx');
const OUT = arg('--out', 'C:/Users/jerry/slp-library/Biblioteca_Visual_San_Luis_Potosi_Web_ENRIQUECIDA.xlsx');
if (path.resolve(SRC) === path.resolve(OUT)) throw new Error('refusing to overwrite the original workbook');

const E = (c) => readJson(`research/entities/${c}/index.json`).records;
const REG = { altiplano: 'Altiplano', centro: 'Centro', 'zona-media': 'Zona Media', huasteca: 'Huasteca' };
const reg = (r) => REG[r] ?? (r ? r : '');
const coord = (e) => (e.latitude != null ? [e.latitude, e.longitude] : ['', '']);
const contact = (e) => [e.official_contact?.address ?? '', e.official_contact?.phone ?? ''];

// ------------------------------------------------------------------ sheets --
const sheets = [];
const add = (name, header, rows, widths) => sheets.push({ name, header, rows, widths });

const muni = E('municipalities');
add('00_README', ['Campo', 'Valor'], [
  ['Título', 'Biblioteca Visual San Luis Potosí — catálogo maestro enriquecido'],
  ['Generado', '2026-10-06 por research/scripts/entities/build-workbook.mjs'],
  ['Original', 'Biblioteca_Visual_San_Luis_Potosi_Web.xlsx (no modificado). Sus 11 hojas se conservan sin cambios al final de este libro.'],
  ['Fuente de datos para el sitio', 'research/entities/*.json (JSON). Este libro es la vista legible; si hay diferencia, manda el JSON.'],
  ['Regla de verdad', 'Ningún dato se inventa: lo desconocido queda vacío. No hay calificaciones, precios, horarios ni fechas inferidas.'],
  ['DENUE', 'Registro estadístico de INEGI: prueba que el establecimiento fue registrado, no que opere hoy ni es una recomendación.'],
  ['Estadísticas 2022', 'El folleto «El Sector Turismo» (agosto 2022) se usa solo como contexto histórico.'],
  ['Estados de fecha', 'CONFIRMED_CURRENT_YEAR · RECURRING_WITH_OFFICIAL_PATTERN · HISTORICAL_LAST_CONFIRMED_DATE · DATE_UNKNOWN'],
  ['Acceso arqueológico', 'OPEN_TO_PUBLIC (INAH) · REGISTERED_OR_DOCUMENTED · NOT_PUBLICLY_ACCESSIBLE · UNKNOWN_ACCESS'],
  ['Municipios', String(muni.length)],
], [28, 110]);

add('01_Municipios', ['ID INEGI', 'Municipio', 'Región', 'Microrregión', 'Cabecera', 'Latitud', 'Longitud', 'Altitud (m)', 'Población 2020', 'Destinos investigados', 'Museos (SIC)', 'Recintos culturales', 'Arqueología', 'Eventos', 'Hospedaje', 'Gastronomía', 'Áreas protegidas', 'Fuentes', 'Estado'],
  muni.map((m) => [m.id ?? '', m.canonical_name, reg(m.region) || 'Por confirmar', m.subcategory ?? '', m.seat?.name ?? '', m.seat?.latitude ?? '', m.seat?.longitude ?? '', m.seat?.altitude_m ?? '', m.population_2020 ?? '',
    m.counts.destinations, m.counts.museums, m.counts.venues, m.counts.archaeology, m.counts.events, m.counts.lodging, m.counts.food, m.counts.protected_areas, m.source_ids.filter(Boolean).join('; '), m.verification_status ?? '']),
  [10, 26, 12, 22, 26, 10, 11, 10, 12, 10, 10, 10, 10, 9, 10, 11, 10, 28, 12]);

const attr = E('attractions');
add('02_Destinos', ['ID', 'Nombre', 'Tipo', 'Subcategoría', 'Municipio', 'Localidad', 'Región', 'Latitud', 'Longitud', 'Estado coordenada', 'Descripción (verificada)', 'Temporada', 'Pueblo Mágico', 'Etiquetas', 'Fuentes', 'Verificación', 'Última verificación', 'Ficha SIC'],
  attr.map((a) => [a.id, a.canonical_name, a.entity_type, a.subcategory ?? '', a.municipality ?? '', a.locality ?? '', reg(a.region), ...coord(a), a.coordinate_status, a.short_description ?? '', a.seasonality ?? '', a.pueblo_magico == null ? '' : a.pueblo_magico ? 'Sí' : 'No', (a.tags ?? []).join(', '), a.source_ids.join('; '), a.verification_status, a.last_verified ?? '', a.sic_link ?? '']),
  [9, 34, 18, 20, 20, 16, 11, 10, 11, 12, 60, 30, 9, 30, 28, 12, 12, 30]);

add('03_Arqueologia', ['ID', 'Nombre', 'Otros nombres', 'Acceso', 'Municipio', 'Región', 'Latitud', 'Longitud', 'Descripción (INAH)', 'Cronología', 'Horario', 'Costo', 'Museo de sitio', 'Dirección', 'URL oficial', 'Fuentes', 'Verificación', 'Notas'],
  E('archaeology').map((a) => [a.id, a.canonical_name, a.alternate_names.join(', '), a.access_status, a.municipality ?? '', reg(a.region), ...coord(a), a.short_description ?? '', a.historical_context ?? '', a.opening_hours ?? '', a.price ?? '', a.site_museum == null ? '' : a.site_museum ? 'Sí' : 'No', a.official_contact?.address ?? '', a.official_url ?? '', a.source_ids.join('; '), a.verification_status, a.travel_notes ?? '']),
  [14, 16, 16, 18, 14, 11, 10, 11, 60, 26, 30, 36, 10, 40, 40, 30, 12, 40]);

const venueRow = (v) => [v.id, v.canonical_name, v.subcategory ?? '', v.municipality ?? '', v.locality ?? '', reg(v.region), ...coord(v), ...contact(v), v.official_url ?? '', v.operator ?? '', v.founded ?? '', v.source_ids.join('; '), v.sic_link ?? '', v.sic_modified ?? ''];
const venueHead = ['ID', 'Nombre', 'Tipo / temática', 'Municipio', 'Localidad', 'Región', 'Latitud', 'Longitud', 'Dirección', 'Teléfono', 'Web', 'Adscripción', 'Fundación', 'Fuentes', 'Ficha SIC', 'Actualización SIC'];
const venueW = [22, 40, 18, 18, 20, 11, 10, 11, 40, 18, 30, 30, 11, 18, 36, 12];
add('04_Museos', venueHead, E('museums').map(venueRow), venueW);
add('05_Recintos_Culturales', venueHead, E('cultural-venues').map(venueRow), venueW);

add('06_Festividades_Eventos', ['ID', 'Nombre', 'Tipo', 'Categoría', 'Municipio', 'Región', 'Estado de fecha', 'Patrón / cuándo', 'Regla de recurrencia', 'Meses', 'Inicio', 'Fin', 'Todo el año', 'Ventana de temporada', 'Latitud (cabecera)', 'Longitud (cabecera)', 'Notas', 'URL fuente', 'Fuentes', 'Verificación', 'Última verificación'],
  E('events').map((e) => [e.id, e.canonical_name, e.entity_type === 'seasonal-experience' ? 'Experiencia de temporada' : 'Evento', e.subcategory ?? '', e.municipality ?? '', reg(e.region), e.date_status, e.date_pattern ?? '', e.recurrence_rule ?? '', (e.months ?? []).join(', '), e.start_date ?? '', e.end_date ?? '', e.all_year ? 'Sí' : '', e.seasonal_window?.label ?? '', ...coord(e), e.notes ?? e.travel_notes ?? '', e.official_url ?? '', e.source_ids.join('; '), e.verification_status, e.last_verified ?? '']),
  [26, 44, 16, 22, 20, 11, 30, 34, 26, 12, 11, 11, 8, 20, 10, 11, 50, 40, 30, 12, 12]);

const bizHead = ['ID', 'Nombre', 'Tipo', 'Municipio', 'Localidad', 'Región', 'Latitud', 'Longitud', 'Dirección', 'Teléfono', 'Web', 'Personal ocupado (DENUE)', 'Clase SCIAN', 'Alta DENUE', 'Directorio oficial', 'Visible en el sitio', 'Fuentes', 'Recuperado'];
const bizRow = (b) => [b.id, b.canonical_name, b.subcategory ?? '', b.municipality ?? '', b.locality ?? '', reg(b.region), ...coord(b), ...contact(b), b.official_url ?? '', b.denue?.staff ?? '', b.denue?.scian ?? '', b.denue?.registered ?? '', b.official_directory ? 'Sí' : '', b.exposed === false ? 'No' : 'Sí', b.source_ids.join('; '), b.last_verified ?? ''];
const bizW = [18, 40, 30, 18, 20, 11, 10, 11, 44, 16, 30, 16, 10, 10, 10, 10, 18, 12];
add('07_Hospedaje', bizHead, E('lodging').map(bizRow), bizW);
const food = E('food-drink');
add('08_Gastronomia', bizHead, food.filter((f) => f.entity_type !== 'nightlife').map(bizRow), bizW);
add('09_Bares_Vida_Nocturna', bizHead, food.filter((f) => f.entity_type === 'nightlife').map(bizRow), bizW);
add('10_Servicios_Turisticos', bizHead, [...E('services'), ...E('recreation')].map(bizRow), bizW);

const itin = fs.readFileSync(R('src/data/itineraries.ts'), 'utf8');
const routes = [...itin.matchAll(/id: '([^']+)',\s*label: '([^']+)',\s*title: '([^']+)',\s*duration: '([^']+)',\s*regions: \[([^\]]*)\],\s*summary: '([^']+)',\s*image: '[^']+',\s*stops: \[([^\]]*)\]/g)]
  .map((m) => [m[1], m[3], m[2], m[4], m[5].replace(/'/g, ''), m[7].replace(/'/g, ''), m[6], 'Folletos oficiales (distancias); paradas verificadas']);
add('11_Rutas', ['ID', 'Título', 'Etiqueta', 'Duración', 'Regiones', 'Paradas (IDs)', 'Resumen', 'Fuente'], routes, [16, 36, 14, 18, 22, 30, 70, 36]);

add('12_Movilidad', bizHead, E('mobility').map(bizRow), bizW);

const srcAll = [...readJson('research/source-registry/sources.json').sources, ...readJson('research/source-registry/sources-pass5.json').sources, ...readJson('research/source-registry/sources-pass6.json').sources, ...readJson('research/generated/seasonal-additions-pass4.json').sources.map((s) => ({ ...s, domain: new URL(s.url).hostname, source_type: s.type, retrieval_date: s.read, verification_status: 'official' }))];
add('13_Fuentes', ['ID', 'Institución', 'Dominio', 'Título', 'URL', 'Tipo', 'Recuperado', 'Estado', 'Notas'],
  srcAll.map((s) => [s.source_id, s.institution ?? '', s.domain ?? '', s.title ?? '', s.url ?? '', s.source_type ?? '', s.retrieval_date ?? '', s.verification_status ?? '', s.notes ?? s.content ?? '']),
  [30, 34, 22, 44, 50, 18, 12, 12, 60]);

const res = readJson('research/pdf-registry/resources.json').resources;
add('14_Recursos_PDF', ['ID', 'Título', 'Institución', 'Región', 'Tipo', 'URL', 'Notas'],
  res.map((r) => [r.resource_id, r.title ?? '', r.institution ?? '', reg(r.region), r.type ?? r.resource_type ?? '', r.url ?? '', r.notes ?? '']), [26, 50, 34, 11, 14, 50, 50]);

const media = Object.values(readJson('src/data/generated/media.json').assets);
add('15_Media', ['ID', 'Lugar', 'Región', 'Destino', 'Tema', 'Autor', 'Licencia', 'Fuente', 'URL fuente', 'Ancho', 'Alto', 'Nivel', 'Atribución'],
  media.map((m) => [m.id, m.place_id ?? '', reg(m.region), m.destination ?? '', m.subject ?? '', m.author ?? '', m.licence ?? '', m.source ?? '', m.source_url ?? '', m.width, m.height, m.tier, m.attribution_text ?? '']),
  [16, 14, 11, 30, 36, 24, 14, 18, 50, 8, 8, 12, 50]);

const gaps = [
  ['Municipios', 'Villa de Pozos', 'Municipio creado en 2024: sin cabecera en ITER 2020 ni región turística oficial asignada.', 'Gobierno del Estado / INEGI'],
  ['Arqueología', 'Registro público de sitios del INAH', 'No hay datos abiertos del registro de monumentos arqueológicos; solo zonas abiertas y sitios documentados en publicaciones.', 'INAH'],
  ['Arqueología', 'Tanute', 'Documentado en revista del INAH; municipio y acceso no confirmados.', 'INAH'],
  ['Eventos', 'Festivales del SIC', 'Registrados sin fechas; requieren consulta a cada organizador.', 'SIC / organizadores'],
  ['Eventos', 'Fechas 2026', 'Xantolo, Navidad Verde y fiestas patronales sin fechas 2026 publicadas.', 'Gobierno del Estado / municipios'],
  ['Eventos', 'Quema de diablos (Ciudad del Maíz)', 'Mes no indicado en ninguna fuente leída.', 'Municipio de Ciudad del Maíz'],
  ['Hospedaje', 'DENUE', 'Registros estadísticos: falta confirmar operación actual, categoría y contacto oficial.', 'Estadía / municipios'],
  ['Gastronomía', 'Mercados', 'No hay fuente estructurada de mercados públicos con interés turístico.', 'Municipios'],
  ['Movilidad', 'Carreteras', 'Distancias oficiales disponibles por folleto; no hay red vial estructurada en esta pasada.', 'SICT / Gobierno del Estado'],
  ['Municipios', 'Sitios web municipales', 'No se recopilaron URLs oficiales de los 59 ayuntamientos.', 'Ayuntamientos'],
  ['Media', 'Fotografías', 'Ver docs/media-coverage.md: muchos municipios y recintos sin imagen con licencia libre.', 'Secretaría de Turismo (permisos)'],
];
add('16_Pendientes_Verificacion', ['Área', 'Elemento', 'Pendiente', 'Fuente sugerida'], gaps, [16, 34, 80, 32]);

// --------------------------------------------------------------- xlsx write --
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const col = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
function sheetXml({ header, rows, widths }) {
  const cell = (v, r, c, bold) => {
    const ref = `${col(c)}${r}`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    if (v === '' || v == null) return '';
    return `<c r="${ref}" t="inlineStr"${bold ? ` s="${HEADER_XF}"` : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const lines = [header, ...rows].map((row, ri) => `<row r="${ri + 1}">${row.map((v, ci) => cell(v, ri + 1, ci, ri === 0)).join('')}</row>`);
  const last = `${col(header.length - 1)}${rows.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${(widths ?? []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${lines.join('')}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
}

const z = unzipSync(fs.readFileSync(SRC));
const out = { ...z };
// one added cell style for header rows: the workbook's own bold 11-pt dark font (fontId 6)
let styles = strFromU8(z['xl/styles.xml']);
const xfCount = +/<x:cellXfs count="(\d+)"/.exec(styles)[1];
var HEADER_XF = xfCount;
styles = styles.replace(/<x:cellXfs count="\d+">/, `<x:cellXfs count="${xfCount + 1}">`).replace('</x:cellXfs>', '<x:xf numFmtId="0" fontId="6" fillId="0" borderId="0" applyFont="1" /></x:cellXfs>');
out['xl/styles.xml'] = strToU8(styles);
let wb = strFromU8(z['xl/workbook.xml']);
let rels = strFromU8(z['xl/_rels/workbook.xml.rels']);
let ct = strFromU8(z['[Content_Types].xml']);
const maxId = Math.max(...[...wb.matchAll(/sheetId="(\d+)"/g)].map((m) => +m[1]));
const firstSheetNo = Object.keys(z).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).length + 1;
const relNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
let sheetEls = '', relEls = '', ctEls = '';
sheets.forEach((s, i) => {
  const n = firstSheetNo + i, rid = `rIdCat${i + 1}`;
  out[`xl/worksheets/sheet${n}.xml`] = strToU8(sheetXml(s));
  sheetEls += `<x:sheet name="${esc(s.name)}" sheetId="${maxId + i + 1}" r:id="${rid}" xmlns:r="${relNs}" />`;
  relEls += `<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet${n}.xml" Id="${rid}" />`;
  ctEls += `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />`;
});
// catalogue sheets first, then the original sheets unchanged
wb = wb.replace('<x:sheets>', `<x:sheets>${sheetEls}`);
// filter ranges need defined names only for Excel's own UI; the autoFilter element is enough
rels = rels.replace('</Relationships>', `${relEls}</Relationships>`);
ct = ct.replace('</Types>', `${ctEls}</Types>`);
out['xl/workbook.xml'] = strToU8(wb);
out['xl/_rels/workbook.xml.rels'] = strToU8(rels);
out['[Content_Types].xml'] = strToU8(ct);
fs.writeFileSync(OUT, zipSync(out, { level: 6 }));
console.log(`wrote ${OUT}`);
for (const s of sheets) console.log(`  ${s.name.padEnd(28)} ${s.rows.length} rows`);
