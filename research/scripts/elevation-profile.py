"""The Descent: a measured elevation profile from INEGI CEM 3.0 (90 m), standard library only.

Transect (documented in research/reports/elevation-methodology.md):
  Real de Catorce -> San Luis Potosí -> Rioverde -> Ciudad Valles
  Anchors are INEGI ITER 2020 locality points (official). Between anchors the path is a
  great-circle segment. Samples every ~1 km along the path; elevation is bilinear
  interpolation of the four surrounding CEM cells (NODATA cells are skipped).

Region of each sample: municipality of the nearest INEGI locality (ITER 2020), mapped through
research/generated/municipality-region-map.json. This is a nearest-locality approximation of the
municipal boundary, documented as such.

Inputs (git-ignored): research/raw/inegi/CEM_V3_20170619_R90_E24.zip, iter_24_cpv2020_csv.zip
Output: research/generated/elevation-profile.json
"""
import csv, hashlib, io, json, math, re, struct, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw" / "inegi"
CEM_ZIP = RAW / "CEM_V3_20170619_R90_E24.zip"
CEM_URL = ("https://www.inegi.org.mx/app/geo2/elevacionesmex/DownloadFile.do?"
           "file=CEM_V3_20170619_R90_E24.zip&res=90&entidad=San%20Luis%20Potos%C3%AD")
STEP_KM = 1.0

