// Builds the normalized tourism knowledge base under research/entities/.
//
//   node research/scripts/entities/build-entities.mjs
//
// Inputs (all local; downloaded once into research/raw/, which is git-ignored):
//   research/raw/inegi/iter_24_cpv2020_csv.zip   INEGI ITER 2020 (localities, population, seats)
//   research/raw/inegi/denue_24_csv.zip          INEGI DENUE bulk file, San Luis Potosí
//   research/raw/sic/24_*.csv                    Secretaría de Cultura, SIC open data (ISO-8859-1)
//   research/raw/inah/INAH_zonas_arqueologicas.csv  INAH open data, archaeological zones
//   research/raw/estadia/*.json                  Official lodging/food directory (Secretaría de Turismo, WP REST)
//   research/destinations/*.json, research/generated/*.json  the existing, authoritative research layer
//
// Rules:
//   - Existing research files are read, never written. Output goes to research/entities/ and
//     research/source-registry/sources-pass5.json (additive).
//   - Unknown values stay null. No ratings, prices, hours, popularity or dates are inferred.
//   - DENUE is structural evidence that an establishment was registered (with its retrieval date);
//     it is not proof that it is open today and not a recommendation.
//   - Personal e-mails are not stored. Public phone and website are stored as published.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { isValidMunicipalityId, validMunicipalityJoin } from './integrity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const R = (...p) => path.join(root, ...p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const TODAY = '2026-10-06';
const OUT = R('research/entities');

