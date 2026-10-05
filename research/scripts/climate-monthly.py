"""Monthly climate summaries (2016–2025) from the Open-Meteo historical archive.

Quantitative support only: modelled reanalysis at the grid cell nearest each point, not an official
climate normal (official alternative: SMN/CONAGUA station normals). Never used on its own to make a
tourism recommendation.

Points are verified INEGI ITER 2020 locality coordinates (research/generated/coordinates.json).
Sequential requests, cached in research/raw/weather/archive_<id>.json.
Output: research/generated/climate-monthly.json
"""
import json, os, time, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "raw" / "weather"
CACHE.mkdir(parents=True, exist_ok=True)
UA = "slp-academic-mvp-research/0.2 (academic project; contact: %s)" % os.environ.get("SLP_RESEARCH_CONTACT", "see repository")
coords = json.loads((ROOT / "generated" / "coordinates.json").read_text(encoding="utf-8"))["places"]

POINTS = {  # point id -> (place_id of a verified INEGI locality, region, role)
    "altiplano": ("A06", "altiplano", "region"),     # Matehuala
    "centro": ("C01", "centro", "region"),           # San Luis Potosí
    "zona-media": ("M02", "zona-media", "region"),   # Rioverde
    "huasteca": ("H17", "huasteca", "region"),       # Ciudad Valles
    "real-de-catorce": ("A01", "altiplano", "destination"),
    "xilitla": ("H07", "huasteca", "destination"),
}
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
          "noviembre", "diciembre"]

out = {}
for pid, (place, region, role) in POINTS.items():
    c = coords[place]
    assert c["verification_status"] == "verified", place
    f = CACHE / f"archive_{pid}.json"
    if not f.exists():
        url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode({
            "latitude": c["latitude"], "longitude": c["longitude"], "start_date": "2016-01-01", "end_date": "2025-12-31",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum", "timezone": "America/Mexico_City"})
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
            f.write_bytes(r.read())
        time.sleep(1.1)
    d = json.loads(f.read_text())["daily"]
    tmax, tmin = defaultdict(list), defaultdict(list)
    prec, rdays = defaultdict(lambda: defaultdict(float)), defaultdict(lambda: defaultdict(int))
    for t, a, b, p in zip(d["time"], d["temperature_2m_max"], d["temperature_2m_min"], d["precipitation_sum"]):
        m, y = int(t[5:7]), t[:4]
        if a is not None: tmax[m].append(a)
        if b is not None: tmin[m].append(b)
        if p is not None:
            prec[m][y] += p
            rdays[m][y] += p >= 1.0
    rows = []
    for m in range(1, 13):
        rows.append({"month": m, "name_es": MONTHS[m - 1],
                     "tmax_mean_c": round(sum(tmax[m]) / len(tmax[m]), 1), "tmin_mean_c": round(sum(tmin[m]) / len(tmin[m]), 1),
                     "precip_mm": round(sum(prec[m].values()) / len(prec[m]), 0),
                     "rain_days": round(sum(rdays[m].values()) / len(rdays[m]), 1)})
    wettest = sorted(rows, key=lambda r: -r["precip_mm"])[:4]
    out[pid] = {"place_id": place, "name": c["name"], "region": region, "role": role,
                "latitude": c["latitude"], "longitude": c["longitude"], "coordinate_source": c["coordinate_source"],
                "grid_elevation_m": json.loads(f.read_text()).get("elevation"),
                "months": rows, "wettest_months": [r["month"] for r in wettest],
                "annual_precip_mm": round(sum(r["precip_mm"] for r in rows))}
    print(pid, out[pid]["annual_precip_mm"], "mm; wettest", out[pid]["wettest_months"],
          "| Jan", rows[0]["tmax_mean_c"], "/", rows[0]["tmin_mean_c"], "| May", rows[4]["tmax_mean_c"], "/", rows[4]["tmin_mean_c"])

(ROOT / "generated" / "climate-monthly.json").write_text(json.dumps({
    "generated": "2026-10-05", "source": "Open-Meteo Historical Weather API (archive-api.open-meteo.com), daily 2016-01-01..2025-12-31",
    "licence": "CC BY 4.0 — attribution: Open-Meteo.com", "label_es": "Promedio modelado 2016–2025 (reanálisis), no normal climatológica oficial",
    "label_en": "Modelled 2016–2025 average (reanalysis), not an official climate normal",
    "verification_status": "supporting-data", "points": out}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
