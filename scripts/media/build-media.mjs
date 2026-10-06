// Builds the website's production image set from the research media registry.
//
//   node scripts/media/build-media.mjs            # derive from local files only
//   node scripts/media/build-media.mjs --fetch    # also fetch missing large renditions
//   node scripts/media/build-media.mjs --fetch --only=wc-1,wc-2   # fetch only these (targeted)
//
// Rules (research/media-registry is the authority, nothing here re-decides them):
//   - Only assets with an attribution record (attributions.json, status OK) are
//     eligible. That is the 85 SELECTED assets; BACKUP assets have no record and
//     never reach production.
//   - NC / ND licences are refused outright (none are selected today).
//   - Source priority: research/raw/media-originals (downloaded originals) >
//     media-source/fetched (one ~2000 px rendition of a selected asset, fetched
//     with --fetch, git-ignored) > research/raw/media-review/thumbs (960 px).
//   - Output is a resized WebP derivative in src/assets/media/<asset_id>.webp.
//     CC BY-SA derivatives stay CC BY-SA; the credits page says so.
//   - src/data/generated/media.json records size, source tier and attribution.
//
// research/raw is never exposed or copied wholesale: only the derivative ships.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (...p) => path.join(root, ...p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));

const FETCH = process.argv.includes('--fetch');
const ONLY = new Set((process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean));
const OUT_DIR = R('src/assets/media');
const FETCH_DIR = R('media-source/fetched');
const DATA_OUT = R('src/data/generated/media.json');
const UA = 'SLP-tourism-academic-MVP/0.1 (university project; non-commercial)';

const reviewed = Object.fromEntries(readJson('research/media-registry/media-reviewed.json').assets.map((a) => [a.asset_id, a]));
let attributions = readJson('research/media-registry/attributions.json').attributions;
// Additive registries from later passes (research/media-registry/additions-*.json):
// each asset carries its own review and attribution; the base files stay untouched.
for (const f of fs.readdirSync(R('research/media-registry')).filter((n) => /^additions-.+\.json$/.test(n))) {
  for (const x of readJson(`research/media-registry/${f}`).assets) {
    reviewed[x.asset_id] = x;
    attributions = attributions.filter((y) => y.asset_id !== x.asset_id).concat({
      asset_id: x.asset_id, author: x.author, source: x.source, source_url: x.source_url,
      licence: x.licence, licence_url: x.licence_url,
      attribution_text: `Foto: ${x.author} · ${x.licence} · vía ${x.source}`,
      share_alike_required: x.share_alike_required, third_party_rights: x.third_party_rights, status: 'OK',
    });
  }
}

// Shown full-bleed: keep more pixels.
const HERO = new Set(['wc-69780780', 'wc-48806929', 'px-14842050', 'wc-48806880', 'wc-29767255', 'wc-45072511', 'wc-50604767', 'wc-76389273', 'wc-42373253']);
const MAX_EDGE = (id) => (HERO.has(id) ? 2560 : 2000);

function localOriginal(id) {
  const dir = R('research/raw/media-originals');
  const f = fs.readdirSync(dir).find((n) => n.split('.')[0] === id);
  return f ? path.join(dir, f) : null;
}
function fetched(id) {
  const f = path.join(FETCH_DIR, `${id}.jpg`);
  return fs.existsSync(f) ? f : null;
}
function reviewThumb(id) {
  const f = R('research/raw/media-review/thumbs', `${id}.jpg`);
  return fs.existsSync(f) ? f : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One Commons thumbnail rendition (not the original) for one selected asset. */
async function fetchRendition(a) {
  const m = /\/wiki\/(File:.+)$/.exec(a.source_url);
  if (!m) return null;
  const title = decodeURIComponent(m[1]);
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=2000&titles=${encodeURIComponent(title)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(api, { headers: { 'User-Agent': UA } });
    if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
    const j = await res.json();
    const page = Object.values(j.query?.pages ?? {})[0];
    const url = page?.imageinfo?.[0]?.thumburl;
    if (!url) return null;
    await sleep(1200);
    const img = await fetch(url, { headers: { 'User-Agent': UA } });
    if (img.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
    if (!img.ok) return null;
    fs.mkdirSync(FETCH_DIR, { recursive: true });
    const out = path.join(FETCH_DIR, `${a.asset_id}.jpg`);
    fs.writeFileSync(out, Buffer.from(await img.arrayBuffer()));
    return out;
  }
  return null;
}

const eligible = attributions.filter((a) => {
  if (a.status !== 'OK') return false;
  if (/\bNC\b|\bND\b|NonCommercial|NoDeriv/i.test(a.licence)) return false;
  const r = reviewed[a.asset_id];
  return r && r.status === 'SELECTED';
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(DATA_OUT), { recursive: true });

const records = {};
let nFetched = 0;
for (const a of eligible) {
  const r = reviewed[a.asset_id];
  let src = localOriginal(a.asset_id);
  let tier = 'original';
  if (!src) { src = fetched(a.asset_id); tier = 'rendition'; }
  if (!src && FETCH && (!ONLY.size || ONLY.has(a.asset_id))) {
    process.stdout.write(`fetch ${a.asset_id} … `);
    src = await fetchRendition(a);
    console.log(src ? 'ok' : 'failed');
    if (src) nFetched++;
    await sleep(1500);
  }
  if (!src) { src = reviewThumb(a.asset_id); tier = 'review-thumb'; }
  if (!src) { console.warn(`skip ${a.asset_id}: no local file`); continue; }

  const out = path.join(OUT_DIR, `${a.asset_id}.webp`);
  const max = MAX_EDGE(a.asset_id);
  const img = sharp(src, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const portrait = (meta.height ?? 0) > (meta.width ?? 0);
  const info = await img
    .resize(portrait ? { height: max, withoutEnlargement: true } : { width: max, withoutEnlargement: true })
    .webp({ quality: HERO.has(a.asset_id) ? 82 : 76, effort: 5 })
    .toFile(out);

  records[a.asset_id] = {
    id: a.asset_id,
    file: `${a.asset_id}.webp`,
    width: info.width,
    height: info.height,
    tier,
    place_id: r.place_id ?? null,
    region: r.region ?? null,
    destination: r.destination ?? null,
    subject: r.subject?.replace(/\.(jpe?g|png)$/i, '') ?? null,
    role: r.role ?? null,
    author: a.author,
    source: a.source,
    source_url: a.source_url,
    licence: a.licence,
    licence_url: a.licence_url ?? null,
    attribution_text: a.attribution_text,
    share_alike: !!a.share_alike_required,
    modified: true,
    third_party_rights: a.third_party_rights ?? r.third_party_rights ?? null,
  };
  console.log(`${a.asset_id.padEnd(14)} ${tier.padEnd(12)} ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

fs.writeFileSync(
  DATA_OUT,
  JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      rule: 'Derived from research/media-registry. Only SELECTED assets with an attribution record. Files are resized WebP derivatives; CC BY-SA derivatives remain CC BY-SA.',
      count: Object.keys(records).length,
      assets: records,
    },
    null,
    1,
  ) + '\n',
);
console.log(`\n${Object.keys(records).length} assets written, ${nFetched} renditions fetched this run.`);
