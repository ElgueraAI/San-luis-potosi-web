"""Coordinates for all 63 places, official sources first.

Source priority (per the research brief):
  1. Official institution points
       INAH ficha (Tamtoc)                      -> site precision
       INEGI DENUE 2026 establishment points    -> site precision (museums, theatres, churches)
       INEGI ITER 2020 locality points          -> locality precision (towns, villages)
  2. OpenStreetMap Nominatim                    -> cross-check, or provisional site point (never 'verified' alone)

Rules
  verified : point comes from an official source (above). OSM distance recorded as a cross-check.
  pending  : only an OSM feature exists. Plausibility checks recorded (distance to the official access
             locality, OSM municipality). These may be mapped as 'provisional', never as verified.
  unavailable : the place is not a point (landscape, river, intangible heritage, scattered workshops).

Nominatim: sequential, >= 1.1 s apart, identifying User-Agent (contact from SLP_RESEARCH_CONTACT), cached.
Inputs (git-ignored): research/raw/inegi/iter_24_cpv2020_csv.zip, research/raw/inegi/denue_24_csv.zip,
research/raw/geocode/*.json. Output: research/generated/coordinates.json
"""
import csv, io, json, math, os, re, time, urllib.parse, urllib.request, zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
CACHE = RAW / "geocode"
UA = "slp-academic-mvp-research/0.2 (academic project; contact: %s)" % os.environ.get("SLP_RESEARCH_CONTACT", "see repository")
VIEWBOX = "-102.4,24.6,-98.2,21.0"
ITER_URL = "https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_24_cpv2020_csv.zip"
DENUE_URL = "https://www.inegi.org.mx/contenidos/masiva/denue/denue_24_csv.zip"

def norm(s):
    s = s.lower()
    for a, b in zip("áéíóúüñ", "aeiouun"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def dms(v):
    m = re.match(r"\s*(\d+)°(\d+)'([\d.]+)\"\s*([NSEW])", v)
    d = int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3)) / 3600
    return -d if m.group(4) in "SW" else d

def haversine(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return round(2 * 6371000 * math.asin(math.sqrt(h)))

# ---------------------------------------------------------------- official data
z = zipfile.ZipFile(RAW / "inegi" / "iter_24_cpv2020_csv.zip")
iter_rows = list(csv.DictReader(io.StringIO(z.read("iter_24_cpv2020/conjunto_de_datos/conjunto_de_datos_iter_24CSV20.csv").decode("utf-8-sig"))))
LOC = {}
for r in iter_rows:
    if r["LOC"] in ("0000", "9998", "9999") or not r["LONGITUD"].strip():
        continue
    LOC[(norm(r["NOM_MUN"]), norm(r["NOM_LOC"]))] = {
        "lat": round(dms(r["LATITUD"]), 6), "lon": round(dms(r["LONGITUD"]), 6),
        "altitude_m": int(r["ALTITUD"]) if r["ALTITUD"].strip().isdigit() else None,
        "mun": r["NOM_MUN"], "loc": r["NOM_LOC"], "cve": f'24{r["MUN"]}{r["LOC"]}', "pop2020": r["POBTOT"]}

z = zipfile.ZipFile(RAW / "inegi" / "denue_24_csv.zip")
den = [n for n in z.namelist() if n.endswith(".csv") and "conjunto" in n][0]
DENUE = list(csv.DictReader(io.StringIO(z.read(den).decode("latin-1"))))

def denue(pattern, municipality):
    hits = [r for r in DENUE if re.search(pattern, r["nom_estab"], re.I) and norm(r["municipio"]) == norm(municipality)]
    return hits[0] if len(hits) == 1 else (hits if hits else None)

# ---------------------------------------------------------------- nominatim
last = 0.0
def nominatim(key, q, extra=None):
    global last
    f = CACHE / f"{key}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    wait = 1.1 - (time.time() - last)
    if wait > 0:
        time.sleep(wait)
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "jsonv2", "limit": 3, "countrycodes": "mx", "viewbox": VIEWBOX, "bounded": 1,
         "addressdetails": 1, "accept-language": "es", **(extra or {})})
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    last = time.time()
    f.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data

