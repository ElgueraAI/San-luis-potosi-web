"""Image candidates from Wikimedia Commons for Priority A places (metadata only).

Nothing is downloaded: only the API's file metadata (licence, author, size).
Requests are sequential (>= 1 s apart) with an identifying User-Agent, and
every response is cached under research/raw/commons/.

Status rules (never APPROVED without an explicit licence):
  APPROVED_CANDIDATE  explicit free licence (CC0 / PD / CC BY / CC BY-SA), no
                      restriction flags, the title or description names the
                      place, and the file is at least 1600 px on its long side.
                      Still needs a human look before any use.
  NEEDS_REVIEW        licence explicit but something else is unclear
                      (subject match, resolution, restrictions, NC/ND terms).
  REFERENCE_ONLY      licence missing or not free.

Output: research/generated/commons-candidates.json
"""
import json, os, re, time, urllib.parse, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "raw" / "commons"
OUT = ROOT / "generated" / "commons-candidates.json"
# Contact for the API operators, from the environment so no address is committed.
UA = "slp-academic-mvp-research/0.1 (academic project; contact: %s)" % os.environ.get("SLP_RESEARCH_CONTACT", "see repository")
CACHE.mkdir(parents=True, exist_ok=True)

# place_id -> (search terms, words at least one of which must appear in title/description)
QUERIES = {
    "A01": ("Real de Catorce", ["catorce"]),
    "A02": ("Túnel Ogarrio Real de Catorce", ["ogarrio"]),
    "A03": ("Real de Catorce ruinas", ["catorce"]),
    "A06": ("Matehuala", ["matehuala"]),
    "A12": ("Charcas San Luis Potosí", ["charcas"]),
    "A15": ("Altiplano potosino desierto", ["potos", "catorce", "altiplano"]),
    "C01": ("Centro histórico San Luis Potosí", ["san luis potos"]),
    "C02": ("Catedral San Luis Potosí", ["catedral", "cathedral"]),
    "C03": ("Templo del Carmen San Luis Potosí", ["carmen"]),
    "C08": ("Museo Leonora Carrington San Luis Potosí", ["carrington"]),
    "C10": ("Cerro de San Pedro San Luis Potosí", ["cerro de san pedro"]),
    "C11": ("Santa María del Río San Luis Potosí", ["santa mar"]),
    "C12": ("rebozo Santa María del Río", ["rebozo"]),
    "M01": ("Media Luna Rioverde", ["media luna"]),
    "M02": ("Rioverde San Luis Potosí", ["rioverde", "río verde", "rio verde"]),
    "M03": ("Ciudad Fernández San Luis Potosí", ["fern"]),
    "M09": ("Ciudad del Maíz San Luis Potosí", ["ciudad del ma"]),
    "H01": ("Cascada de Tamul", ["tamul"]),
    "H02": ("Río Tampaón", ["tampa"]),
    "H04": ("Sótano de las Golondrinas", ["golondrinas", "swallows"]),
    "H06": ("Aquismón", ["aquism"]),
    "H07": ("Xilitla", ["xilitla"]),
    "H08": ("Las Pozas Xilitla", ["pozas", "edward james"]),
    "H10": ("Cascadas de Tamasopo", ["tamasopo"]),
    "H11": ("Puente de Dios Tamasopo", ["puente de dios"]),
    "H12": ("Cascadas de Micos", ["micos"]),
    "H13": ("Minas Viejas cascada", ["minas viejas"]),
    "H14": ("Cascada El Meco", ["meco"]),
    "H16": ("Tamtoc", ["tamtoc"]),
}
# Not photography of the place: maps, arms, logos, diagrams.
NOT_PHOTO = re.compile(r"\b(map|mapa|location|locator|escudo|coat of arms|logo|diagram|plano)\b", re.I)
# Real subjects a tourism page should not lead with; always a human call.
SENSITIVE = re.compile(r"residuos|t[oó]xic|basura|accidente|protesta|contamina", re.I)
FREE = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? \d|cc by(-sa)?$|cc-by(-sa)?-\d)", re.I)
places = {p["place_id"]: p for p in json.loads((ROOT / "generated" / "workbook-places.json").read_text(encoding="utf-8"))["places"]}