// ------------------------------------------------------------------ utils --
function parseCsv(text) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  const h = head.map((x) => x.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}
const latin1 = (buf) => new TextDecoder('latin1').decode(buf);
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (v) => { const n = Number(v); return Number.isFinite(n) && v !== '' ? n : null; };
// official websites as published, with a scheme when the source omitted it
const web = (v) => {
  const u = v == null ? '' : String(v).trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u) ? `https://${u}` : null;
};
const nz = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const coordOk = (lat, lon) => lat != null && lon != null && lat > 21.0 && lat < 24.6 && lon > -102.4 && lon < -98.2;
const small = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'a'];
function titleCase(s) {
  if (!s) return s;
  if (s !== s.toUpperCase()) return s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
    .map((w, i) => (i > 0 && small.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}
const dms = (s) => {
  const m = /(\d+)°\s*(\d+)'\s*([\d.]+)/.exec(s);
  return m ? +(+m[1] + +m[2] / 60 + +m[3] / 3600).toFixed(6) : null;
};
function write(cls, payload) {
  fs.mkdirSync(path.join(OUT, cls), { recursive: true });
  fs.writeFileSync(path.join(OUT, cls, 'index.json'), JSON.stringify(payload, null, 1) + '\n');
  console.log(`${cls.padEnd(16)} ${payload.records.length}`);
}
const base = (o) => ({
  id: null, canonical_name: null, alternate_names: [], entity_type: null, subcategory: null,
  municipality: null, municipality_id: null, locality: null, region: null,
  latitude: null, longitude: null, coordinate_status: 'unknown',
  short_description: null, long_description: null, historical_context: null, why_visit: null,
  activities: [], recommended_duration: null, seasonality: null, accessibility: null,
  opening_hours: null, price: null, official_contact: null, official_url: null, booking_url: null,
  source_ids: [], verification_status: 'unverified', last_verified: null, image_ids: [],
  related_entities: [], tags: [], travel_notes: null, ...o,
});

// ------------------------------------------------------------ municipalities --
const muniMap = readJson('research/generated/municipality-region-map.json');
const iterZip = unzipSync(fs.readFileSync(R('research/raw/inegi/iter_24_cpv2020_csv.zip')));
const iter = parseCsv(strFromU8(iterZip['iter_24_cpv2020/conjunto_de_datos/conjunto_de_datos_iter_24CSV20.csv']));
const muniTotal = new Map(iter.filter((r) => r.LOC === '0000').map((r) => [`24${r.MUN}`, r]));
// the seat is locality 0001, or (Villa de Arista) the locality that carries the municipality's name
const muniSeat = new Map(iter.filter((r) => r.LOC === '0001').map((r) => [`24${r.MUN}`, r]));
for (const r of iter) if (r.LOC !== '0000' && r.NOM_LOC === r.NOM_MUN && !muniSeat.has(`24${r.MUN}`)) muniSeat.set(`24${r.MUN}`, r);
const muniByCve = new Map(muniMap.municipalities.filter((m) => isValidMunicipalityId(m.inegi_cve)).map((m) => [m.inegi_cve, m]));
const muniName = (cve) => muniByCve.get(cve)?.municipality ?? null;
const regionOf = (cve) => muniByCve.get(cve)?.region ?? null;
const cveOf = (munId) => `24${String(munId).padStart(3, '0')}`;

// researched destinations by municipality (verified municipality values only)
const destFiles = fs.readdirSync(R('research/destinations')).filter((f) => /^[ACHM]\d\d\.json$/.test(f));
const dests = destFiles.map((f) => readJson(`research/destinations/${f}`));
const geo = JSON.parse(fs.readFileSync(R('research/generated/maplibre-places.geojson'), 'utf8'));
const geoById = new Map(geo.features.map((f) => [f.properties.place_id, f]));
const isV = (f) => f && f.status === 'verified' && f.value != null;
const muniCveByName = new Map(muniMap.municipalities.map((m) => [slugify(m.municipality), m.inegi_cve]));
const cveByName = (n) => (n ? muniCveByName.get(slugify(n)) ?? null : null);

// ------------------------------------------------------------- attractions --
const attractions = [];
for (const d of dests) {
  const f = geoById.get(d.place_id);
  const muni = isV(d.municipality) ? d.municipality.value : null;
  attractions.push(base({
    id: d.place_id, canonical_name: d.name, entity_type: 'destination', subcategory: d.type ?? null,
    municipality: muni, municipality_id: cveByName(muni), region: isV(d.region) ? d.region.value : null,
    latitude: f ? f.geometry.coordinates[1] : null, longitude: f ? f.geometry.coordinates[0] : null,
    coordinate_status: f ? (f.properties.map_status === 'ready' ? 'verified' : 'approximate') : 'unavailable',
    short_description: isV(d.description) ? d.description.value : null,
    seasonality: isV(d.season) ? d.season.value : null,
    source_ids: [...new Set([...(d.official_source ?? []), isV(d.description) ? d.description.source : null].filter(Boolean))],
    verification_status: isV(d.description) ? 'verified' : 'partial', last_verified: d.description?.verifiedAt ?? null,
    image_ids: d.media_selected ?? [], tags: d.interest_tags?.value ?? [],
    pueblo_magico: isV(d.pueblo_magico) ? !!d.pueblo_magico.value : null,
    research_file: `research/destinations/${d.place_id}.json`,
  }));
}

// SIC declarations: protected areas, natural monuments, sacred natural sites, intangible heritage
const sicRead = (t) => {
  const p = R(`research/raw/sic/24_${t}.csv`);
  const buf = fs.readFileSync(p);
  return buf.length ? parseCsv(latin1(buf)) : [];
};
const sicSrc = (t) => `sic-${t.replace(/_/g, '-')}`;
const declar = sicRead('otra_declaratoria');
const natural = /Monumento Natural|Reserva|Parque|Área|Area|Sitio Sagrado/i;
for (const r of declar) {
  const cve = cveOf(r.municipio_id);
  const lat = num(r.gmaps_latitud), lon = num(r.gmaps_longitud);
  const isNature = natural.test(r.otra_declaratoria_nombre);
  attractions.push(base({
    id: `sic-decl-${r.otra_declaratoria_id}`, canonical_name: r.otra_declaratoria_nombre.replace(/\s+/g, ' ').trim(),
    entity_type: isNature ? 'protected-area' : 'heritage-declaration',
    subcategory: isNature ? (/Sitio Sagrado/i.test(r.otra_declaratoria_nombre) ? 'Sitio sagrado natural' : /Monumento Natural/i.test(r.otra_declaratoria_nombre) ? 'Monumento natural' : 'Área natural protegida') : 'Declaratoria de patrimonio',
    municipality: muniName(cve), municipality_id: cve, locality: nz(r.nom_loc) === 'Total del Municipio' ? null : nz(r.nom_loc), region: regionOf(cve),
    latitude: coordOk(lat, lon) ? lat : null, longitude: coordOk(lat, lon) ? lon : null,
    coordinate_status: coordOk(lat, lon) ? 'approximate' : 'unavailable',
    historical_context: nz(r.otra_declaratoria_ano_inscripcion) ? `Declaratoria inscrita en ${r.otra_declaratoria_ano_inscripcion} (SIC).` : null,
    official_url: web(r.otra_declaratoria_pagina_web), source_ids: [sicSrc('otra_declaratoria')],
    verification_status: 'listed', last_verified: TODAY, sic_link: nz(r.link_sic), sic_modified: nz(r.fecha_mod)?.slice(0, 10) ?? null,
  }));
}
for (const r of sicRead('catedral')) {
  const cve = cveOf(r.municipio_id);
  const lat = num(r.gmaps_latitud), lon = num(r.gmaps_longitud);
  attractions.push(base({
    id: `sic-catedral-${r.catedral_id}`, canonical_name: r.catedral_nombre.trim(), entity_type: 'religious-landmark', subcategory: 'Catedral',
    municipality: muniName(cve), municipality_id: cve, locality: nz(r.nom_loc), region: regionOf(cve),
    latitude: coordOk(lat, lon) ? lat : null, longitude: coordOk(lat, lon) ? lon : null, coordinate_status: coordOk(lat, lon) ? 'approximate' : 'unavailable',
    official_contact: { address: [nz(r.catedral_calle_numero), nz(r.catedral_colonia), nz(r.catedral_cp)].filter(Boolean).join(', ') || null, phone: nz(r.catedral_telfono1) },
    official_url: web(r.pagina_web), source_ids: [sicSrc('catedral')], verification_status: 'listed', last_verified: TODAY, sic_link: nz(r.link_sic),
  }));
}

// ----------------------------------------------------------- archaeology ----
const inahZones = parseCsv(fs.readFileSync(R('research/raw/inah/INAH_zonas_arqueologicas.csv'), 'utf8')).filter((r) => r.estado === 'San Luis Potosí');
const sicZones = sicRead('zona_arqueologica');
const INAH_DETAIL = {
  Tamtoc: {
    id: 'arq-tamtoc', place: 'H16', alt: [],
    short: 'En la Huasteca potosina (900-1100), con importante comercio fluvial, destacan sus pirámides, monolitos, estelas, pintura mural, uso del calendario, arquitectura de edificios circulares y asombrosas esculturas en piedra, como la Venus de Tamtoc.',
    chronology: '900–1100 d. C. (según Lugares INAH)',
    hours: 'Lunes a domingo de 09:00 a 18:00 h; último acceso 17:00 h',
    price: 'Sin costo para visitantes nacionales y extranjeros (Lugares INAH, consultado el 2026-10-06)',
    services: ['Estacionamiento', 'Módulo de información', 'Sanitarios'],
    url: 'https://lugares.inah.gob.mx/es/node/4460',
  },
  Tamohi: {
    id: 'arq-tamohi', place: null, alt: ['El Consuelo', 'Tamohí'],
    short: 'Importante centro huasteco (1100-1300). Pintura mural, finos trabajos sobre concha y caracol marino, alfarería, orfebrería y esculturas como El adolescente huasteco, hablan de la refinada estética de esta cultura.',
    chronology: '1100–1300 d. C. (según Lugares INAH)',
    hours: 'Lunes a domingo de 09:00 a 18:00 h; último acceso 17:00 h',
    price: 'Sin costo para visitantes nacionales y extranjeros (Lugares INAH, consultado el 2026-10-06)',
    services: [],
    url: 'https://lugares.inah.gob.mx/es/node/4527',
  },
};
const archaeology = [];
for (const z of inahZones) {
  const det = INAH_DETAIL[z.nombre];
  const sic = sicZones.find((s) => s.zona_arqueologica_nombre.startsWith(z.nombre));
  const lat = sic ? num(sic.gmaps_latitud) : null, lon = sic ? num(sic.gmaps_longitud) : null;
  const cve = sic ? cveOf(sic.municipio_id) : cveByName('Tamuín');
  archaeology.push(base({
    id: det.id, canonical_name: z.nombre === 'Tamohi' ? 'Tamohí' : z.nombre, alternate_names: det.alt, entity_type: 'archaeological-site',
    subcategory: 'Zona arqueológica', access_status: z.condicion === 'Abierta' ? 'OPEN_TO_PUBLIC' : 'UNKNOWN_ACCESS',
    municipality: muniName(cve), municipality_id: cve, region: regionOf(cve),
    latitude: coordOk(lat, lon) ? lat : null, longitude: coordOk(lat, lon) ? lon : null, coordinate_status: coordOk(lat, lon) ? 'approximate' : 'unavailable',
    short_description: det.short, historical_context: det.chronology, opening_hours: det.hours, price: det.price,
    site_museum: z.museo_sitio === 'Si', intro_room: z.sala_introductoria === 'Si', services: det.services,
    official_contact: { address: z.ubicacion_fisica, responsible: z.responsables }, official_url: det.url,
    source_ids: ['inah-datos-zonas-arqueologicas', 'inah-lugares', sicSrc('zona_arqueologica')],
    verification_status: 'verified', last_verified: TODAY, related_entities: det.place ? [det.place] : [],
  }));
}
archaeology.push(base({
  id: 'arq-tanute', canonical_name: 'Tanute', entity_type: 'archaeological-site', subcategory: 'Sitio arqueológico documentado',
  access_status: 'UNKNOWN_ACCESS', region: 'huasteca',
  short_description: 'Asentamiento de larga duración en la Huasteca potosina, estudiado en relación con la provincia tributaria mexica de Oxitipa; alcanzó su máxima extensión a inicios del siglo XVI.',
  historical_context: 'Kroefges, Schulze, Hernández Correa y García Morales, «Oxitipa y el sitio arqueológico de Tanute, Huasteca potosina», Arqueología (INAH), núm. 65.',
  official_url: 'https://revistas.inah.gob.mx/index.php/arqueologia/article/view/21582',
  source_ids: ['inah-revista-arqueologia-tanute'], verification_status: 'documented', last_verified: TODAY,
  travel_notes: 'Documentado en una publicación del INAH. No consta que esté abierto al público: no se presenta como atractivo visitable.',
}));

// ------------------------------------------------------- museums & venues ----
const sicVenue = (t, type, sub, prefix) => sicRead(t).map((r) => {
  const cve = cveOf(r.municipio_id);
  const lat = num(r.gmaps_latitud), lon = num(r.gmaps_longitud);
  const id = r[`${prefix}_id`];
  return base({
    id: `sic-${t.replace(/_/g, '-')}-${id}`, canonical_name: r[`${prefix}_nombre`].replace(/\s+/g, ' ').trim(),
    entity_type: type, subcategory: sub(r),
    municipality: muniName(cve), municipality_id: cve, locality: nz(r.nom_loc) === 'Total del Municipio' ? null : nz(r.nom_loc), region: regionOf(cve),
    latitude: coordOk(lat, lon) ? lat : null, longitude: coordOk(lat, lon) ? lon : null, coordinate_status: coordOk(lat, lon) ? 'approximate' : 'unavailable',
    official_contact: {
      address: [nz(r[`${prefix}_calle_numero`]), nz(r[`${prefix}_colonia`]), nz(r[`${prefix}_cp`])].filter(Boolean).join(', ') || null,
      phone: nz(r[`${prefix}_telefono1`] ?? r[`${prefix}_telfono1`]),
    },
    official_url: web(r.pagina_web) ?? web(r.facebook) ?? null,
    founded: nz(r[`${prefix}_fecha_fundacion`])?.startsWith('1000') ? null : nz(r[`${prefix}_fecha_fundacion`]),
    operator: nz(r[`${prefix}_adscripcion`]),
    source_ids: [sicSrc(t)], verification_status: 'listed', last_verified: TODAY,
    sic_link: nz(r.link_sic), sic_modified: nz(r.fecha_mod)?.slice(0, 10) ?? null,
    capacity: num(r[`${prefix}_aforo`]) || null,
  });
});
const museums = sicVenue('museo', 'museum', (r) => nz(r.museo_tematica_n1), 'museo');
// INAH museum not always in SIC under the same name
if (!museums.some((m) => /Regional Potosino/i.test(m.canonical_name))) {
  museums.push(base({ id: 'inah-museo-regional-potosino', canonical_name: 'Museo Regional Potosino', entity_type: 'museum', subcategory: 'Antropología e historia', municipality: 'San Luis Potosí', municipality_id: '24028', region: 'centro', official_url: 'https://lugares.inah.gob.mx/en/node/4255', source_ids: ['inah-lugares'], verification_status: 'listed', last_verified: TODAY }));
}
const venues = [
  ...sicVenue('teatro', 'cultural-venue', () => 'Teatro', 'teatro'),
  ...sicVenue('centro_cultural', 'cultural-venue', () => 'Centro cultural', 'centro_cultural'),
  ...sicVenue('galeria', 'cultural-venue', () => 'Galería', 'galeria'),
  ...sicVenue('auditorio', 'cultural-venue', () => 'Auditorio', 'auditorio'),
  ...sicVenue('casa_artesania', 'cultural-venue', () => 'Casa o tienda de artesanía', 'casa_artesania'),
];

// ----------------------------------------------------------------- DENUE ----
const denueZip = unzipSync(fs.readFileSync(R('research/raw/inegi/denue_24_csv.zip')));
const denue = parseCsv(latin1(denueZip['conjunto_de_datos/denue_inegi_24_.csv']));
const DENUE_CLASSES = {
  // lodging
  721111: ['lodging', 'Hotel con otros servicios'], 721112: ['lodging', 'Hotel'], 721113: ['lodging', 'Motel'],
  721190: ['lodging', 'Cabañas, villas y similares'], 721210: ['lodging', 'Campamento o albergue recreativo'],
  721311: ['lodging', 'Pensión o casa de huéspedes'], 721312: ['lodging', 'Departamento o casa amueblada con servicios de hotelería'],
  // food & drink
  722511: ['food', 'Restaurante a la carta o comida corrida'], 722512: ['food', 'Restaurante de pescados y mariscos'],
  722515: ['cafe', 'Cafetería'], 722411: ['nightlife', 'Centro nocturno o discoteca'], 722412: ['nightlife', 'Bar o cantina'],
  312145: ['drink', 'Elaboración de mezcal'], 312149: ['drink', 'Otras bebidas destiladas'], 312131: ['drink', 'Vino'], 312132: ['drink', 'Pulque'], 312120: ['drink', 'Cerveza'],
  // culture & recreation
  712111: ['museum', 'Museo privado'], 712112: ['museum', 'Museo público'], 712190: ['recreation', 'Gruta, parque natural o sitio del patrimonio'],
  713113: ['recreation', 'Parque acuático o balneario (privado)'], 713114: ['recreation', 'Parque acuático o balneario (público)'],
  // services & mobility
  561510: ['service', 'Agencia de viajes'], 561520: ['service', 'Organización de excursiones y paquetes turísticos'], 561590: ['service', 'Otros servicios de reservaciones'],
  488112: ['mobility', 'Aeropuerto'], 488491: ['mobility', 'Central camionera'],
};
const BIG = (p) => p && !/^0 a 5/.test(p);
const denueRec = (r, cls, label) => {
  const cve = `24${r.cve_mun}`;
  const lat = num(r.latitud), lon = num(r.longitud);
  const addr = [[r.tipo_vial !== 'NINGUNO' ? titleCase(r.tipo_vial) : null, titleCase(r.nom_vial), r.numero_ext && r.numero_ext !== '0' ? r.numero_ext : null].filter(Boolean).join(' '),
    titleCase(nz(r.nomb_asent)), nz(r.cod_postal) ? `C.P. ${r.cod_postal}` : null].filter(Boolean).join(', ');
  const www = nz(r.www);
  return base({
    id: `denue-${r.id}`, canonical_name: titleCase(r.nom_estab), entity_type: cls, subcategory: label,
    municipality: muniName(cve) ?? r.municipio, municipality_id: cve, locality: titleCase(nz(r.localidad)), region: regionOf(cve),
    latitude: coordOk(lat, lon) ? lat : null, longitude: coordOk(lat, lon) ? lon : null, coordinate_status: coordOk(lat, lon) ? 'registry' : 'unavailable',
    official_contact: { address: addr || null, phone: nz(r.telefono) },
    official_url: www ? (/^https?:/i.test(www) ? www : `https://${www.toLowerCase()}`) : null,
    source_ids: ['inegi-denue'], verification_status: 'registry', last_verified: TODAY,
    denue: { id: r.id, clee: r.clee, scian: r.codigo_act, activity: r.nombre_act, staff: r.per_ocu, registered: r.fecha_alta },
  });
};
const byClass = {};
for (const r of denue) {
  const c = DENUE_CLASSES[r.codigo_act];
  if (!c) continue;
  // cafés: only establishments that call themselves café (the class also groups ice-cream and soda shops)
  if (c[0] === 'cafe' && !/CAF[EÉ]|COFFEE|CAFETER/i.test(r.nom_estab)) continue;
  (byClass[c[0]] ??= []).push(denueRec(r, c[0], c[1]));
}

// ------------------------------------------------- official Estadía directory --
const estadia = readJson('research/raw/estadia/p1.json');
const tax = Object.fromEntries(['at_biz_dir-category', 'at_biz_dir-location'].map((t) => [t, Object.fromEntries(readJson(`research/raw/estadia/${t}.json`).map((x) => [x.id, x.name]))]));
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#8211;/g, '–').replace(/&#8217;/g, '’').replace(/&#8220;|&#8221;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// listings without a location term name their town in the official description
const ALIAS = { 'Real de Catorce': 'Catorce', 'capital potosina': 'San Luis Potosí', 'Centro Histórico de San Luis Potosí': 'San Luis Potosí' };
const byLength = muniMap.municipalities.map((m) => m.municipality).filter((n) => n !== 'San Luis Potosí').sort((a, b) => b.length - a.length);
function townFromText(t) {
  for (const n of byLength) if (t.includes(n)) return n;
  for (const [k, v] of Object.entries(ALIAS)) if (t.includes(k)) return v;
  return /San Luis Potos/.test(t) ? 'San Luis Potosí' : null;
}
const estadiaRecs = estadia.map((x) => {
  const isHotel = x.class_list.includes('atbdp_listing_types-hotels');
  const locTerm = (x['at_biz_dir-location'] ?? []).map((i) => tax['at_biz_dir-location'][i]).find(Boolean)?.replace(/^\(H\)/, '') ?? null;
  const locName = locTerm ?? townFromText(strip(x.content.rendered));
  const cve = cveByName(locName);
  const cat = (x['at_biz_dir-category'] ?? []).map((i) => tax['at_biz_dir-category'][i]).filter(Boolean);
  return base({
    id: `estadia-${x.id}`, canonical_name: strip(x.title.rendered), entity_type: isHotel ? 'lodging' : /Bar|Cervecer/i.test(cat.join()) ? 'nightlife' : /Cafeter/i.test(cat.join()) ? 'cafe' : 'food',
    subcategory: cat.join(' · ') || null, municipality: cve ? muniName(cve) : locName, municipality_id: cve, region: cve ? regionOf(cve) : null,
    short_description: strip(x.content.rendered) || null, official_url: x.link,
    source_ids: ['estadia-visitaslp'], verification_status: 'official-directory', last_verified: TODAY, official_directory: true,
    municipality_from: locTerm ? 'directory-location' : locName ? 'directory-description' : null,
  });
});

// ------------------------------------------------------------------ events --
// One normalized events dataset for every view (Eventos, Temporadas, municipalities, home).
// date_status: CONFIRMED_CURRENT_YEAR · RECURRENT_OFFICIAL_PATTERN · HISTORICAL_LAST_CONFIRMED ·
// DATE_PENDING (dated events) · ALL_YEAR · SEASONAL_WINDOW (seasonal experiences, from the
// official seasonal records). Patterns never become 2026 dates.
const evBase = readJson('research/generated/events.json').events;
const evAdd = readJson('research/generated/seasonal-additions-pass4.json').events;
const ev6 = readJson('research/generated/events-additions-pass6.json');
const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const monthsIn = (s) => [...new Set(Object.entries(MONTHS).filter(([k]) => (s ?? '').toLowerCase().includes(k)).map(([, v]) => v))];
const seatOf = (cve) => { const s = cve ? muniSeat.get(cve) : null; return s ? { lat: dms(s.LATITUD), lon: -dms(s.LONGITUD) } : null; };
const EV_PATTERN = {
  'ev-procesion-silencio': ['CONFIRMED_CURRENT_YEAR', 'Viernes Santo (fecha móvil)', [3, 4], 'FREQ=YEARLY;Viernes Santo'],
  'ev-fenapo': ['CONFIRMED_CURRENT_YEAR', 'Agosto', [8], 'FREQ=YEARLY;agosto'],
  'ev-lila-lopez': ['CONFIRMED_CURRENT_YEAR', 'Finales de julio – inicios de agosto', [7, 8], 'FREQ=YEARLY;jul–ago'],
  // official cycle from the Secretaría de Turismo (Día de Muertos · Xantolo page)
  'ev-xantolo': ['RECURRENT_OFFICIAL_PATTERN', 'Del 29 de septiembre (San Miguel) al 30 de noviembre (San Andrés); la fiesta grande, 1 y 2 de noviembre', [9, 10, 11], 'FREQ=YEARLY;29 sep–30 nov'],
  'ev-san-francisco-catorce': ['RECURRENT_OFFICIAL_PATTERN', 'Cada 4 de octubre', [10], 'FREQ=YEARLY;4 oct'],
  'ev-asuncion-tlaxcala': ['RECURRENT_OFFICIAL_PATTERN', 'Agosto', [8], 'FREQ=YEARLY;agosto'],
  'ev-san-miguel-tancanhuitz': ['RECURRENT_OFFICIAL_PATTERN', 'Del 25 al 29 de septiembre (CEFIM)', [9], 'FREQ=YEARLY;25–29 sep'],
  'ev-semana-santa-tancanhuitz': ['RECURRENT_OFFICIAL_PATTERN', 'Semana Santa; octubre–noviembre (Xantolo)', [3, 4, 10, 11], 'FREQ=YEARLY;Semana Santa y Xantolo'],
  'ev-semana-santa-xiiui': ['RECURRENT_OFFICIAL_PATTERN', 'Semana Santa (fecha móvil)', [3, 4], 'FREQ=YEARLY;Semana Santa'],
  'ev-quema-diablos': ['DATE_PENDING', null, [], null],
  'ev-san-juan-cerritos': ['RECURRENT_OFFICIAL_PATTERN', 'Cada 24 de junio (fiestas del 16 al 24, CEFIM)', [6], 'FREQ=YEARLY;16–24 jun'],
  'ev-san-nicolas-tolentino': ['RECURRENT_OFFICIAL_PATTERN', 'Inicia el 10 de diciembre', [12], 'FREQ=YEARLY;desde 10 dic'],
  'ev-fiestas-tierra-nueva': ['RECURRENT_OFFICIAL_PATTERN', 'Septiembre', [9], 'FREQ=YEARLY;septiembre'],
  'ev-navidad-verde': ['HISTORICAL_LAST_CONFIRMED', 'Diciembre a inicios de enero', [12], null],
};
// research events whose 2025/2026 dates are past keep them as confirmed history
const EV_CAT = { 'religiosa / cultural': 'Tradición religiosa', feria: 'Feria', 'festival cultural': 'Festival cultural', 'tradición / patrimonio inmaterial': 'Tradición y patrimonio vivo', 'religiosa / peregrinación': 'Peregrinación', 'fiesta patronal': 'Fiesta patronal', tradición: 'Tradición', 'tradición indígena': 'Tradición indígena', 'fiesta patronal / feria': 'Fiesta patronal y feria', fiesta: 'Fiesta', naturaleza: 'Naturaleza' };
const evRecord = (o) => {
  const cve = o.municipality_id;
  const seat = seatOf(cve);
  return base({
    entity_type: 'event', start_date: null, end_date: null, recurrence_rule: null, seasonal_window: null, all_year: false,
    cultural_context: null, venue: null,
    latitude: seat?.lat ?? null, longitude: seat?.lon ?? null, coordinate_status: seat ? 'municipal-seat' : 'unavailable',
    last_verified: TODAY, ...o,
  });
};
const events = [...evBase, ...evAdd].filter((e) => e.event_id !== 'ev-el-salto-temporada').map((e) => {
  const [status, pattern, months, rule] = EV_PATTERN[e.event_id] ?? ['DATE_PENDING', null, monthsIn(e.typical_month), null];
  const muniCve = cveByName(e.municipality?.replace(/\s*\(.*\)/, '').split(' y ')[0]);
  const [s, en] = String(e['2026_date_if_confirmed'] ?? '').split('/');
  return evRecord({
    id: e.event_id, canonical_name: e.event_name, subcategory: EV_CAT[e.category] ?? e.category ?? null,
    municipality: muniCve ? muniName(muniCve) : e.municipality, municipality_id: muniCve, region: e.region,
    date_status: status, date_pattern: pattern, months, recurrence_rule: rule,
    start_date: s ? s.slice(0, 10) : null, end_date: en ? en.slice(0, 10) : s ? s.slice(0, 10) : null,
    confirmed_dates: e['2026_date_if_confirmed'] ?? null, notes: e.notes ?? null,
    official_url: e.source_url ?? null, source_ids: [e.source_id, ...(e.event_id === 'ev-xantolo' ? ['turismo-slp-dia-de-muertos'] : [])], verification_status: e.verification_status,
    related_entities: e.destination ? [e.destination] : [],
  });
});
// pass 6: CEFIM municipal festivities, 2025 Xantolo programmes, 2026 editions
for (const e of ev6.events) {
  const cve = cveByName(e.municipality);
  events.push(evRecord({
    id: e.event_id, canonical_name: e.event_name, subcategory: e.category,
    municipality: cve ? muniName(cve) : e.municipality ?? null, municipality_id: cve, region: cve ? regionOf(cve) : null,
    date_status: e.date_status, date_pattern: e.typical_month, months: e.months, recurrence_rule: e.recurrence_rule,
    start_date: e.start_date, end_date: e.end_date,
    confirmed_dates: e.date_status === 'CONFIRMED_CURRENT_YEAR' && e.start_date ? `${e.start_date}${e.end_date && e.end_date !== e.start_date ? `/${e.end_date}` : ''}` : null,
    notes: e.notes, official_url: e.source_url, source_ids: [e.source_id], verification_status: e.verification_status,
  }));
}
// SIC festivals (no dates in the open data)
for (const r of sicRead('festival')) {
  const name = r.festival_nombre.replace(/\s+/g, ' ').trim();
  if (events.some((e) => slugify(e.canonical_name).includes(slugify(name).slice(0, 30)) || /Lila L[oó]pez/i.test(name) && e.id === 'ev-lila-lopez' || /FENAHUAP/i.test(name) && e.id === 'slp-gob-fenahuap-2026')) continue;
  const where = /Real de Catorce|WIRD/i.test(name) ? 'Catorce' : /Huasteca|FENAHUAP/i.test(name) ? null : /Xilitla/i.test(name) ? 'Xilitla' : /Desierto del Altiplano/i.test(name) ? null : 'San Luis Potosí';
  const cve = cveByName(where);
  events.push(evRecord({
    id: `sic-festival-${r.festival_id}`, canonical_name: name, subcategory: 'Festival',
    municipality: cve ? muniName(cve) : null, municipality_id: cve, region: cve ? regionOf(cve) : /Huasteca/i.test(name) ? 'huasteca' : /Altiplano/i.test(name) ? 'altiplano' : null,
    date_status: num(r.festival_fecha_inicio) ? 'HISTORICAL_LAST_CONFIRMED' : 'DATE_PENDING', date_pattern: null, months: [],
    official_url: web(r.pagina_web), source_ids: [sicSrc('festival')], verification_status: 'listed',
    sic_link: nz(r.link_sic), sic_modified: nz(r.fecha_mod)?.slice(0, 10) ?? null,
    travel_notes: 'Registrado en el Sistema de Información Cultural sin fechas. Consulta la fuente antes de viajar.',
  }));
}
// intangible heritage practices (SIC) that are celebrations; a CEFIM pattern for the same
// celebration wins (Santiago Apóstol in Tampamolón) and keeps SIC as a second source
for (const r of sicRead('frpintangible')) {
  const name = r.frpintangible_nombre.replace(/\s+/g, ' ').trim();
  if (!name || !/Fiesta|Semana Santa|Xantolo|peregrinaci|Danza|Todos Santos/i.test(name)) continue;
  const cve = cveOf(r.municipio_id);
  const twin = events.find((e) => validMunicipalityJoin(e.municipality_id, cve) && /Santiago/i.test(name) && /Santiago/i.test(e.canonical_name));
  if (twin) { twin.source_ids.push(sicSrc('frpintangible')); continue; }
  events.push(evRecord({
    id: `sic-pci-${r.frpintangible_id}`, canonical_name: name, subcategory: 'Patrimonio cultural inmaterial',
    municipality: muniName(cve), municipality_id: cve, region: regionOf(cve),
    date_status: /Semana Santa|Xantolo|Todos Santos/i.test(name) ? 'RECURRENT_OFFICIAL_PATTERN' : 'DATE_PENDING',
    months: /Semana Santa/i.test(name) ? [3, 4] : /Xantolo|Todos Santos/i.test(name) ? [10, 11] : [],
    date_pattern: /Semana Santa/i.test(name) ? 'Semana Santa (fecha móvil)' : /Xantolo|Todos Santos/i.test(name) ? 'Fines de octubre – inicios de noviembre' : null,
    source_ids: [sicSrc('frpintangible')], verification_status: 'listed', sic_link: nz(r.link_sic),
  }));
}
// Seasonal experiences: not events. From the official seasonal records (research layer), plus one
// CEFIM statement. ALL_YEAR when the source says so; SEASONAL_WINDOW for a recommended window.
const seasonalRecs = readJson('research/generated/seasonal-calendar.json').records;
const SEASONAL = [
  ['se-media-luna', 'Media Luna: nadar y bucear todo el año', 'ALL_YEAR', null],
  ['se-golondrinas', 'Sótano de las Golondrinas y Hoya de las Huahuas: aves, senderismo y espeleología', 'ALL_YEAR', null],
  ['se-tamul', 'Temporada para apreciar la Cascada de Tamul', 'SEASONAL_WINDOW', { from: 11, to: 3, label: 'De noviembre a marzo' }],
  ['se-el-naranjo', 'Buena temporada para las cascadas de El Naranjo', 'SEASONAL_WINDOW', { from: 11, to: 3, label: 'De noviembre a marzo' }],
  ['se-el-salto', 'La Cascada El Salto corre en lluvias y Semana Santa', 'SEASONAL_WINDOW', { from: null, to: null, label: 'Temporada de lluvias y Semana Santa' }],
];
for (const [rid, name, status, win] of SEASONAL) {
  const r = seasonalRecs.find((x) => x.record_id === rid);
  if (!r) continue;
  const place = String(r.destination).split('|')[0];
  const d = attractions.find((a) => a.id === place);
  events.push(evRecord({
    id: `exp-${rid.replace(/^se-/, '')}`, canonical_name: name, entity_type: 'seasonal-experience',
    subcategory: status === 'ALL_YEAR' ? 'Todo el año' : 'Temporada recomendada',
    municipality: d?.municipality ?? null, municipality_id: d?.municipality_id ?? null, region: r.region,
    latitude: d?.latitude ?? null, longitude: d?.longitude ?? null, coordinate_status: d?.coordinate_status ?? 'unavailable',
    date_status: status, all_year: status === 'ALL_YEAR', seasonal_window: win, months: status === 'ALL_YEAR' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : r.months,
    date_pattern: status === 'ALL_YEAR' ? 'Todo el año' : win.label, source_ids: [r.source_id], verification_status: 'verified',
    related_entities: String(r.destination).split('|'),
  }));
}
{
  const cve = cveByName('Venado');
  events.push(evRecord({
    id: 'exp-venado-ojo-de-agua', canonical_name: 'Balneario Ojo de Agua de Venado', entity_type: 'seasonal-experience', subcategory: 'Todo el año',
    municipality: 'Venado', municipality_id: cve, region: regionOf(cve), date_status: 'ALL_YEAR', all_year: true,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], date_pattern: 'Todo el año',
    short_description: 'El balneario Ojo de Agua recibe turistas todo el año (infografía municipal del CEFIM).',
    source_ids: ['cefim-infografias-2022'], verification_status: 'verified', related_entities: ['A14'],
  }));
}

// ---------------------------------------------------------- services/mobility --
const guides = readJson('research/generated/tour-guides-research.json');
const services = [
  ...(byClass.service ?? []),
  base({ id: 'svc-sectur-guias', canonical_name: 'Directorio nacional de guías de turistas acreditados (SECTUR)', entity_type: 'service', subcategory: 'Verificación de guías',
    official_url: guides.sources.find((s) => s.source_id === 'sectur-guias-directorio')?.url ?? null, source_ids: ['sectur-guias-directorio'], verification_status: 'official', last_verified: TODAY,
    short_description: 'Directorio oficial de guías acreditados (NOM-08-TUR-2002 y NOM-09-TUR-2002), filtrable por estado, municipio, tipo de guía e idioma.' }),
];
// the bus-station class also holds unrelated offices: keep named terminals and airports
const mobility = (byClass.mobility ?? []).filter((m) => /central|terminal|aeropuerto/i.test(m.canonical_name));

// ------------------------------------------------------------------ routes --
// suggested routes live in src/data/itineraries.ts (verified stops, brochure distances); referenced here
const routes = [{ id: 'site-itineraries', canonical_name: 'Rutas sugeridas del sitio', entity_type: 'route-set', definition: 'src/data/itineraries.ts', note: 'Editorial sequences of verified destinations; distances from official brochure tables. Real road routing is out of scope for this pass.' }];

// --------------------------------------------------------- municipalities --
const all = [...attractions, ...archaeology, ...museums, ...venues, ...events, ...estadiaRecs, ...Object.values(byClass).flat()];
const countFor = (cve, pred) => isValidMunicipalityId(cve) ? all.filter((e) => validMunicipalityJoin(e.municipality_id, cve) && pred(e)).length : null;
const municipalities = muniMap.municipalities.map((m) => {
  const t = muniTotal.get(m.inegi_cve), s = muniSeat.get(m.inegi_cve);
  const lat = s ? dms(s.LATITUD) : null, lon = s ? -dms(s.LONGITUD) : null;
  const ds = attractions.filter((a) => validMunicipalityJoin(a.municipality_id, m.inegi_cve) && a.entity_type === 'destination').map((a) => a.id);
  return base({
    id: m.inegi_cve, canonical_name: m.municipality, slug: slugify(m.municipality), entity_type: 'municipality', subcategory: m.microregion ?? null,
    municipality: m.municipality, municipality_id: m.inegi_cve, region: m.region,
    seat: s ? { name: s.NOM_LOC, latitude: lat, longitude: lon, altitude_m: num(s.ALTITUD), source: 'INEGI ITER 2020' } : null,
    latitude: lat, longitude: lon, coordinate_status: lat ? 'verified' : 'unavailable',
    population_2020: t ? num(t.POBTOT) : null,
    source_ids: [m.source, 'inegi-iter-2020'], verification_status: m.verification_status, last_verified: TODAY,
    related_entities: ds,
    counts: {
      destinations: isValidMunicipalityId(m.inegi_cve) ? ds.length : null,
      museums: countFor(m.inegi_cve, (e) => e.entity_type === 'museum' && e.source_ids[0]?.startsWith('sic')),
      venues: countFor(m.inegi_cve, (e) => e.entity_type === 'cultural-venue'),
      archaeology: countFor(m.inegi_cve, (e) => e.entity_type === 'archaeological-site'),
      events: countFor(m.inegi_cve, (e) => e.entity_type === 'event'),
      seasonal: countFor(m.inegi_cve, (e) => e.entity_type === 'seasonal-experience'),
      lodging: countFor(m.inegi_cve, (e) => e.entity_type === 'lodging'),
      food: countFor(m.inegi_cve, (e) => ['food', 'cafe', 'drink'].includes(e.entity_type)),
      protected_areas: countFor(m.inegi_cve, (e) => e.entity_type === 'protected-area'),
    },
  });
});

// ------------------------------------------------------------------ write ---
const meta = (rule) => ({ generated: TODAY, rule });
write('municipalities', { ...meta('59 municipalities (PDU-SLP regions; INEGI ITER 2020 seat and population).'), records: municipalities });
write('attractions', { ...meta('Researched destinations (research/destinations, authoritative) plus SIC declarations (protected areas, sacred natural sites, heritage) and cathedrals.'), records: attractions });
write('archaeology', { ...meta('INAH open data (zones open to the public) and INAH-documented sites. Access is never implied without INAH confirmation.'), records: archaeology });
write('museums', { ...meta('SIC museum directory (Secretaría de Cultura) plus INAH; DENUE museum establishments kept separately under denue.'), records: museums, denue: byClass.museum ?? [] });
write('cultural-venues', { ...meta('SIC: theatres, cultural centres, galleries, auditoriums, craft houses.'), records: venues });
write('events', { ...meta('Single events dataset: research events (authoritative), pass-4 and pass-6 additions (CEFIM municipal festivities, Xantolo 2025 programmes, 2026 editions), SIC festivals and intangible-heritage celebrations, and seasonal experiences (ALL_YEAR / SEASONAL_WINDOW) from the official seasonal records. No unconfirmed 2026 date is presented as confirmed.'), xantolo_cycle: ev6.xantolo_cycle, records: events });
write('lodging', { ...meta('Official directory (Estadía, Secretaría de Turismo) + DENUE lodging classes 7211–7213. No ratings, prices or availability.'), records: [...estadiaRecs.filter((e) => e.entity_type === 'lodging'), ...(byClass.lodging ?? [])] });
const foodAll = [...estadiaRecs.filter((e) => e.entity_type !== 'lodging'), ...(byClass.food ?? []), ...(byClass.cafe ?? []), ...(byClass.drink ?? []), ...(byClass.nightlife ?? [])];
// exposure: official directory, cafés, producers, and DENUE restaurants/bars with 6+ staff (size, not popularity)
for (const f of foodAll) f.exposed = !!f.official_directory || ['cafe', 'drink'].includes(f.entity_type) || BIG(f.denue?.staff);
write('food-drink', { ...meta('Official directory + DENUE restaurants (722511–722512), cafés (722515 named café), bars and nightlife (7224), drink producers (3121). `exposed` marks records shown on the site: official listings, cafés, producers, and restaurants/bars with 6 or more staff.'), records: foodAll });
write('services', { ...meta('DENUE travel agencies and tour organisers + official guide verification directory.'), records: services });
write('mobility', { ...meta('DENUE: airports and bus-station administrators. Roads: see research/generated/brochure-tables.json (official distances).'), records: mobility });
write('recreation', { ...meta('DENUE: water parks/balnearios, grottos and natural parks.'), records: byClass.recreation ?? [] });
write('routes', { ...meta('Route sets; road routing is a later pass.'), records: routes });

// --------------------------------------------------------------- sources ----
const sources = [
  ['inegi-denue', 'INEGI', 'inegi.org.mx', 'Directorio Estadístico Nacional de Unidades Económicas (DENUE), San Luis Potosí, descarga masiva', 'https://www.inegi.org.mx/app/descarga/?ti=6', 'official-open-data', 'Bulk CSV for state 24; establishments registered by INEGI (fecha_alta up to 2025). Evidence of registration, not of current operation.'],
  ['inegi-iter-2020', 'INEGI', 'inegi.org.mx', 'Censo de Población y Vivienda 2020, Principales resultados por localidad (ITER), San Luis Potosí', 'https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_24_cpv2020_csv.zip', 'official-open-data', 'Municipal population 2020 and seat (cabecera) coordinates.'],
  ['inah-datos-zonas-arqueologicas', 'INAH', 'datos.inah.gob.mx', 'Datos abiertos: zonas arqueológicas abiertas al público', 'https://datos.inah.gob.mx/datos-abiertos/zonas-arqueologicas', 'official-open-data', 'CSV, quarterly update. SLP rows: Tamohi, Tamtoc (Abierta).'],
  ['inah-lugares', 'INAH', 'lugares.inah.gob.mx', 'Lugares INAH: fichas de zonas arqueológicas y museos', 'https://lugares.inah.gob.mx/', 'official-portal', 'Hours and costs read 2026-10-06 for Tamtoc and Tamohí.'],
  ['inah-revista-arqueologia-tanute', 'INAH (revista Arqueología)', 'revistas.inah.gob.mx', 'Oxitipa y el sitio arqueológico de Tanute, Huasteca potosina', 'https://revistas.inah.gob.mx/index.php/arqueologia/article/view/21582', 'academic-official', 'Documents the site; says nothing about public access.'],
  ...['museo', 'teatro', 'centro_cultural', 'galeria', 'auditorio', 'casa_artesania', 'festival', 'zona_arqueologica', 'catedral', 'frpintangible', 'otra_declaratoria'].map((t) => [sicSrc(t), 'Secretaría de Cultura, Sistema de Información Cultural (SIC)', 'sic.cultura.gob.mx', `SIC datos abiertos: ${t.replace(/_/g, ' ')} (San Luis Potosí)`, `https://sic.cultura.gob.mx/opendata/d/24_${t}_directorio.csv`, 'official-open-data', 'Licence: free reuse with attribution to SIC / Secretaría de Cultura.']),
  ['estadia-visitaslp', 'Secretaría de Turismo de San Luis Potosí', 'estadia.visitasanluispotosi.com', 'Estadía: directorio oficial de hospedaje y restaurantes', 'https://estadia.visitasanluispotosi.com/?directory_type=hotels', 'official-directory', 'WordPress REST (at_biz_dir): 34 hotels, 27 restaurants/bars at retrieval.'],
  ['sectur-estadisticas-2022', 'Secretaría de Turismo de San Luis Potosí', 'turismoslp.com.mx', 'El Sector Turismo en el Estado de San Luis Potosí (agosto 2022)', 'https://www.turismoslp.com.mx/Descargas/Estadisticas/2022CSTurismoSLP.pdf', 'official-statistics', 'Historical context only (2022, DataTur-based). Not evidence of current operation.'],
  ['sectur-federal', 'Secretaría de Turismo (federal)', 'gob.mx', 'SECTUR', 'https://www.gob.mx/sectur', 'official-portal', 'Pueblos Mágicos programme, guide accreditation.'],
].map(([source_id, institution, domain, title, url, source_type, notes]) => ({ source_id, institution, domain, title, url, source_type, region: null, destination: null, retrieval_date: TODAY, accessibility_status: 'accessible', verification_status: 'official', notes }));
fs.writeFileSync(R('research/source-registry/sources-pass5.json'), JSON.stringify({ generated: TODAY, rule: 'Additive to sources.json (untouched).', sources }, null, 1) + '\n');
console.log(`sources-pass5    ${sources.length}`);

// stats used as historical context
fs.writeFileSync(path.join(OUT, 'context-2022.json'), JSON.stringify({
  generated: TODAY, source_id: 'sectur-estadisticas-2022', year: 2022,
  note: 'Historical statistical context. Not evidence of current operation.',
  figures: [{ key: 'hotel_rooms_state', value: 12630, label: 'Cuartos de hotel en el estado', basis: 'Tabla «Principales indicadores por entidad federativa», DataTur 2022 (folleto, p. 1)' }],
}, null, 1) + '\n');