def osm_best(data, prefer_place=False):
    data = sorted(data, key=lambda h: ((h.get("category") == "boundary"),
                                        (prefer_place and h.get("category") != "place")))
    if not data:
        return None
    h = data[0]
    a = h.get("address") or {}
    return {"lat": float(h["lat"]), "lon": float(h["lon"]), "osm": f'{h["osm_type"]}/{h["osm_id"]}',
            "feature": f'{h.get("category")}/{h.get("type")}', "name": h.get("name"),
            "municipality": a.get("county") or a.get("city") or a.get("town") or a.get("village")}

# ---------------------------------------------------------------- per-place plan
# kind: inah | denue | locality | site | none
L = lambda mun, loc: ("locality", mun, loc)
PLAN = {
    "A01": dict(kind="locality", loc=("Catorce", "Real de Catorce"), osm="Real de Catorce, San Luis Potosí"),
    "A02": dict(kind="site", osm="Túnel Ogarrio", access=("Catorce", "Real de Catorce"), max_km=5),
    "A03": dict(kind="site", osm="Pueblo Fantasma, Catorce", alt=["Pueblo Fantasma", "Real de Catorce minas"], access=("Catorce", "Real de Catorce"), max_km=8),
    "A04": dict(kind="site", osm="Cerro del Quemado, Catorce", access=("Catorce", "Real de Catorce"), max_km=10),
    "A05": dict(kind="locality", loc=("Catorce", "Estación Catorce"), osm="Estación Catorce"),
    "A06": dict(kind="locality", loc=("Matehuala", "Matehuala"), osm="Matehuala"),
    "A07": dict(kind="denue", denue=("CATEDRAL DE LA INMACULADA", "Matehuala"), osm="Catedral de la Inmaculada Concepción, Matehuala"),
    "A08": dict(kind="locality", loc=("Guadalcázar", "Guadalcázar"), osm="Guadalcázar"),
    "A09": dict(kind="site", osm="Gruta de las Candelas, Guadalcázar", alt=["Gruta de las Candelas", "Grutas de las Candelas"], access=("Guadalcázar", "Guadalcázar"), max_km=25),
    "A10": dict(kind="locality", loc=("Guadalcázar", "Realejo"), osm="Realejo, Guadalcázar",
                note="Climbing area named by the brochure at El Realejo / Cerro de las Comadres; point is the community."),
    "A11": dict(kind="locality", loc=("Charcas", "Charcas"), osm="Charcas"),
    "A12": dict(kind="locality", loc=("Charcas", "Charcas"), osm="Charcas",
                note="A route, not a point: anchored on the town of Charcas."),
    "A13": dict(kind="locality", loc=("Salinas", "Salinas de Hidalgo"), osm="Salinas de Hidalgo"),
    "A14": dict(kind="locality", loc=("Venado", "Venado"), osm="Venado, San Luis Potosí"),
    "A15": dict(kind="none", why="Landscape theme across the Altiplano, not a point."),
    "C01": dict(kind="locality", loc=("San Luis Potosí", "San Luis Potosí"), osm="San Luis Potosí",
                note="INEGI city point, which falls in the Centro Histórico."),
    "C02": dict(kind="site", osm="Plaza de Armas, San Luis Potosí", access=("San Luis Potosí", "San Luis Potosí"), max_km=3),
    "C03": dict(kind="site", osm="Plaza del Carmen, San Luis Potosí", access=("San Luis Potosí", "San Luis Potosí"), max_km=3),
    "C04": dict(kind="denue", denue=(r"^TEMPLO DEL CARMEN$", "San Luis Potosí"), osm="Templo del Carmen, San Luis Potosí"),
    "C05": dict(kind="denue", denue=(r"^TEATRO DE LA PAZ$", "San Luis Potosí"), osm="Teatro de la Paz, San Luis Potosí"),
    "C06": dict(kind="site", osm="Caja del Agua, San Luis Potosí", access=("San Luis Potosí", "San Luis Potosí"), max_km=4),
    "C07": dict(kind="site", osm="Centro de las Artes, San Luis Potosí", access=("San Luis Potosí", "San Luis Potosí"), max_km=5),
    "C08": dict(kind="denue", denue=("MUSEO LEONORA CARRINGTON SAN LUIS", "San Luis Potosí"), osm="Museo Leonora Carrington San Luis Potosí"),
    "C09": dict(kind="site", osm="Barrio de Tlaxcala, San Luis Potosí", access=("San Luis Potosí", "San Luis Potosí"), max_km=4),
    "C10": dict(kind="locality", loc=("Cerro de San Pedro", "Cerro de San Pedro"), osm="Cerro de San Pedro"),
    "C11": dict(kind="locality", loc=("Santa María del Río", "Santa María del Río"), osm="Santa María del Río"),
    "C12": dict(kind="none", why="Workshops are spread across Santa María del Río; use C11."),
    "C13": dict(kind="locality", loc=("Tierra Nueva", "Tierra Nueva"), osm="Tierra Nueva, San Luis Potosí"),
    "C14": dict(kind="none", why="A mountain range (area), not a point."),
    "C15": dict(kind="locality", loc=("Villa de Reyes", "Villa de Reyes"), osm="Villa de Reyes",
                note="Several haciendas; anchored on the municipal seat."),
    "M01": dict(kind="site", osm="Manantial de la Media Luna", access=("Rioverde", "Rioverde"), max_km=15),
    "M02": dict(kind="locality", loc=("Rioverde", "Rioverde"), osm="Rioverde"),
    "M03": dict(kind="locality", loc=("Ciudad Fernández", "Ciudad Fernández"), osm="Ciudad Fernández"),
    "M04": dict(kind="site", osm="Ojito de Agua, Ciudad Fernández", access=("Ciudad Fernández", "Ciudad Fernández"), max_km=5),
    "M05": dict(kind="site", osm="La Taza, Ciudad Fernández", alt=["Manantial La Taza"], access=("Ciudad Fernández", "Ciudad Fernández"), max_km=15),
    "M06": dict(kind="site", osm="Museo La Mezclita, Ciudad Fernández", alt=["La Mezclita", "Museo Arqueológico La Mezclita"], access=("Ciudad Fernández", "Ciudad Fernández"), max_km=10),
    "M07": dict(kind="locality", loc=("Ciudad Fernández", "Atotonilco"), osm="Atotonilco, Ciudad Fernández",
                note="Santuario point approximated by its community (Atotonilco)."),
    "M08": dict(kind="site", osm="El Balandrán, Ciudad Fernández", alt=["Balandrán", "Hacienda El Balandrán"], access=("Ciudad Fernández", "Ciudad Fernández"), max_km=8),
    "M09": dict(kind="locality", loc=("Ciudad del Maíz", "Ciudad del Maíz"), osm="Ciudad del Maíz"),
    "M10": dict(kind="site", osm="Casa Barraganeña, Ciudad del Maíz", alt=["Presidencia Municipal, Ciudad del Maíz", "Casa Barraganeña"], access=("Ciudad del Maíz", "Ciudad del Maíz"), max_km=2),
    "M11": dict(kind="site", osm="Parroquia de la Purísima Concepción, Ciudad del Maíz", alt=["Parroquia, Ciudad del Maíz", "Purísima Concepción Ciudad del Maíz"], access=("Ciudad del Maíz", "Ciudad del Maíz"), max_km=2),
    "M12": dict(kind="locality", loc=("Ciudad del Maíz", "El Tepeyac"), osm="El Tepeyac, Ciudad del Maíz"),
    "M13": dict(kind="locality", loc=("Santa Catarina", "Santa María Acapulco"), osm="Santa María Acapulco"),
    "M14": dict(kind="site", osm="Grutas de la Catedral, Rioverde", access=("Rioverde", "Los Alamitos"), max_km=8, alt=["Gruta de la Catedral"]),
    "M15": dict(kind="none", why="Agricultural landscape of the Rioverde basin, not a point."),
    "H01": dict(kind="site", osm="Cascada de Tamul", access=("Aquismón", "La Morena"), max_km=15),
    "H02": dict(kind="none", why="A river is a line; the visitor access point needs an official source."),
    "H03": dict(kind="site", osm="Cueva del Agua, Aquismón", access=("Aquismón", "Aquismón"), max_km=25),
    "H04": dict(kind="site", osm="Sótano de las Golondrinas, Aquismón", access=("Aquismón", "Aquismón"), max_km=15),
    "H05": dict(kind="site", osm="Sótano de las Huahuas", access=("Aquismón", "Aquismón"), max_km=20),
    "H06": dict(kind="locality", loc=("Aquismón", "Aquismón"), osm="Aquismón"),
    "H07": dict(kind="locality", loc=("Xilitla", "Xilitla"), osm="Xilitla"),
    "H08": dict(kind="site", osm="Las Pozas, Xilitla", access=("Xilitla", "Xilitla"), max_km=5),
    "H09": dict(kind="site", osm="Convento de San Agustín, Xilitla", alt=["Ex Convento de San Agustín", "Parroquia de San Agustín, Xilitla"], access=("Xilitla", "Xilitla"), max_km=2),
    "H10": dict(kind="site", osm="Cascadas de Tamasopo, Tamasopo", access=("Tamasopo", "Tamasopo"), max_km=10),
    "H11": dict(kind="site", osm="Puente de Dios, Tamasopo", access=("Tamasopo", "Tamasopo"), max_km=10),
    "H12": dict(kind="site", osm="Cascadas de Micos, Ciudad Valles", access=("Ciudad Valles", "Ciudad Valles"), max_km=40),
    "H13": dict(kind="site", osm="Cascada de Minas Viejas", access=("El Naranjo", "Minas Viejas"), max_km=8),
    "H14": dict(kind="site", osm="Cascada El Meco", access=("El Naranjo", "Colonia el Meco"), max_km=8),
    "H15": dict(kind="site", osm="Cascada El Salto, El Naranjo", access=("El Naranjo", "Colonia Salto del Agua"), max_km=8, alt=["Salto del Agua, El Naranjo"]),
    "H16": dict(kind="inah", official=(21.924445, -98.812866), osm="Tamtoc, Tamuín, San Luis Potosí"),
    "H17": dict(kind="locality", loc=("Ciudad Valles", "Ciudad Valles"), osm="Ciudad Valles"),
    "H18": dict(kind="none", why="Intangible heritage (Xantolo) celebrated across many Huasteca communities."),
}
# cache keys already used in pass 1 (reuse instead of re-asking)
OLD = {pid: f"{pid}.r2" if (CACHE / f"{pid}.r2.json").exists() else pid for pid in PLAN}