def strip(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()

last = 0.0
records = []
for pid, (q, must) in QUERIES.items():
    cache = CACHE / f"{pid}.json"
    if cache.exists():
        data = json.loads(cache.read_text(encoding="utf-8"))
    else:
        wait = 1.0 - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:bitmap",
            "gsrnamespace": 6, "gsrlimit": 8, "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
            "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|Credit|AttributionRequired|Restrictions|ImageDescription|UsageTerms",
            "iiurlwidth": 640})
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
        last = time.time()
        cache.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    pages = sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    kept = 0
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        m = ii.get("extmetadata") or {}
        get = lambda k: strip((m.get(k) or {}).get("value"))
        lic, desc = get("LicenseShortName"), get("ImageDescription")
        w, h = ii.get("width", 0), ii.get("height", 0)
        hay = (p["title"] + " " + desc).lower()
        subject_ok = any(k in hay for k in must)
        restrictions = get("Restrictions")
        free = bool(FREE.match(lic)) and "nc" not in lic.lower() and "nd" not in lic.lower()
        ratio = w / h if h else 0
        not_photo = bool(NOT_PHOTO.search(p["title"]))
        sensitive = bool(SENSITIVE.search(hay))
        extreme = ratio > 3 or (ratio and ratio < 1 / 3)
        why = [x for x, bad in [("subject not named in title/description", not subject_ok),
                                (f"restrictions: {restrictions}", bool(restrictions)),
                                (f"only {max(w, h)} px", max(w, h) < 1600),
                                ("map/arms/logo, not photography", not_photo),
                                ("sensitive subject, editorial call", sensitive),
                                (f"extreme aspect {ratio:.2f}:1", extreme)] if bad]
        if not lic or not free or not_photo:
            status = "REFERENCE_ONLY"
        elif not why:
            status = "APPROVED_CANDIDATE"
        else:
            status = "NEEDS_REVIEW"
        if not free and lic:
            why.append(f"licence '{lic}' not in the free set (CC0/PD/CC BY/CC BY-SA)")
        intended = ("hero-candidate" if ratio >= 1.6 and max(w, h) >= 2400 else
                    "card-candidate" if 0.6 <= ratio <= 0.9 else
                    "gallery-candidate") if status != "REFERENCE_ONLY" else "reference"
        place = places[pid]
        records.append({
            "asset_id": f"{pid.lower()}-wc-{p['pageid']}",
            "place_id": pid, "region": place["region"], "destination": place["name"],
            "subject": p["title"].removeprefix("File:").rsplit(".", 1)[0],
            "source": "Wikimedia Commons",
            "source_url": ii.get("descriptionurl"),
            "file_url": ii.get("url"),
            "author": get("Artist") or None,
            "credit": get("Credit") or None,
            "licence": lic or None,
            "licence_url": get("LicenseUrl") or None,
            "attribution_required": (get("AttributionRequired").lower() == "true") if get("AttributionRequired") else None,
            "intended_use": intended,
            "visual_review": "not yet reviewed",
            "orientation": "landscape" if ratio > 1.05 else "portrait" if ratio < 0.95 else "square",
            "width": w, "height": h,
            "aspect_ratio": f"{ratio:.2f}:1" if ratio else None,
            "status": status,
            "review_notes": why,
            "retrieved": date.today().isoformat(),
        })
        kept += 1
    print(pid, q, "->", kept, "files,", sum(1 for r in records if r["place_id"] == pid and r["status"] == "APPROVED_CANDIDATE"), "approved candidates")

OUT.write_text(json.dumps({"generated": date.today().isoformat(), "source": "Wikimedia Commons API (metadata only)",
                           "records": records}, ensure_ascii=False, indent=2), encoding="utf-8")
print("total", len(records))
