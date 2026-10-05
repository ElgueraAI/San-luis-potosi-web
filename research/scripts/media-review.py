"""Pass 2B, step 1: gather Commons candidates (pass-1 cache + new searches), fetch review thumbnails,
and lay out contact sheets for visual review.

- Metadata only from the Commons API; thumbnails (640 px) only for looking at, saved under
  research/raw/media-review/thumbs (git-ignored). Sequential requests, identifying User-Agent.
- Output: research/generated/commons-candidates-all.json and research/raw/media-review/sheets/*.html (+ .json index)
  The sheets are rendered to PNG by research/scripts/contact-sheets.mjs.
"""
import json, os, re, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "raw" / "commons"
REVIEW = ROOT / "raw" / "media-review"
THUMBS = REVIEW / "thumbs"
SHEETS = REVIEW / "sheets"
for d in (CACHE, THUMBS, SHEETS):
    d.mkdir(parents=True, exist_ok=True)
UA = "slp-academic-mvp-research/0.2 (academic project; contact: %s)" % os.environ.get("SLP_RESEARCH_CONTACT", "see repository")

places = {p["place_id"]: p for p in json.loads((ROOT / "generated/workbook-places.json").read_text(encoding="utf-8"))["places"]}

# key -> (search, place_id or None, theme or None, region)
NEW = {
    # Priority B/C places
    "A04": ("Cerro del Quemado Real de Catorce", "A04", None, "altiplano"),
    "A05": ("Estación Catorce", "A05", None, "altiplano"),
    "A07": ("Catedral Matehuala", "A07", None, "altiplano"),
    "A08": ("Guadalcázar San Luis Potosí", "A08", None, "altiplano"),
    "A09": ("Gruta de las Candelas", "A09", None, "altiplano"),
    "A13": ("Salinas de Hidalgo", "A13", None, "altiplano"),
    "A14": ("Venado San Luis Potosí", "A14", None, "altiplano"),
    "C05": ("Teatro de la Paz San Luis Potosí", "C05", None, "centro"),
    "C06": ("Caja del Agua San Luis Potosí", "C06", None, "centro"),
    "C07": ("Centro de las Artes San Luis Potosí", "C07", None, "centro"),
    "C09": ("Barrio de Tlaxcala San Luis Potosí", "C09", None, "centro"),
    "C13": ("Tierra Nueva San Luis Potosí", "C13", None, "centro"),
    "C14": ("Sierra de San Miguelito", "C14", None, "centro"),
    "C15": ("Hacienda Gogorrón", "C15", None, "centro"),
    "M07": ("Niño de la Salud Atotonilco", "M07", None, "zona-media"),
    "M13": ("Santa María Acapulco", "M13", None, "zona-media"),
    "M14": ("Grutas de la Catedral Rioverde", "M14", None, "zona-media"),
    "H03": ("Cueva del Agua Aquismón", "H03", None, "huasteca"),
    "H05": ("Hoya de las Huahuas", "H05", None, "huasteca"),
    "H09": ("Xilitla convento", "H09", None, "huasteca"),
    "H15": ("Cascada El Salto El Naranjo", "H15", None, "huasteca"),
    "H17": ("Ciudad Valles", "H17", None, "huasteca"),
    "H18": ("Xantolo", "H18", "xantolo", "huasteca"),
    # Better Priority A coverage
    "A02b": ("Ogarrio tunnel", "A02", None, "altiplano"),
    "A15b": ("Wirikuta", "A15", "altiplano-desert", "altiplano"),
    "A15c": ("Sierra de Catorce desierto", "A15", "altiplano-desert", "altiplano"),
    "H01b": ("Tamul waterfall", "H01", None, "huasteca"),
    "H08b": ("Las Pozas Edward James", "H08", None, "huasteca"),
    "H10b": ("Tamasopo waterfall", "H10", None, "huasteca"),
    "H12b": ("Micos waterfalls Huasteca", "H12", None, "huasteca"),
    "M01b": ("Media Luna Rio Verde spring", "M01", None, "zona-media"),
    "H02b": ("Tampaón river canyon", "H02", None, "huasteca"),
    # Region culture / detail themes
    "T-voladores": ("Voladores Tamaletom", None, "voladores", "huasteca"),
    "T-teenek": ("Teenek Huasteca", None, "teenek", "huasteca"),
    "T-zacahuil": ("zacahuil", None, "gastronomia-huasteca", "huasteca"),
    "T-huasteca": ("Huasteca Potosina", None, "huasteca-landscape", "huasteca"),
    "T-enchiladas": ("enchiladas potosinas", None, "gastronomia-centro", "centro"),
    "T-slp-noche": ("San Luis Potosí centro histórico noche", None, "centro-night", "centro"),
    "T-mezcal": ("mezcal San Luis Potosí", None, "mezcal", "altiplano"),
    "T-cactus": ("Altiplano potosino cactus", None, "altiplano-desert", "altiplano"),
    "T-xilitla-cafe": ("café Xilitla", None, "cafe", "huasteca"),
}
FREE = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? \d|cc by(-sa)?$|cc-by(-sa)?-\d)", re.I)
NOT_PHOTO = re.compile(r"\b(map|mapa|location|locator|escudo|coat of arms|logo|diagram|plano|flag|bandera)\b", re.I)

