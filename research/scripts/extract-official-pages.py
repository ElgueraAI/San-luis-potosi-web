"""Extract readable text from cached official destination pages.

Input:  research/raw/pages/lugar_<slug>.html  (fetched from turismo.slp.gob.mx/lugares/<slug>/)
Output: research/raw/pages/extracted.json      (git-ignored; used to write sourced descriptions)

Only text that sits above the portal footer is kept. Coordinates are reported
only if the page itself prints them; Google Maps links are kept as given
(they are text searches, not coordinates).
"""
import glob, html, json, re
from pathlib import Path

PAGES = Path(__file__).resolve().parents[1] / "raw" / "pages"
FOOTER = re.compile(r"Todos los derechos|Red de Portales|Aviso de privacidad|Unidad de Sistemas")

out = {}
for f in sorted(PAGES.glob("lugar_*.html")):
    s = f.read_text(encoding="utf-8")
    title = html.unescape(re.search(r"<title[^>]*>(.*?)</title>", s, re.S).group(1).strip())
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", s, flags=re.S)
    lines = [re.sub(r"\s+", " ", l).strip() for l in html.unescape(re.sub(r"<[^>]+>", "\n", body)).split("\n")]
    text = []
    for l in (l for l in lines if len(l) > 40):
        if FOOTER.search(l):
            break
        text.append(l)
    coords = re.findall(r"(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{2,3}\.\d{4,})", s)
    maps = sorted({html.unescape(m) for m in re.findall(
        r"(?:maps\.google\.com/maps\?q=|google\.com/maps/search/\?api=1&query=)([^\"']*)", s)})
    slug = f.stem[len("lugar_"):]
    out[slug] = {"url": f"https://turismo.slp.gob.mx/lugares/{slug}/", "title": title,
                 "text": text, "coords_on_page": coords[:3], "maps_queries": maps}

(PAGES / "extracted.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
for k, v in out.items():
    print("=====", k, "|", v["title"], "| coords", v["coords_on_page"])
    for l in v["text"]:
        print("  ", l[:700])
    print("   MAPS:", [m[:120] for m in v["maps_queries"]])
