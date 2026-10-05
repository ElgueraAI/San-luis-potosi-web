"""Quality checks for the research layer (pass 2A + 2B). Exit code 1 on any failure.

Run: python research/scripts/qa.py
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
fails, notes = [], []

def check(cond, msg):
    (notes if cond else fails).append(("OK  " if cond else "FAIL") + " " + msg)

# 1. every JSON parses
docs = {}
for f in sorted(ROOT.rglob("*.json")) + sorted(ROOT.rglob("*.geojson")):
    if "raw" in f.relative_to(ROOT).parts:
        continue
    try:
        docs[f.relative_to(ROOT).as_posix()] = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e:
        fails.append(f"FAIL invalid JSON {f}: {e}")
check(True, f"{len(docs)} JSON/GeoJSON files parse")

# 2. GeoJSON structure + every feature has coordinates inside the state
g = docs["generated/maplibre-places.geojson"]
ok = g["type"] == "FeatureCollection" and all(
    f["type"] == "Feature" and f["geometry"]["type"] == "Point" and len(f["geometry"]["coordinates"]) == 2
    and -102.4 <= f["geometry"]["coordinates"][0] <= -98.2 and 21.0 <= f["geometry"]["coordinates"][1] <= 24.6
    for f in g["features"])
check(ok, f"GeoJSON valid; {len(g['features'])} features all have [lon, lat] inside San Luis Potosí")
ids = [f["properties"]["place_id"] for f in g["features"]]
check(len(ids) == len(set(ids)), "no duplicate place_id in GeoJSON")
pend = {p["place_id"] for p in docs["generated/maplibre-pending.json"]["places"]}
check(not (pend & set(ids)), "no place is both mapped and pending")

# 3. duplicate IDs
for name, key, path in [("sources", "source_id", "source-registry/sources.json"),
                        ("resources", "resource_id", "pdf-registry/resources.json"),
                        ("events", "event_id", "generated/events.json"),
                        ("seasonal", "record_id", "generated/seasonal-calendar.json"),
                        ("brochure facts", "fact_id", "generated/brochure-tables.json"),
                        ("media", "asset_id", "media-registry/media-reviewed.json")]:
    d = docs[path]
    lst = d.get("sources") or d.get("resources") or d.get("events") or d.get("records") or d.get("facts") or d.get("assets")
    vals = [x[key] for x in lst]
    check(len(vals) == len(set(vals)), f"no duplicate {name} ids ({len(vals)})")

# 4. internal references
source_ids = {s["source_id"] for s in docs["source-registry/sources.json"]["sources"]}
resource_ids = {r["resource_id"] for r in docs["pdf-registry/resources.json"]["resources"]}
bad = []
def walk(o, where):
    if isinstance(o, dict):
        if o.get("status") in ("verified", "pending") and "source" in o and o["source"] not in source_ids:
            bad.append((where, o["source"]))
        for k, v in o.items():
            walk(v, where)
    elif isinstance(o, list):
        for v in o:
            walk(v, where)
for path, d in docs.items():
    if path.startswith("destinations/") or path.startswith("generated/"):
        walk(d, path)
for e in docs["generated/events.json"]["events"]:
    if e["source_id"] not in source_ids:
        bad.append(("events", e["source_id"]))
for r in docs["generated/seasonal-calendar.json"]["records"]:
    if r["source_id"] not in source_ids:
        bad.append(("seasonal", r["source_id"]))
for path, d in docs.items():
    if path.startswith("destinations/") and path != "destinations/index.json":
        for r in d.get("official_resources", []):
            if r not in resource_ids:
                bad.append((path, r))
check(not bad, f"all source/resource references resolve ({len(bad)} broken)" + (f": {bad[:5]}" if bad else ""))

# 5. media: every SELECTED asset has licence metadata and an attribution; slots point to SELECTED assets
rev = {a["asset_id"]: a for a in docs["media-registry/media-reviewed.json"]["assets"]}
attr = {a["asset_id"] for a in docs["media-registry/attributions.json"]["attributions"]}
sel = [a for a in rev.values() if a["status"] == "SELECTED"]
check(all(a["licence"] and a["source_url"] and a["author"] for a in sel), f"{len(sel)} SELECTED assets have licence, source URL and author")
check(all(a["asset_id"] in attr for a in sel), "every SELECTED asset has an attribution record")
check(not any(a["licence"] and ("NC" in a["licence"].upper().split("-") or "ND" in a["licence"].upper().split("-")) for a in sel),
      "no NC/ND licence among SELECTED assets")
check(all(a.get("visually_reviewed") for a in sel), "every SELECTED asset was visually reviewed")
slot_assets = []
for m in ("home-asset-manifest.json", "huasteca-asset-manifest.json"):
    slot_assets += [s["asset_id"] for s in docs[f"media-registry/{m}"]["slots"] if s.get("asset_id")]
for d in docs["media-registry/destination-asset-manifest.json"]["destinations"].values():
    slot_assets += [v for k, v in d["slots"].items() if isinstance(v, str)]
check(all(rev.get(a, {}).get("status") in ("SELECTED", "BACKUP") for a in slot_assets),
      f"all {len(slot_assets)} manifest slot references point to SELECTED/BACKUP assets")
# selected images match their destination (place_id present and consistent with the record)
mismatch = [a["asset_id"] for a in sel if a["place_id"] and a["region"] and
            docs.get(f"destinations/{a['place_id']}.json", {}).get("region", {}).get("value") not in (a["region"], None)]
check(not mismatch, f"selected asset regions match their destination's region ({mismatch[:5]})")

# 6. git: raw stays ignored, website untouched
def git(*a):
    return subprocess.run(["git", *a], cwd=REPO, capture_output=True, text=True).stdout
check(git("ls-files", "research/raw").strip() == "", "nothing under research/raw is tracked")
check(bool(git("check-ignore", "research/raw/media-originals/x.jpg").strip()), "research/raw/ is ignored")
untracked = git("status", "--porcelain", "--untracked-files=all", "research").splitlines()
check(not any("/raw/" in l for l in untracked), "no raw file shows as untracked")
check(git("status", "--porcelain", "--", "src", "public", "scrollcraft", "astro.config.mjs").strip() == "",
      "src/, public/, scrollcraft/, astro.config.mjs unchanged")
big = [l for l in untracked if (REPO / l[3:]).is_file() and (REPO / l[3:]).stat().st_size > 2_000_000]
check(not big, f"no new research file over 2 MB ({big})")

for n in notes + fails:
    print(n)
print(f"\n{len(notes)} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)