def strip(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()

last = 0.0
def search(key, q, limit=12):
    global last
    f = CACHE / f"{key}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    wait = 2.5 - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:bitmap",
        "gsrnamespace": 6, "gsrlimit": limit, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
        "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions|ImageDescription|UsageTerms|DateTimeOriginal",
        "iiurlwidth": 640})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 15 * (attempt + 1))
    last = time.time()
    f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data

# pass-1 cache files are named <place_id>.json with the same structure
jobs = [(pid, None, pid, None, places[pid]["region"]) for pid in places if (CACHE / f"{pid}.json").exists()]
jobs += [(k, q, pid, theme, region) for k, (q, pid, theme, region) in NEW.items()]
cands, seen = [], {}
for key, q, pid, theme, region in jobs:
    data = search(key, q) if q else json.loads((CACHE / f"{key}.json").read_text(encoding="utf-8"))
    for p in sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99)):
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii.get("url") or not (ii.get("mime") or "").startswith("image/"):
            continue
        m = ii.get("extmetadata") or {}
        get = lambda k: strip((m.get(k) or {}).get("value"))
        if p["pageid"] in seen:
            seen[p["pageid"]]["also_matches"].append(pid or theme)
            continue
        lic = get("LicenseShortName")
        rec = {"asset_id": f"wc-{p['pageid']}", "pageid": p["pageid"], "place_id": pid, "theme": theme, "region": region,
               "search_key": key, "title": p["title"], "source": "Wikimedia Commons", "source_url": ii.get("descriptionurl"),
               "file_url": ii.get("url"), "thumb_url": ii.get("thumburl"), "width": ii.get("width"), "height": ii.get("height"),
               "author": get("Artist") or None, "credit": get("Credit") or None, "licence": lic or None,
               "licence_url": get("LicenseUrl") or None,
               "attribution_required": (get("AttributionRequired").lower() == "true") if get("AttributionRequired") else None,
               "restrictions": get("Restrictions") or None, "description": get("ImageDescription")[:400] or None,
               "date": get("DateTimeOriginal") or None,
               "licence_free": bool(FREE.match(lic or "")) and not re.search(r"\bn[cd]\b", (lic or "").lower()),
               "not_photo": bool(NOT_PHOTO.search(p["title"])), "also_matches": []}
        seen[p["pageid"]] = rec
        cands.append(rec)

# thumbnails (sequential, polite)
for c in cands:
    t = THUMBS / f'{c["asset_id"]}.jpg'
    if t.exists() or not c["thumb_url"] or c["not_photo"]:
        continue
    req = urllib.request.Request(c["thumb_url"], headers={"User-Agent": UA})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                t.write_bytes(r.read())
            break
        except Exception as e:  # 429/5xx: back off
            time.sleep(10 * (attempt + 1))
    time.sleep(1.0)

# contact sheets grouped by place/theme; 12 tiles per sheet
groups = {}
for c in cands:
    if c["not_photo"] or not (THUMBS / f'{c["asset_id"]}.jpg').exists():
        continue
    groups.setdefault(c["place_id"] or f'theme:{c["theme"]}', []).append(c)
order = sorted(groups, key=lambda k: (k.startswith("theme:"), k))
sheet_index, n = [], 0
for k in order:
    items = groups[k]
    for i in range(0, len(items), 12):
        chunk = items[i:i + 12]
        n += 1
        name = f"sheet-{n:03d}"
        tiles = "".join(
            f'<figure><img src="../thumbs/{c["asset_id"]}.jpg"><figcaption><b>{j + 1}</b> {c["asset_id"]} · '
            f'{c["width"]}×{c["height"]} · {(c["licence"] or "?")}<br>{c["title"][5:70]}</figcaption></figure>'
            for j, c in enumerate(chunk))
        html = (f'<!doctype html><meta charset="utf-8"><style>body{{margin:0;padding:10px;background:#222;color:#eee;font:13px/1.25 Arial}}'
                f'h1{{font-size:18px;margin:0 0 8px}}.g{{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}}'
                f'figure{{margin:0;background:#333}}img{{width:100%;height:230px;object-fit:contain;background:#111;display:block}}'
                f'figcaption{{padding:4px 6px;height:34px;overflow:hidden}}</style>'
                f'<h1>{name} — {k} — {places[k]["name"] if k in places else k}</h1><div class="g">{tiles}</div>')
        (SHEETS / f"{name}.html").write_text(html, encoding="utf-8")
        sheet_index.append({"sheet": name, "group": k, "assets": [c["asset_id"] for c in chunk]})
(SHEETS / "index.json").write_text(json.dumps(sheet_index, indent=1), encoding="utf-8")
(ROOT / "generated" / "commons-candidates-all.json").write_text(json.dumps({
    "generated": "2026-10-05", "note": "Metadata only. Thumbnails for review are in research/raw (git-ignored).",
    "count": len(cands), "records": cands}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(len(cands), "candidates;", sum(1 for c in cands if (THUMBS / f'{c["asset_id"]}.jpg').exists()), "thumbs;", n, "sheets")
