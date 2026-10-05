"""Read-only export of the master place list from the visual library workbook.

Opens the .xlsx as a zip (standard library only), never writes to it.
Output: research/generated/workbook-places.json
"""
import json, re, sys, zipfile, xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

SRC = Path(r"C:\Users\jerry\slp-library\Biblioteca_Visual_San_Luis_Potosi_Web.xlsx")
OUT = Path(__file__).resolve().parents[1] / "generated" / "workbook-places.json"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "pr": "http://schemas.openxmlformats.org/package/2006/relationships"}
SHEETS = {"01_ALTIPLANO": "altiplano", "02_CENTRO": "centro", "03_MEDIA": "zona-media", "04_HUASTECA": "huasteca"}
FIELDS = ["place_id", "region_label", "name", "municipality", "type", "visual_narrative", "hero_shot",
          "secondary_shots", "best_light", "target_formats", "priority", "official_source", "pexels_search",
          "unsplash_search", "wikimedia_search", "shutterstock_search", "status", "usage_note", "suggested_filename"]

def col(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1

with zipfile.ZipFile(SRC, "r") as z:
    ss = ["".join(t.text or "" for t in si.iter("{%s}t" % NS["m"]))
          for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels")).findall("pr:Relationship", NS)}
    places = []
    for sh in wb.find("m:sheets", NS):
        if sh.get("name") not in SHEETS:
            continue
        tgt = rels[sh.get("{%s}id" % NS["r"])]
        root = ET.fromstring(z.read(tgt.lstrip("/") if tgt.startswith("/") else "xl/" + tgt))
        for i, r in enumerate(root.iter("{%s}row" % NS["m"])):
            if i == 0:
                continue
            row = {}
            for c in r.findall("m:c", NS):
                v = c.find("m:v", NS)
                row[col(c.get("r"))] = ss[int(v.text)] if c.get("t") == "s" and v is not None else (v.text if v is not None else None)
            if not row:
                continue
            rec = {f: row.get(k) for k, f in enumerate(FIELDS)}
            rec["region"] = SHEETS[sh.get("name")]
            rec["sheet"] = sh.get("name")
            places.append(rec)

OUT.write_text(json.dumps({"source": str(SRC.name), "exported": date.today().isoformat(),
                           "note": "Workbook values are planning data, not verified facts.",
                           "count": len(places), "places": places}, ensure_ascii=False, indent=2), encoding="utf-8")
print(len(places), "places ->", OUT)
