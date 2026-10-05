"""Build contact-sheet HTML from the Commons API cache and whatever review thumbnails exist.

Independent of media-review.py so review can start while thumbnails are still downloading.
Usage: python research/scripts/make-sheets.py [group ...]   (group = cache key, e.g. H01 H01b T-xantolo)
Writes research/raw/media-review/sheets/<group>-<n>.html and index-<group>.json (git-ignored).
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "raw" / "commons"
THUMBS = ROOT / "raw" / "media-review" / "thumbs"
SHEETS = ROOT / "raw" / "media-review" / "sheets"
SHEETS.mkdir(parents=True, exist_ok=True)

groups = sys.argv[1:] or sorted(p.stem for p in CACHE.glob("*.json"))
for g in groups:
    f = CACHE / f"{g}.json"
    if not f.exists():
        continue
    pages = sorted((json.loads(f.read_text(encoding="utf-8")).get("query") or {}).get("pages", {}).values(),
                   key=lambda p: p.get("index", 99))
    items = []
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        t = THUMBS / f'wc-{p["pageid"]}.jpg'
        if not t.exists():
            continue
        lic = ((ii.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value", "?")
        items.append((f'wc-{p["pageid"]}', ii.get("width"), ii.get("height"), lic, p["title"][5:75]))
    for i in range(0, len(items), 12):
        chunk = items[i:i + 12]
        name = f"{g}-{i // 12 + 1}"
        tiles = "".join(f'<figure><img src="../thumbs/{a}.jpg"><figcaption><b>{j + 1}</b> {a} · {w}×{h} · {lic}<br>{t}</figcaption></figure>'
                        for j, (a, w, h, lic, t) in enumerate(chunk))
        (SHEETS / f"{name}.html").write_text(
            '<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:10px;background:#222;color:#eee;font:13px/1.25 Arial}'
            'h1{font-size:18px;margin:0 0 8px}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}figure{margin:0;background:#333}'
            'img{width:100%;height:230px;object-fit:contain;background:#111;display:block}figcaption{padding:4px 6px;height:34px;overflow:hidden}</style>'
            f'<h1>{name}</h1><div class="g">{tiles}</div>', encoding="utf-8")
        print(name, len(chunk))
