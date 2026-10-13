// Writes docs/tourism-data-quality.md: record counts, coverage shares, quality
// issues and municipality indicators of the intelligence layer. Every number
// in that document comes from here (src/lib/intel over research/entities).
//   npm run intel:report            write the report
//   npm run intel:report -- --check exit 1 if any quality check of severity "error" fires
import fs from 'node:fs';
import { loadIntel, rawSets, R, J, E } from './load-lib.mjs';

const intel = await loadIntel();
const raw = rawSets();
const { places, municipalities, events } = intel.buildDataset(raw);
const media = new Set(Object.keys(J('src/data/generated/media.json').assets));
const manifest = J('research/media-registry/destination-asset-manifest.json').destinations;

const sets = {
  'Destinos y atractivos': raw.attractions, 'Arqueología': raw.archaeology, 'Museos': raw.museums, 'Recintos culturales': raw.venues,
  'Eventos': raw.events, 'Hospedaje': E('lodging'), 'Gastronomía y bebidas': E('food-drink'), 'Recreación': raw.recreation,
  'Servicios': E('services'), 'Movilidad': E('mobility'), 'Municipios': raw.municipalities,
};
const issues = intel.runQuality({
  sets,
  municipalityIds: new Set(raw.municipalities.map((m) => m.id).filter(Boolean)),
  municipalityRegion: new Map(raw.municipalities.filter((m) => m.id).map((m) => [m.id, m.region ?? null])),
  mediaIds: media,
  geoExpected: ['Destinos y atractivos', 'Arqueología', 'Museos'],
  skipNearDuplicates: ['Hospedaje', 'Gastronomía y bebidas', 'Servicios', 'Eventos'],
});
const hasImage = (e) => [manifest[e.id]?.slots?.card, manifest[e.id]?.slots?.hero_desktop, ...(e.image_ids ?? [])].some((x) => x && media.has(x));
const cov = intel.coverage(sets, hasImage);

const pct = (v) => `${Math.round(v * 100)} %`;
const table = (head, body) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const REG = intel.REGION_LABEL;
const summary = intel.summarize(issues);
const errors = issues.filter((i) => i.severity === 'error');

const kinds = places.reduce((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {});
const evid = places.reduce((a, p) => ((a[p.evidence] = (a[p.evidence] ?? 0) + 1), a), {});
const coordC = places.reduce((a, p) => ((a[p.coord_confidence] = (a[p.coord_confidence] ?? 0) + 1), a), {});
const withSeason = places.filter((p) => p.recommended_months).length;
const interestRows = intel.INTERESTS.map((i) => [intel.INTEREST_LABEL[i], ...Object.keys(REG).map((r) => places.filter((p) => p.region === r && p.interests.includes(i)).length), places.filter((p) => p.interests.includes(i)).length, places.filter((p) => p.derived_interests.includes(i)).length]);
const low = municipalities.filter((m) => m.assets === 0).sort((a, b) => a.name.localeCompare(b.name, 'es'));
const top = [...municipalities].sort((a, b) => b.diversification_potential - a.diversification_potential).slice(0, 15);
const assetShares = municipalities.map((m) => m.assets);
const lodgingShares = municipalities.map((m) => m.counts.lodging);
const gaps = intel.INTERESTS.flatMap((i) => Object.keys(REG).filter((r) => !places.some((p) => p.region === r && p.interests.includes(i))).map((r) => `${intel.INTEREST_LABEL[i]} en ${REG[r]}`));

const md = `# Calidad y cobertura de los datos turísticos

Generado por \`npm run intel:report\` (\`scripts/intel/report.mjs\`) el ${new Date().toISOString().slice(0, 10)} a partir de \`research/entities\`
mediante \`src/lib/intel\`. No se edita a mano: se cambian los datos o los controles y se vuelve a ejecutar.

Documentos relacionados: \`tourism-data-dictionary.md\` (campos), \`tourism-data-provenance.md\` (fuentes),
\`tourism-intelligence-limitations.md\` (lo que estas cifras no dicen).

## 1. Registros por conjunto (datos observados)

${table(['Conjunto', 'Registros', 'Con punto', 'Fuente oficial', 'Con imagen con licencia', 'Con descripción', 'Con municipio'], cov.map((c) => [c.set, c.records.toLocaleString('es-MX'), pct(c.with_point), pct(c.official_source), pct(c.with_image), pct(c.with_description), pct(c.with_municipality)]))}

«Fuente oficial» = el registro tiene un id de fuente y su estado es verificado, listado (datos abiertos del SIC),
directorio oficial (Estadía) o registro (DENUE de INEGI). Una fila del DENUE es oficial como asiento de un registro;
no confirma que el negocio opere hoy. Museos, recintos, hospedaje y gastronomía no llevan fotografía por diseño
(\`docs/media-coverage.md\`).

## 2. Candidatos del recomendador (normalizados)

${places.length} lugares pueden sugerirse: ${Object.entries(kinds).map(([k, v]) => `${intel.KIND_LABEL[k]} ${v}`).join(' · ')}.
El sitio publica un subconjunto: solo los destinos con página (descripción verificada).

- Confianza del punto: ${Object.entries(coordC).map(([k, v]) => `${k} ${v}`).join(' · ')}. Un lugar sin punto nunca entra en un cálculo de distancia o de ruta.
- Nivel de evidencia: alta ${evid.alta ?? 0} · media ${evid.media ?? 0} · baja ${evid.baja ?? 0}.
- Temporada declarada por una fuente oficial: ${withSeason} de ${places.length}. El resto no tiene evidencia de temporada y no se penaliza.
- Eventos con al menos un mes: ${events.filter((e) => e.months.length).length} de ${events.length} (fecha confirmada ${events.filter((e) => e.date_confidence === 'confirmed').length} · patrón oficial ${events.filter((e) => e.date_confidence === 'pattern').length} · edición anterior ${events.filter((e) => e.date_confidence === 'past').length} · sin fecha ${events.filter((e) => e.date_confidence === 'unknown').length}).

### Intereses por región

${table(['Interés', ...Object.values(REG), 'Total', 'De ellos, derivados por regla'], interestRows)}

Huecos de categoría (interés sin ningún candidato en una región): ${gaps.length ? gaps.join('; ') : 'ninguno'}.

## 3. Controles de calidad

${table(['Control', 'Severidad', 'Hallazgos'], Object.entries(summary).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => [`\`${k}\``, v.severity, v.count]))}