def norm(s):
    s = s.lower()
    for a, b in zip("áéíóúüñ", "aeiouun"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def dms(v):
    m = re.match(r"\s*(\d+)°(\d+)'([\d.]+)\"\s*([NSEW])", v)
    d = int(m.group(1)) + int(m.group(2)) / 60 + float(m.group(3)) / 3600
    return -d if m.group(4) in "SW" else d

# ---- raster
z = zipfile.ZipFile(CEM_ZIP)
hdr = dict(l.split(None, 1) for l in z.read("SanLuisPotosi15_r90m.hdr").decode().splitlines() if l.strip())
NROWS, NCOLS = int(hdr["NROWS"]), int(hdr["NCOLS"])
X0, Y0, DX, DY = float(hdr["ULXMAP"]), float(hdr["ULYMAP"]), float(hdr["XDIM"]), float(hdr["YDIM"])
NODATA = int(hdr["NODATA"])
assert hdr["BYTEORDER"].strip() == "I" and hdr["NBITS"].strip() == "16"
BIL = z.read("SanLuisPotosi15_r90m.bil")
assert len(BIL) == NROWS * NCOLS * 2

def cell(r, c):
    if not (0 <= r < NROWS and 0 <= c < NCOLS):
        return None
    v = struct.unpack_from("<h", BIL, (r * NCOLS + c) * 2)[0]
    return None if v == NODATA else v

def elevation(lat, lon):
    # ULXMAP/ULYMAP are the centre of the upper-left cell (ESRI BIL convention)
    fc, fr = (lon - X0) / DX, (Y0 - lat) / DY
    c0, r0 = math.floor(fc), math.floor(fr)
    tx, ty = fc - c0, fr - r0
    vals = [(cell(r0, c0), (1 - tx) * (1 - ty)), (cell(r0, c0 + 1), tx * (1 - ty)),
            (cell(r0 + 1, c0), (1 - tx) * ty), (cell(r0 + 1, c0 + 1), tx * ty)]
    vals = [(v, w) for v, w in vals if v is not None]
    if not vals:
        return None
    return sum(v * w for v, w in vals) / sum(w for _, w in vals)

# ---- anchors and locality index
zi = zipfile.ZipFile(RAW / "iter_24_cpv2020_csv.zip")
rows = list(csv.DictReader(io.StringIO(zi.read("iter_24_cpv2020/conjunto_de_datos/conjunto_de_datos_iter_24CSV20.csv").decode("utf-8-sig"))))
locs = [(dms(r["LATITUD"]), dms(r["LONGITUD"]), r["NOM_MUN"], r["NOM_LOC"], r["ALTITUD"]) for r in rows
        if r["LOC"] not in ("0000", "9998", "9999") and r["LONGITUD"].strip()]

def loc(mun, name):
    for la, lo, m, n, alt in locs:
        if norm(m) == norm(mun) and norm(n) == norm(name):
            return {"name": n, "municipality": m, "lat": round(la, 6), "lon": round(lo, 6), "inegi_altitude_m": int(alt)}
    raise KeyError((mun, name))

ANCHORS = [loc("Catorce", "Real de Catorce"), loc("San Luis Potosí", "San Luis Potosí"),
           loc("Rioverde", "Rioverde"), loc("Ciudad Valles", "Ciudad Valles")]

region_map = {norm(m["municipality"]): m["region"] for m in json.loads(
    (ROOT / "generated" / "municipality-region-map.json").read_text(encoding="utf-8"))["municipalities"]}

# coarse grid index for nearest-locality lookups
GRID = {}
for la, lo, m, n, _ in locs:
    GRID.setdefault((int(la * 10), int(lo * 10)), []).append((la, lo, m, n))

def nearest_municipality(lat, lon):
    best, bd = None, 1e9
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for la, lo, m, n in GRID.get((int(lat * 10) + di, int(lon * 10) + dj), []):
                d = (la - lat) ** 2 + ((lo - lon) * math.cos(math.radians(lat))) ** 2
                if d < bd:
                    best, bd = (m, n), d
    return best

def gc_interp(a, b, f):
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    d = 2 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
    A, B = math.sin((1 - f) * d) / math.sin(d), math.sin(f * d) / math.sin(d)
    x = A * math.cos(la1) * math.cos(lo1) + B * math.cos(la2) * math.cos(lo2)
    y = A * math.cos(la1) * math.sin(lo1) + B * math.cos(la2) * math.sin(lo2)
    zc = A * math.sin(la1) + B * math.sin(la2)
    return math.degrees(math.atan2(zc, math.hypot(x, y))), math.degrees(math.atan2(y, x)), d * 6371.0

samples, dist0 = [], 0.0
for i in range(len(ANCHORS) - 1):
    a, b = ANCHORS[i], ANCHORS[i + 1]
    _, _, seg_km = gc_interp(a, b, 0.5)
    n = max(1, round(seg_km / STEP_KM))
    for k in range(0 if i == 0 else 1, n + 1):
        lat, lon, _ = gc_interp(a, b, k / n)
        e = elevation(lat, lon)
        mun = nearest_municipality(lat, lon)
        samples.append({"order": len(samples), "distance_km": round(dist0 + seg_km * k / n, 2),
                        "longitude": round(lon, 6), "latitude": round(lat, 6),
                        "elevation_m": round(e, 1) if e is not None else None,
                        "nearest_locality": f"{mun[1]}, {mun[0]}" if mun else None,
                        "region": region_map.get(norm(mun[0])) if mun else None,
                        "leg": f'{a["name"]} → {b["name"]}'})
    dist0 += seg_km

# region segments (contiguous runs)
segments = []
for s in samples:
    if not segments or segments[-1]["region"] != s["region"]:
        segments.append({"region": s["region"], "from_km": s["distance_km"], "to_km": s["distance_km"],
                         "from_order": s["order"], "to_order": s["order"]})
    segments[-1]["to_km"], segments[-1]["to_order"] = s["distance_km"], s["order"]
el = [s["elevation_m"] for s in samples if s["elevation_m"] is not None]
for a in ANCHORS:
    a["cem_elevation_m"] = round(elevation(a["lat"], a["lon"]), 1)

out = {
    "status": "measured",
    "verification_status": "verified",
    "verification_note": "Elevations are read from the official INEGI CEM 3.0 raster. The transect is an editorial "
                         "choice documented in elevation-methodology.md; region labels are a nearest-locality approximation.",
    "source": {"name": "INEGI Continuo de Elevaciones Mexicano 3.0 (CEM), San Luis Potosí, 90 m",
               "file": CEM_ZIP.name, "url": CEM_URL, "sha256": hashlib.sha256(CEM_ZIP.read_bytes()).hexdigest(),
               "retrieved": "2026-10-05", "resolution": "3 arc-seconds (~90 m)", "datum": "ITRF92 geographic (GRS80)",
               "grid": {"rows": NROWS, "cols": NCOLS, "ulx": X0, "uly": Y0, "cell_deg": DX, "nodata": NODATA}},
    "transect": {"anchors": ANCHORS, "anchor_source": "INEGI ITER 2020 locality points",
                 "path": "great-circle segments between consecutive anchors", "sample_step_km": STEP_KM,
                 "interpolation": "bilinear over the 4 nearest CEM cells",
                 "length_km": round(dist0, 1), "samples": len(samples)},
    "summary": {"max_m": max(el), "min_m": min(el),
                "start_m": samples[0]["elevation_m"], "end_m": samples[-1]["elevation_m"]},
    "region_segments": segments,
    "samples": samples,
}
(ROOT / "generated" / "elevation-profile.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(json.dumps({k: out[k] for k in ("summary",)}, ensure_ascii=False), out["transect"]["length_km"], "km", len(samples), "samples")
for s in segments:
    print(s)
for a in ANCHORS:
    print(a["name"], "INEGI", a["inegi_altitude_m"], "CEM", a["cem_elevation_m"])