places = {p["place_id"]: p for p in json.loads((ROOT / "generated/workbook-places.json").read_text(encoding="utf-8"))["places"]}
out = {}
for pid, plan in PLAN.items():
    kind = plan["kind"]
    rec = {"place_id": pid, "name": places[pid]["name"], "method": kind}
    if kind == "none":
        rec.update({"latitude": None, "longitude": None, "verification_status": "unavailable", "precision": None,
                    "coordinate_source": None, "source_url": None, "crosscheck_source": None,
                    "crosscheck_distance_m": None, "notes": plan["why"]})
        out[pid] = rec
        continue
    # OSM (cross-check or provisional point)
    key = OLD[pid] if (CACHE / f"{OLD[pid]}.json").exists() and pid not in ("A03",) else f"{pid}.p2"
    if kind == "locality":
        key = f"{pid}.loc"
        data = nominatim(key, plan["osm"], {"featureType": "settlement"})
        osm = osm_best(data, prefer_place=True)
    else:
        data = nominatim(key, plan["osm"])
        for i, q in enumerate(plan.get("alt", [])):
            if data:
                break
            data = nominatim(f"{pid}.alt{i}", q)
        osm = osm_best(data)
    if kind == "inah":
        lat, lon = plan["official"]
        rec.update({"latitude": lat, "longitude": lon, "precision": "site", "coordinate_source": "INAH ficha Tamtoc",
                    "source_id": "inah-lugares-tamtoc", "source_url": "https://lugares.inah.gob.mx/es/node/4460",
                    "verification_status": "verified"})
    elif kind == "denue":
        hit = denue(*plan["denue"])
        if isinstance(hit, dict):
            rec.update({"latitude": round(float(hit["latitud"]), 6), "longitude": round(float(hit["longitud"]), 6),
                        "precision": "site", "coordinate_source": f'INEGI DENUE: {hit["nom_estab"]} ({hit["nombre_act"]})',
                        "source_id": "inegi-denue", "source_url": DENUE_URL, "verification_status": "verified",
                        "denue_id": hit["id"], "denue_alta": hit.get("fecha_alta")})
        else:
            rec.update({"verification_status": "pending", "notes": f"DENUE match ambiguous or missing ({plan['denue'][0]})."})
            kind = "site"
    elif kind == "locality":
        loc = LOC.get((norm(plan["loc"][0]), norm(plan["loc"][1])))
        if loc:
            rec.update({"latitude": loc["lat"], "longitude": loc["lon"], "precision": "locality",
                        "coordinate_source": f'INEGI ITER 2020: {loc["loc"]}, {loc["mun"]} (cve {loc["cve"]})',
                        "source_id": "inegi-iter-2020", "source_url": ITER_URL, "verification_status": "verified",
                        "inegi_altitude_m": loc["altitude_m"]})
        else:
            rec.update({"verification_status": "pending", "notes": f"INEGI locality not found: {plan['loc']}"})
    if rec.get("verification_status") == "verified":
        rec["crosscheck_source"] = "osm-nominatim" if osm else None
        rec["crosscheck_osm"] = osm
        rec["crosscheck_distance_m"] = haversine((rec["latitude"], rec["longitude"]), (osm["lat"], osm["lon"])) if osm else None
        limit = 2500 if rec["precision"] == "locality" else 600
        if rec["crosscheck_distance_m"] is not None and rec["crosscheck_distance_m"] > limit:
            rec["notes"] = (rec.get("notes", "") + f" OSM cross-check is {rec['crosscheck_distance_m']} m away "
                            f"(> {limit} m); official point kept, OSM match may be a different feature.").strip()
    elif kind == "site":
        if osm:
            acc = LOC.get((norm(plan["access"][0]), norm(plan["access"][1])))
            d = haversine((osm["lat"], osm["lon"]), (acc["lat"], acc["lon"])) if acc else None
            mun_ok = bool(osm["municipality"]) and norm(plan["access"][0]) in norm(osm["municipality"])
            plausible = d is not None and d <= plan["max_km"] * 1000
            rec.update({"latitude": round(osm["lat"], 6), "longitude": round(osm["lon"], 6), "precision": "site",
                        "coordinate_source": f'OpenStreetMap {osm["osm"]} ({osm["feature"]}, "{osm["name"]}")',
                        "source_id": "osm-nominatim", "source_url": f'https://www.openstreetmap.org/{osm["osm"]}',
                        "verification_status": "pending",
                        "crosscheck_source": f'INEGI ITER 2020 access locality: {plan["access"][1]}, {plan["access"][0]}',
                        "crosscheck_distance_m": d,
                        "plausibility": {"within_km": plan["max_km"], "distance_ok": plausible,
                                         "osm_municipality": osm["municipality"], "municipality_ok": mun_ok},
                        "map_status": "provisional" if plausible else "pending"})
            if not plausible:
                # never keep a point that failed the plausibility check
                rec["rejected_candidate"] = {k: rec.pop(k) for k in ("latitude", "longitude", "coordinate_source", "source_url")}
                rec.update({"latitude": None, "longitude": None, "coordinate_source": None, "source_url": None, "precision": None})
                rec["notes"] = (rec.get("notes", "") + f" Rejected OSM match {d} m from the access locality (limit "
                                f"{plan['max_km']} km): a different feature.").strip()
        else:
            rec.update({"latitude": None, "longitude": None, "precision": None, "coordinate_source": None,
                        "source_url": None, "crosscheck_source": None, "crosscheck_distance_m": None,
                        "verification_status": "pending", "notes": (rec.get("notes", "") + " No OSM feature found.").strip()})
    if "note" in plan:
        rec["notes"] = (plan["note"] + " " + rec.get("notes", "")).strip()
    rec.setdefault("map_status", "ready" if rec.get("verification_status") == "verified" else rec.get("map_status", "pending"))
    out[pid] = rec
    print(pid, rec["verification_status"], rec.get("map_status"), rec.get("precision"), rec.get("crosscheck_distance_m"), rec.get("notes", "")[:90])

(ROOT / "generated" / "coordinates.json").write_text(json.dumps({
    "generated": date.today().isoformat(),
    "sources": {"inegi-iter-2020": ITER_URL, "inegi-denue": DENUE_URL, "inah-lugares-tamtoc": "https://lugares.inah.gob.mx/es/node/4460",
                "osm-nominatim": "https://nominatim.openstreetmap.org/ (ODbL, © OpenStreetMap contributors)"},
    "datum": "INEGI data in ITRF2008/ITRF92 geographic coordinates, treated as WGS84 for web mapping (difference < 1 m).",
    "rules": __doc__.split("Rules")[1].split("Nominatim:")[0].strip(),
    "places": out}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
from collections import Counter
print(Counter(r["verification_status"] for r in out.values()), Counter(r.get("map_status") for r in out.values()))
