"""Candidate coordinates from OpenStreetMap Nominatim, politely.

Usage policy respected (https://operations.osmfoundation.org/policies/nominatim/):
  - identifying User-Agent with contact
  - strictly sequential, >= 1.1 s between requests
  - every response cached in research/raw/geocode/ and never re-requested

Results are CANDIDATES. They stay `pending` until cross-checked against an
official source (INAH, municipal or state data). Data (c) OpenStreetMap
contributors, ODbL 1.0.

Output: research/generated/geocode-candidates.json
"""
import json, os, time, urllib.parse, urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "raw" / "geocode"
OUT = ROOT / "generated" / "geocode-candidates.json"
# Contact for the API operators, from the environment so no address is committed.
UA = "slp-academic-mvp-research/0.1 (academic project; contact: %s)" % os.environ.get("SLP_RESEARCH_CONTACT", "see repository")
CACHE.mkdir(parents=True, exist_ok=True)

# place_id -> free-text query. Bounded to the state with countrycodes + viewbox.
QUERIES = {
    "A01": "Real de Catorce, San Luis Potosí",
    "A02": "Túnel de Ogarrio, Real de Catorce",
    "A03": "Pueblo Fantasma, Real de Catorce",
    "A06": "Matehuala, San Luis Potosí",
    "A12": "Charcas, San Luis Potosí",
    "A15": None,  # a landscape, not a point: no coordinate is meaningful
    "C01": "Centro Histórico, San Luis Potosí",
    "C02": "Plaza de Armas, San Luis Potosí",
    "C03": "Plaza del Carmen, San Luis Potosí",
    "C08": "Museo Leonora Carrington, Calzada de Guadalupe, San Luis Potosí",
    "C10": "Cerro de San Pedro, San Luis Potosí",
    "C11": "Santa María del Río, San Luis Potosí",
    "C12": None,  # workshops are scattered; the town point is C11
    "M01": "Media Luna, Rioverde, San Luis Potosí",
    "M02": "Rioverde, San Luis Potosí",
    "M03": "Ciudad Fernández, San Luis Potosí",
    "M09": "Ciudad del Maíz, San Luis Potosí",
    "H01": "Cascada de Tamul, San Luis Potosí",
    "H02": "Río Tampaón, San Luis Potosí",
    "H04": "Sótano de las Golondrinas, Aquismón",
    "H06": "Aquismón, San Luis Potosí",
    "H07": "Xilitla, San Luis Potosí",
    "H08": "Las Pozas, Xilitla",
    "H10": "Cascadas de Tamasopo, Tamasopo",
    "H11": "Puente de Dios, Tamasopo",
    "H12": "Cascadas de Micos, Ciudad Valles",
    "H13": "Minas Viejas, El Naranjo, San Luis Potosí",
    "H14": "El Meco, El Naranjo, San Luis Potosí",
    "H16": "Tamtoc, Tamuín, San Luis Potosí",
}
# Second round: the first hit for a town was the municipal boundary (its point is
# not the town), and some features matched a road or a village of the same name.
# (query, extra params). Cached under <id>.r2.json.
REFINE = {
    "A02": ("Túnel Ogarrio", {}),
    "A03": ("Real de Catorce pueblo fantasma", {}),
    "A06": ("Matehuala", {"featureType": "settlement"}),
    "A12": ("Charcas", {"featureType": "settlement"}),
    "C08": ("Museo Leonora Carrington San Luis Potosí", {}),
    "C10": ("Cerro de San Pedro", {"featureType": "settlement"}),
    "C11": ("Santa María del Río", {"featureType": "settlement"}),
    "M01": ("Manantial de la Media Luna", {}),
    "M02": ("Rioverde", {"featureType": "settlement"}),
    "M03": ("Ciudad Fernández", {"featureType": "settlement"}),
    "M09": ("Ciudad del Maíz", {"featureType": "settlement"}),
    "H02": None,  # a river is a line; the visitor point (embarcadero) needs an official source
    "H06": ("Aquismón", {"featureType": "settlement"}),
    "H07": ("Xilitla", {"featureType": "settlement"}),
    "H13": ("Cascada de Minas Viejas", {}),
    "H14": ("Cascada El Meco", {}),
}
# San Luis Potosí state bounding box (lon_min, lat_max, lon_max, lat_min), generous.
VIEWBOX = "-102.4,24.6,-98.2,21.0"

last = 0.0

def search(q, cache, extra):
    global last
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    wait = 1.1 - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "limit": 3, "countrycodes": "mx", "viewbox": VIEWBOX,
         "bounded": 1, "addressdetails": 1, "accept-language": "es", **extra})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    last = time.time()
    cache.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data

results = {}
for pid, q in QUERIES.items():
    if pid in REFINE and REFINE[pid] is None:
        results[pid] = {"query": q, "status": "unavailable",
                        "reason": "linear feature; visitor access point needs an official source"}
        continue
    if q is None:
        results[pid] = {"query": None, "status": "unavailable", "reason": "not a single point"}
        continue
    if pid in REFINE:
        q, extra = REFINE[pid]
        data = search(q, CACHE / f"{pid}.r2.json", extra)
    else:
        data = search(q, CACHE / f"{pid}.json", {})
    # A municipal boundary's point is not the town or the attraction: rank it last.
    data = sorted(data, key=lambda h: (h.get("category") or h.get("class")) == "boundary")
    hits = [{
        "lat": float(h["lat"]), "lon": float(h["lon"]), "name": h.get("name"),
        "display_name": h.get("display_name"), "osm": f'{h.get("osm_type")}/{h.get("osm_id")}',
        "class": h.get("category") or h.get("class"), "type": h.get("type"),
        "municipality": (h.get("address") or {}).get("county") or (h.get("address") or {}).get("city")
                        or (h.get("address") or {}).get("town"),
    } for h in data]
    results[pid] = {"query": q, "status": "pending" if hits else "unavailable", "hits": hits}
    print(pid, q, "->", (hits[0]["lat"], hits[0]["lon"], hits[0]["class"], hits[0]["type"], hits[0]["municipality"]) if hits else "NO RESULT")

OUT.write_text(json.dumps({
    "generated": date.today().isoformat(),
    "source": "OpenStreetMap Nominatim",
    "licence": "Data (c) OpenStreetMap contributors, ODbL 1.0, https://osm.org/copyright",
    "note": "Candidates only. Never verified without an official cross-check.",
    "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
