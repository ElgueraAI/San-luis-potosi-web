"""Municipality → tourism region map for San Luis Potosí.

Authority (highest first):
  1. Plan Estatal de Desarrollo Urbano de San Luis Potosí (PDU-SLP), Gobierno del Estado — region and
     microregion of every municipality (read 2026-10-05 at ambiental.uaslp.mx/historico/productos/pduslp/21_regio.htm).
  2. Plan Estatal de Desarrollo 2021–2027 (Decreto 0286, 21 Mar 2022): confirms 4 regions (Altiplano, Centro,
     Media, Huasteca) and 58 municipalities; no per-municipality list in its text.
  3. The 4 official regional tourism brochures (Secretaría de Turismo 2021–2027): the municipalities each one
     describes in its texts and activities table.
Municipality names: INEGI ITER 2020 (official spelling).

Status: verified = PDU-SLP lists it and no brochure contradicts it, or a contradiction was resolved by authority
and is documented; pending = no source covers it; conflict = sources disagree and no authority settles it.
"""
import csv, io, json, re, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDU_URL = "https://ambiental.uaslp.mx/historico/productos/pduslp/21_regio.htm"

def norm(s):
    s = s.lower()
    for a, b in zip("áéíóúüñ", "aeiouun"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

# PDU-SLP microregions, names as printed there.
PDU = {
    ("altiplano", "Altiplano Oeste"): ["Salinas", "Villa de Ramos", "Santo Domingo"],
    ("altiplano", "Altiplano Centro"): ["Charcas", "Venado", "Moctezuma", "Villa de Arista", "Villa Hidalgo"],
    ("altiplano", "Altiplano Este"): ["Matehuala", "Cedral", "Vanegas", "Catorce", "Villa de la Paz", "Villa de Guadalupe", "Guadalcázar"],
    ("centro", "San Luis Norte"): ["San Luis Potosí", "Soledad de Graciano Sánchez", "Mexquitic", "Cerro de San Pedro", "Armadillo",
                                   "Villa de Arriaga", "Ahualulco", "Zaragoza"],
    ("centro", "San Luis Sur"): ["Santa María del Río", "Villa de Reyes", "Tierranueva"],
    ("zona-media", "Media Oeste"): ["Rioverde", "Ciudad Fernández", "San Ciro de Acosta", "Villa Juárez", "Cerritos", "San Nicolás Tolentino"],
    ("zona-media", "Media Este"): ["Ciudad del Maíz", "Alaquines", "Cárdenas", "Rayón", "Santa Catarina", "Lagunillas"],
    ("huasteca", "Huasteca Norte"): ["Ciudad Valles", "Ébano", "Tamuín", "Tamasopo", "El Naranjo", "Tanquián de Escobedo", "San Vicente Tancuayalab"],
    ("huasteca", "Huasteca Centro"): ["Tancanhuitz de Santos", "Tanlajás", "Tampamolón", "San Antonio", "Aquismón", "Huehuetlán"],
    ("huasteca", "Huasteca Sur"): ["Tamazunchale", "San Martín Chalchicuautla", "Tampacán", "Matlapa", "Xilitla", "Axtla de Terrazas", "Coxcatlán"],
}
# PDU spelling -> INEGI spelling where they differ
ALIAS = {"mexquitic": "mexquitic de carmona", "armadillo": "armadillo de los infante", "tierranueva": "tierra nueva",
         "tampamolon": "tampamolon corona", "tancanhuitz de santos": "tancanhuitz", "ebano": "ebano"}

# Municipalities each official brochure describes (texts + activities table), read in pass 1/2.
BROCHURE = {
    "altiplano": ["Matehuala", "Catorce", "Venado", "Guadalcázar", "Charcas", "Villa de la Paz", "Villa de Guadalupe",
                  "Salinas", "Cedral", "Moctezuma"],
    "centro": ["San Luis Potosí", "Cerro de San Pedro", "Soledad de Graciano Sánchez", "Santa María del Río", "Villa de Reyes",
               "Zaragoza", "Tierra Nueva", "Armadillo de los Infante", "Mexquitic de Carmona", "Ahualulco"],
    "zona-media": ["Rioverde", "Ciudad Fernández", "Cerritos", "Rayón", "Ciudad del Maíz", "San Nicolás Tolentino", "Lagunillas",
                   "Villa Juárez", "Cárdenas"],
    "huasteca": ["Ciudad Valles", "Aquismón", "Tamasopo", "El Naranjo", "Xilitla", "Tancanhuitz", "Axtla de Terrazas", "Tamuín",
                 "Huehuetlán"],
}
BROCHURE_ID = {"altiplano": "brochure-altiplano", "centro": "brochure-centro", "zona-media": "brochure-media", "huasteca": "brochure-huasteca"}

z = zipfile.ZipFile(ROOT / "raw" / "inegi" / "iter_24_cpv2020_csv.zip")
rows = csv.DictReader(io.StringIO(z.read("iter_24_cpv2020/conjunto_de_datos/conjunto_de_datos_iter_24CSV20.csv").decode("utf-8-sig")))
INEGI = {}
for r in rows:
    if r["MUN"] != "000":
        INEGI.setdefault(r["MUN"], r["NOM_MUN"])

pdu = {}
for (region, micro), names in PDU.items():
    for n in names:
        k = ALIAS.get(norm(n), norm(n))
        pdu[k] = (region, micro, n)

brochure_of = {}
for region, names in BROCHURE.items():
    for n in names:
        brochure_of.setdefault(norm(n), []).append(region)

out = []
for cve, name in sorted(INEGI.items()):
    k = norm(name)
    region, micro, pdu_name = pdu.get(k, (None, None, None))
    b = brochure_of.get(k, [])
    rec = {"municipality": name, "inegi_cve": f"24{cve}", "region": region, "microregion": micro,
           "source": "pdu-slp", "source_url": PDU_URL, "verification_status": "verified" if region else "pending",
           "corroboration": [{"source": BROCHURE_ID[x], "region": x} for x in b], "notes": None}
    if pdu_name and norm(pdu_name) != k:
        rec["notes"] = f"PDU-SLP spells it '{pdu_name}'."
    if b and region and any(x != region for x in b):
        rec["verification_status"] = "conflict"
        rec["notes"] = (rec["notes"] or "") + f" Brochure region {b} differs from PDU-SLP ({region})."
    out.append(rec)

# Documented border cases: El Naranjo and Tamasopo
for rec in out:
    if rec["municipality"] in ("El Naranjo", "Tamasopo"):
        rec["corroboration"].append({"source": "brochure-media", "region": "zona-media", "kind": "map context only"})
        rec["notes"] = ("Border case. The Región Media brochure map draws this municipality and marks its sites, but the "
                        "Media brochure does not describe it in its texts, activities table or distance table. The Huasteca "
                        "brochure describes it in all three, and PDU-SLP places it in the Huasteca Norte microregion. "
                        "Resolved by authority (state planning document + the brochure that actually describes it): Huasteca.")
        rec["border_case"] = True

# Villa de Pozos: created 23 Jul 2024 from part of San Luis Potosí; absent from INEGI 2020 and PDU-SLP.
out.append({"municipality": "Villa de Pozos", "inegi_cve": None, "region": None, "microregion": None, "source": None,
            "source_url": None, "verification_status": "pending", "corroboration": [],
            "notes": "Municipality no. 59, created by the state congress on 23 Jul 2024 from territory of San Luis Potosí "
                     "(Centro). No official tourism-region assignment found yet; geographically inside the Centro region."})

summary = {s: sum(r["verification_status"] == s for r in out) for s in ("verified", "pending", "conflict")}
for reg in ("altiplano", "centro", "zona-media", "huasteca"):
    summary[reg] = sum(r["region"] == reg for r in out)
(ROOT / "generated" / "municipality-region-map.json").write_text(json.dumps({
    "generated": "2026-10-05", "regions": ["altiplano", "centro", "zona-media", "huasteca"],
    "authority": __doc__.split("Authority (highest first):")[1].split("Status:")[0].strip(),
    "summary": summary, "municipalities": out}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(summary)
for r in out:
    if r["verification_status"] != "verified" or r.get("border_case"):
        print(r["municipality"], r["verification_status"], r["region"], (r["notes"] or "")[:100])