Controles sin hallazgos: ${['duplicate-id', 'missing-name', 'placeholder', 'impossible-coordinates', 'outside-slp', 'unknown-municipality', 'region-mismatch', 'contradictory-dates', 'date-month-mismatch', 'impossible-month', 'malformed-url'].filter((c) => !summary[c]).map((c) => `\`${c}\``).join(', ') || 'ninguno'}.

Lectura de los hallazgos principales:

- \`unknown-municipality\`: filas del DENUE asignadas a la clave 24059 (Villa de Pozos, municipio creado en 2024). El catálogo
  municipal del proyecto viene del Censo 2020 y aún no tiene esa clave, así que la discrepancia se reporta y no se corrige en silencio.
- \`placeholder\`: establecimientos que el DENUE registra literalmente como «sin nombre». No se muestran como recomendación.
- \`duplicate-name\`: sucursales o registros homónimos en el mismo municipio dentro de los registros DENUE y SIC.
- \`no-coordinates\`: destinos sin punto aceptable; quedan fuera de todo cálculo geoespacial (no se les inventa uno).

La revisión de enlaces es solo sintáctica (\`malformed-url\`). Este script no consulta las URL externas, para respetar los
límites de las fuentes; los enlaces internos se verifican con \`scripts/verify/links.mjs\` sobre el sitio compilado.

${errors.length ? `### Errores (primeros 12 de ${errors.length})\n\n${table(['Control', 'Conjunto', 'Id', 'Detalle'], errors.slice(0, 12).map((i) => [`\`${i.check}\``, i.set, i.id, i.detail]))}\n` : 'Ningún hallazgo con severidad de error.\n'}
### Advertencias y notas (primeras 30 fuera de los registros masivos)

${table(['Control', 'Conjunto', 'Id', 'Detalle'], issues.filter((i) => i.severity !== 'error' && !['image-not-in-production', 'no-municipality', 'placeholder'].includes(i.check) && !['Hospedaje', 'Gastronomía y bebidas', 'Servicios'].includes(i.set)).slice(0, 30).map((i) => [`\`${i.check}\``, i.set, i.id, i.detail.replace(/\|/g, '/')]))}

## 4. Cobertura territorial

- Municipios: ${municipalities.length}; con al menos un atractivo puntuable (destino, museo, zona arqueológica, área protegida): ${municipalities.filter((m) => m.assets > 0).length}.
- Concentración de atractivos puntuables (Herfindahl–Hirschman, 0–1): ${intel.concentration(assetShares)}; los 5 municipios con más atractivos reúnen el ${pct(intel.topShare(assetShares, 5))}.
- Concentración del hospedaje registrado: ${intel.concentration(lodgingShares)}; los 5 municipios con más registros reúnen el ${pct(intel.topShare(lodgingShares, 5))}.

Municipios sin atractivo puntuable (${low.length}): ${low.map((m) => m.name).join(', ')}.

### Mayor potencial de diversificación (indicador derivado; ver \`tourism-redistribution-methodology.md\`)

${table(['Municipio', 'Región', 'Atractivos', 'Eventos', 'Hospedaje', 'Comida', 'Índice de infraestructura', 'Exposición (proxy)', 'Potencial de diversificación'], top.map((m) => [m.name, REG[m.region] ?? '—', m.assets, m.counts.events, m.counts.lodging, m.counts.food, m.infrastructure_index.toFixed(2), m.exposure_proxy.toFixed(2), m.diversification_potential.toFixed(2)]))}

Los tres índices son derivados por este proyecto a partir de conteos observados. No son visitantes, ocupación ni
saturación, y cambian cuando cambian los registros de origen.
`;
fs.writeFileSync(R('docs/tourism-data-quality.md'), md);
console.log(`wrote docs/tourism-data-quality.md · ${places.length} candidates · ${issues.length} findings (${errors.length} errors)`);
for (const [k, v] of Object.entries(summary)) console.log(`  ${v.severity.padEnd(7)} ${k} ${v.count}`);
if (process.argv.includes('--check') && errors.length) process.exit(1);
