"""Download originals of the SELECTED assets used in Tier-1 slots (home + Huasteca manifests).

Only assets whose licence permits the intended use (modification allowed) are downloaded.
Originals go to research/raw/media-originals/ (git-ignored). Sequential, identifying User-Agent.
Output: research/media-registry/downloads.json
"""
import hashlib, json, os, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MR = ROOT / "media-registry"
OUT = ROOT / "raw" / "media-originals"
OUT.mkdir(parents=True, exist_ok=True)
UA = "slp-academic-mvp-research/0.2 (academic project; contact: %s)" % os.environ.get("SLP_RESEARCH_CONTACT", "see repository")

reviewed = {x["asset_id"]: x for x in json.loads((MR / "media-reviewed.json").read_text(encoding="utf-8"))["assets"]}
attr = {a["asset_id"]: a for a in json.loads((MR / "attributions.json").read_text(encoding="utf-8"))["attributions"]}
need = []
for m in ("home-asset-manifest.json", "huasteca-asset-manifest.json"):
    doc = json.loads((MR / m).read_text(encoding="utf-8"))
    for s in doc["slots"]:
        if s.get("tier") == 1 and s.get("asset_id") and s["asset_id"] not in need:
            need.append(s["asset_id"])
for reg in json.loads((MR / "home-asset-manifest.json").read_text(encoding="utf-8"))["region_signature_assets"].values():
    for k in ("hero_desktop", "hero_mobile", "card"):
        a = reg[k]["asset_id"]
        if a and a not in need:
            need.append(a)

PEXELS_URL = "https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg"
log = []
for aid in need:
    x, a = reviewed[aid], attr.get(aid)
    if not a or not a["modification_allowed"]:
        log.append({"asset_id": aid, "downloaded": False, "reason": "licence does not clearly permit modification"})
        continue
    url = x.get("file_url") or (PEXELS_URL.format(id=aid[3:]) if aid.startswith("px-") else None)
    ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
    f = OUT / f"{aid}{ext}"
    if not f.exists():
        for attempt in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=180) as r:
                    f.write_bytes(r.read())
                break
            except urllib.error.HTTPError as e:
                if e.code != 429 or attempt == 4:
                    raise
                time.sleep(int(e.headers.get("Retry-After") or 0) or 20 * (attempt + 1))
        time.sleep(2)
    log.append({"filename": f.name, "asset_id": aid, "source_url": x["source_url"], "file_url": url, "author": x["author"],
                "licence": x["licence"], "sha256": hashlib.sha256(f.read_bytes()).hexdigest(), "bytes": f.stat().st_size,
                "original_resolution": f'{x["width"]}×{x["height"]}', "downloaded": True, "retrieved": "2026-10-05"})
    print(aid, f.stat().st_size)
(MR / "downloads.json").write_text(json.dumps({"generated": "2026-10-05", "location": "research/raw/media-originals (git-ignored)",
                                               "count": sum(l["downloaded"] for l in log), "files": log},
                                              ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(sum(l["downloaded"] for l in log), "downloaded")
