"""Research pass 2A: geography, regions, coordinates, brochures, seasons, events, weather, destinations.

Run after (all produce inputs read here):
  build-registry.py (pass 1) -> build-regions.py -> coordinates.py -> elevation-profile.py -> climate-monthly.py
Then: python research/scripts/build-pass2a.py

Every fact carries a source id that must exist in source-registry/sources.json (checked).
Transcriptions from the image-only brochures were read at 300–400 % in Edge's PDF viewer
(research/scripts/render-pdf.mjs); unreadable items are not transcribed.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TODAY = "2026-10-05"
G = ROOT / "generated"

def load(rel):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))

def write(rel, data):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# ============================================================== registries: new sources and resources
src_doc = load("source-registry/sources.json")
SOURCES = {s["source_id"]: s for s in src_doc["sources"]}

def add_source(source_id, institution, domain, title, url, source_type, access="accessible", verification="official",
               notes=None, region=None, destination=None, retrieval=TODAY):
    SOURCES[source_id] = {"source_id": source_id, "institution": institution, "domain": domain, "title": title, "url": url,
                          "source_type": source_type, "region": region, "destination": destination,
                          "retrieval_date": retrieval, "accessibility_status": access, "verification_status": verification,
                          "notes": notes}

SEC_SLP = "Secretaría de Turismo del Estado de San Luis Potosí"
add_source("pdu-slp", "Gobierno del Estado de San Luis Potosí (hosted by UASLP)", "ambiental.uaslp.mx",
           "Plan Estatal de Desarrollo Urbano de San Luis Potosí – Regionalización",
           "https://ambiental.uaslp.mx/historico/productos/pduslp/21_regio.htm", "official-planning-document",
           notes="Region and microregion of every municipality (10 microregions). Undated page; cites 1995–1998 data. "
                 "Predates Villa de Pozos (2024).")
add_source("ped-slp-2021-2027", "Gobierno del Estado de San Luis Potosí", "cegaipslp.org.mx",
           "Plan Estatal de Desarrollo 2021–2027 (Decreto 0286, 21 Mar 2022)",
           "http://www.cegaipslp.org.mx/HV2021Tres.nsf/nombre_de_la_vista/4F1665879C6F7F368625883A00625CD3/$File/PLAN+ESTATAL+DE+DESARROLLO+2021-2027_1.pdf",
           "official-planning-document", notes="Confirms 4 regions and 58 municipalities; no per-municipality list in its text. "
                                               "Downloaded for analysis only (research/raw/docs, git-ignored).")
add_source("slp-gob-visita-altiplano", "Gobierno del Estado de San Luis Potosí", "slp.gob.mx", "Región Altiplano",
           "https://slp.gob.mx/visitasanluispotosi/region-altiplano/", "official-regional-page", region="altiplano",
           notes="States 'la ruta del Mezcal en el municipio de Charcas'. Updated 17/02/2026.")
add_source("inegi-iter-2020", "INEGI", "inegi.org.mx", "Principales resultados por localidad (ITER), Censo de Población y Vivienda 2020 – San Luis Potosí",
           "https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_24_cpv2020_csv.zip",
           "official-dataset", notes="Locality coordinates (DMS) and altitude for 6,729 localities. Modified 2022-05-19. "
                                     "sha256 a7b71f3f0c833ed70d7e9ed99da39394c754b11ca59e317747abc84f929e3080 (research/raw/inegi).")
add_source("inegi-denue", "INEGI", "inegi.org.mx", "Directorio Estadístico Nacional de Unidades Económicas (DENUE) – San Luis Potosí",
           "https://www.inegi.org.mx/contenidos/masiva/denue/denue_24_csv.zip", "official-dataset",
           notes="Establishment coordinates (museums, theatres, churches). File dated 2026-05-20. "
                 "sha256 6e611e177ab4483d6777301bb39829ac04a5bbc820046f64f5bbf110d8947269.")
add_source("inegi-cem-3-r90", "INEGI", "inegi.org.mx", "Continuo de Elevaciones Mexicano 3.0, San Luis Potosí, 90 m (BIL)",
           "https://www.inegi.org.mx/app/geo2/elevacionesmex/DownloadFile.do?file=CEM_V3_20170619_R90_E24.zip&res=90&entidad=San%20Luis%20Potos%C3%AD",
           "official-dataset", notes="Downloaded 2026-10-05 for the elevation profile. "
                                     "sha256 c0330c5447bccbf97ad2b00cc537bd5a3e8611890fccab33554abde9aa40877b.")
add_source("segam-anp", "Secretaría de Ecología y Gestión Ambiental (SEGAM), Gobierno del Estado", "segam.slp.gob.mx",
           "Áreas Naturales Protegidas", "https://segam.slp.gob.mx/areas-naturales-protegidas/", "official-environmental",
           access="accessible-via-webfetch",
           notes="State ANPs incl. Manantial de la Media Luna (Parque Estatal, 7 Jun 2003), Sótano de las Golondrinas and Hoya de "
                 "las Huahuas (multi-site decree), Wirikuta (Sitio Sagrado Natural, 10 Jun 2008), Sierra de San Miguelito "
                 "(20 Sep 2018), Real de Guadalcázar (Reserva Estatal, 27 Sep 1997), Joya Honda (Monumento Natural, 24 Apr 2021). "
                 "Federal: Sierra de Álvarez, Gogorrón, El Potosí, Sierra del Abra Tanchipa, La Mojonera.")
add_source("fenapo-2026", "Feria Nacional Potosina / Gobierno del Estado", "fenapo.slp.gob.mx", "FENAPO 2026, una aventura mágica de talla internacional",
           "https://fenapo.slp.gob.mx/noticias/2026/6/2/fenapo-2026-una-aventura-m%C3%A1gica-de-talla-internacional/",
           "official-event-page", access="accessible-via-webfetch", notes="'del 7 al 30 de agosto' 2026. Published 28 May 2026.")
add_source("cultura-slp-procesion-2026", "Secretaría de Cultura del Estado de San Luis Potosí", "cultura.slp.gob.mx",
           "Procesión del Silencio 2026", "https://cultura.slp.gob.mx/eventos/2026/4/2/procesi%C3%B3n-del-silencio-2026/",
           "official-event-page", access="accessible-via-webfetch", notes="Viernes 3 de abril de 2026, 20:00 h, Centro Histórico.")
add_source("cultura-gob-lila-lopez-2026", "Secretaría de Cultura, Gobierno de México", "gob.mx",
           "El Festival Internacional de Danza Contemporánea 'Lila López' conmemora su 46.ª edición con el apoyo de PROFEST",
           "https://www.gob.mx/cultura/prensa/el-festival-internacional-de-danza-contemporanea-lila-lopez-conmemora-su-46-edicion-con-el-apoyo-de-profest?idiom=es",
           "official-press-release", access="accessible-via-webfetch",
           notes="27 Jul 2026: 'del 24 de julio al 2 de agosto de 2026'; Matehuala, San Luis Potosí, Santa María del Río, Soledad, "
                 "Villa de Pozos, Villa de Reyes.")
add_source("slp-gob-xantolo-2025", "Gobierno del Estado de San Luis Potosí", "slp.gob.mx", "Xantolo generará más de 443 millones de pesos de derrama económica",
           "https://slp.gob.mx/noticias/2025/11/3/xantolo-generar%C3%A1-m%C3%A1s-de-443-millones-de-pesos-de-derrama-econ%C3%B3mica/",
           "official-press-release", access="accessible-via-webfetch", notes="31 Oct 2025: Xantolo period 29 Oct – 2 Nov 2025 (Huasteca).")
add_source("laspozas-xilitla-org", "Las Pozas, Xilitla (site operator; organisation not named on page)", "laspozasxilitla.org.mx",
           "Edward James", "https://laspozasxilitla.org.mx/edward-james/", "operator-page", verification="non-government",
           access="accessible-via-webfetch", notes="States 'Nació el 16 de agosto de 1907 en Escocia'. Mentions a permit for image/video capture.")
add_source("open-meteo-archive", "Open-Meteo", "archive-api.open-meteo.com", "Historical Weather API (2016–2025 daily)",
           "https://archive-api.open-meteo.com/v1/archive", "open-weather-api", verification="open-data",
           notes="CC BY 4.0. Modelled reanalysis; supporting data only.")
for slug, title, region, dest in [("el-balandran-uaslp", "El Balandrán UASLP", "zona-media", "M08"),
                                  ("la-taza", "La Taza", "zona-media", "M05"),
                                  ("manantial-ojito-de-agua", "Manantial Ojito de Agua", "zona-media", "M04"),
                                  ("museo-arqueologico-la-mezclita", "Museo Arqueológico la Mezclita", "zona-media", "M06"),
                                  ("santuario-del-nino-de-la-salud", "Santuario del Niño de la Salud", "zona-media", "M07"),
                                  ("santa-maria-acapulco", "Santa María Acapulco", "zona-media", "M13"),
                                  ("ex-hacienda-gogorron", "Ex Hacienda Gogorrón", "centro", "C15"),
                                  ("hacienda-jesus-maria", "Hacienda Jesús María", "centro", "C15"),
                                  ("hacienda-de-carranco", "Hacienda de Carranco", "centro", "C15"),
                                  ("villa-de-pozos", "Villa de Pozos", "centro", None)]:
    add_source(f"turismo-slp-lugar-{slug}", SEC_SLP, "turismo.slp.gob.mx", title, f"https://turismo.slp.gob.mx/lugares/{slug}/",
               "official-destination-page", region=region, destination=dest,
               notes="State tourism destination page. Readable HTML; no photo credits.")
# Pass-1 pages now attached to their B/C destinations
for sid, dest in [("turismo-slp-lugar-barrio-magico-de-tlaxcala", "C09"), ("turismo-slp-lugar-tierra-nueva", "C13"),
                  ("turismo-slp-lugar-teatro-de-la-paz-slp", "C05"), ("turismo-slp-lugar-centro-de-las-artes-de-san-luis-potosi", "C07")]:
    SOURCES[sid]["destination"] = dest
write("source-registry/sources.json", {"generated": TODAY, "count": len(SOURCES), "sources": list(SOURCES.values())})
SOURCE_IDS = set(SOURCES)

res_doc = load("pdf-registry/resources.json")
RES = {r["resource_id"]: r for r in res_doc["resources"]}
for rid, title, inst, url, ft, note in [
    ("ped-slp-2021-2027", "Plan Estatal de Desarrollo 2021–2027", "Gobierno del Estado de San Luis Potosí",
     SOURCES["ped-slp-2021-2027"]["url"], "pdf", "Downloaded to research/raw/docs for analysis (9.5 MB); confirms 4 regions."),
    ("inegi-iter-2020-slp", "ITER 2020 San Luis Potosí (CSV)", "INEGI", SOURCES["inegi-iter-2020"]["url"], "zip/csv",
     "Downloaded to research/raw/inegi. Official locality coordinates."),
    ("inegi-denue-slp", "DENUE San Luis Potosí (CSV)", "INEGI", SOURCES["inegi-denue"]["url"], "zip/csv",
     "Downloaded to research/raw/inegi. Establishment coordinates."),
    ("inegi-cem3-r90-slp", "CEM 3.0 San Luis Potosí 90 m (BIL)", "INEGI", SOURCES["inegi-cem-3-r90"]["url"], "zip/raster",
     "Downloaded to research/raw/inegi (10.6 MB). Source of elevation-profile.json.")]:
    RES[rid] = {"resource_id": rid, "title": title, "institution": inst, "region": None, "url": url, "file_type": ft,
                "language": "es", "publication_date": None, "downloadable": True, "downloaded": True,
                "local_path": None, "sha256": None, "redistribution_status": "official public data/document",
                "usage_status": "analysis input; not republished", "source_id": None, "notes": note}
write("pdf-registry/resources.json", {**res_doc, "generated": TODAY, "count": len(RES),
                                      "downloaded": sum(bool(r.get("downloaded")) for r in RES.values()),
                                      "resources": list(RES.values())})

def S(sid):
    assert sid in SOURCE_IDS, sid
    return sid

# ============================================================== brochure tables
B = {"altiplano": "brochure-altiplano", "centro": "brochure-centro", "huasteca": "brochure-huasteca", "zona-media": "brochure-media"}
facts = []
def F(brochure_region, page, field, value, confidence="high", status="verified", note=None, table=None):
    facts.append({"fact_id": f"bt-{len(facts) + 1:03d}", "brochure": B[brochure_region], "page": page,
                  "region": brochure_region, "field": field, "table": table, "value": value, "confidence": confidence,
                  "verification_status": status, **({"note": note} if note else {})})

def dist(region, origin, rows):
    for name, road, km, dirt, t in rows:
        F(region, 4, "distance", {"from": origin, "to": name, "highway": road, "distance_km": km,
                                  "unpaved_km": dirt, "time_approx": t},
          table=f"Distancias de {origin} a:",
          note="Approximate road distance and time as printed; not re-measured.")

dist("huasteca", "Ciudad Valles", [
    ("San Luis Potosí Capital", "57", 291, None, "3h 21m"), ("Rioverde", "70", 122, None, "1h 35m"),
    ("Matehuala", "75D", 348, None, "3h 41m"), ("Cascada de Micos", "70", 23, 1, "30m"),
    ("El Naranjo", "85", 101, None, "1h 36m"), ("Cascada de Minas Viejas", "70", 71, 1, "1h 37m"),
    ("El Meco", "85", 104, None, "1h 41m"), ("Tamasopo", "70D", 52, None, "50m"),
    ("Cascadas de Tamasopo", "70D", 55, None, "57m"), ("Puente de Dios, Tamasopo", "70D", 56, 0.5, "58m"),
    ("Aquismón", "85", 50, None, "58m"), ("Cascada de Tamul", "70", 41, None, "53m"),
    ("La Morena", "70", 46, None, "1h 02m"), ("Tanchachin", "70", 42, None, "53m"),
    ("Cuevas de Mantetzulel", "85", 57, 4, "1h 20m"), ("Sótano de las Golondrinas", "85", 51, None, "1h 06m"),
    ("Sótano de las Huahuas", "85", 62, None, "1h 15m"), ("Xilitla", "85", 87, None, "1h 45m"),
    ("Jardín Escultórico Edward James", "85", 85, 1, "1h 45m"), ("Axtla de Terrazas", "85", 81, None, "1h 30m"),
    ("Castillo de la Salud", "85", 82, None, "1h 35m"), ("Tamuín", "70", 30, None, "32m"),
    ("Tamtoc", "70D", 52, 10, "1h 10m"), ("Tamohi (El Consuelo)", "70D", 41, 1, "35m"),
    ("Tancanhuitz", "85", 55, None, "1h 02m"), ("Centro Ceremonial Tamaletom", "85", 57, None, "1h 09m"),
    ("Nacimiento del Río Huichihuayán", "85", 68, None, "1h 22m"), ("Huehuetlán", "85", 63, None, "1h 23m"),
    ("Huichihuayán", "85", 65, None, "1h 13m")])
dist("altiplano", "Matehuala", [
    ("San Luis Potosí Capital", "57", 194, None, "2h"), ("Rioverde", "57", 233, None, "2h 16m"),
    ("Ciudad Valles", "57", 379, None, "3h 43m"), ("Catorce", "62", 60.7, 25, "1h 15m"),
    ("Estación Catorce", "62", 76.4, None, "1h 10m"), ("Charcas", "63", 90, None, "1h 15m"),
    ("Venado", "63", 112, None, "1h 34m"), ("Guadalcázar", "57", 132, None, "1h 26m"),
    ("El Realejo", "57", 135, None, "1h 31m"), ("Salinas", "57", 359, None, "3h"),
    ("Moctezuma", "63", 225, None, "1h 48m"), ("Cedral", "57", 15, None, "27m")])
dist("centro", "Capital (San Luis Potosí)", [
    ("Matehuala", "57", 194, None, "2h 20m"), ("Rioverde (libre)", "70", 139, None, "2h 20m"),
    ("Rioverde (cuota)", None, 175, None, "1h 58m"), ("Ciudad Valles", "75D", 290, None, "3h 27m"),
    ("Santa María del Río", "57", 55.6, None, "46m"), ("Cerro de San Pedro", "57", 24.8, None, "41m"),
    ("Armadillo de los Infante", "57", 51.8, None, "1h 5m"), ("Mexquitic", "49", 23, None, "30m"),
    ("Villa de Reyes", "57", 50.7, None, "46m"), ("Villa de Zaragoza", "70", 34.7, None, "41m"),
    ("Soledad de Graciano Sánchez", "57", 8.5, None, "16m"), ("Ahualulco", "49", 38, None, "30m"),
    ("Tierra Nueva", "57", 80, None, "1h 8m"), ("Villa de Arriaga", "80", 59.3, None, "43m"),
    ("San Nicolás Tolentino", "57", 70.5, None, "1h 8m"), ("Santo Domingo", "57", 131.9, None, "2h 47m")])
dist("zona-media", "Rioverde", [
    ("San Luis Potosí (cuota)", "57", 168, None, "1h 58m"), ("San Luis Potosí (libre)", "70", 139, None, "2h 20m"),
    ("Ciudad Valles (cuota)", None, 124, None, "1h 38m"), ("Ciudad Valles", "70", 136, None, "2h 6m"),
    ("Matehuala", "75D", 227, None, "2h 24m"), ("Cd. Fernández", "75D", 3.6, None, "8m"),
    ("Manantial Media Luna", "70", 14, None, "28m"), ("Progreso", "70", 44.5, None, "42m"),
    ("Pastora", "75D", 27, None, "31m"), ("Cd. del Maíz", "75D", 113, None, "1h 46m"),
    ("Cerritos", "70", 72, None, "54m"), ("Rayón", "75D", 41, None, "39m"), ("Lagunillas", "69", 79, None, "1h 29m"),
    ("Villa Juárez", "75D", 58, None, "42m"), ("San Nicolás Tolentino", "75D", 117, None, "2h 19m"),
    ("Manantial San Sebastián", "69", 40, None, "50m"), ("Grutas de la Catedral", "70", 30, None, "56m"),
    ("Cañón Pinihuán", "70", 62, None, "58m")])

def attractions(region, rows):
    for mun, items, pm in rows:
        F(region, 3, "attractions", {"municipality": mun, "pueblo_magico_icon": pm, "attractions": items},
          table="Actividades turísticas", note="Attraction names transcribed; activity icons not transcribed (see report).")

attractions("huasteca", [
    ("Ciudad Valles", ["Río Valles", "Cascadas de Pago Pago (Micos)"], False),
    ("Aquismón", ["Cabecera Municipal", "Cascada de Tamul", "Río Tampaón", "Sótano de las Golondrinas", "Hoya de las Huahuas",
                  "Cuevas de Mantetzulel", "Puente de Dios"], True),
    ("Xilitla", ["Cabecera Municipal", "Museo Leonora Carrington", "Museo Edward James", "Jardín Escultórico Edward James, Las Pozas",
                 "Cascada Los Comales", "Bosque de la Trinidad"], True),
    ("Tamasopo", ["Cabecera Municipal", "Cascadas de Tamasopo", "Puente de Dios", "El Trampolín", "Cascada El Aguacate"], False),
    ("El Naranjo", ["Cascada El Meco", "Cascadas de Minas Viejas", "Cascada El Salto"], False),
    ("Axtla de Terrazas", ["Cabecera Municipal", "Río Axtla", "Castillo de la Salud"], False),
    ("Tamuín", ["Sitios Arqueológicos de Tamtoc y Tamohi", "Nacimiento de Tamuín"], False),
    ("Tancanhuitz", ["Centro Ceremonial Tamaletom"], False),
    ("Huehuetlán", ["Nacimiento de Huichihuayán", "El Vado"], False)])
attractions("altiplano", [
    ("Matehuala", ["Catedral", "Mercado", "Gastronomía Tradicional"], False),
    ("Real de Catorce", ["Real de Catorce", "Potrero", "La Luz", "Estación Catorce", "San Antonio", "San José Coronados"], True),
    ("Charcas", ["Cabecera Municipal"], False),
    ("Venado", ["Ex Hacienda Guanamé", "Centro Cultural Roberto Donis", "Parras del Altiplano"], False),
    ("Guadalcázar", ["Cabecera Municipal", "Museo de Arte Sacro", "El Realejo"], False),
    ("Salinas", ["Cabecera Municipal", "Centro Cultural", "La Salinera"], False),
    ("Villa de la Paz", ["Jaquis, Laureles", "Cabecera Municipal"], False),
    ("Cedral", ["Cabecera Municipal"], False), ("Moctezuma", ["Cabecera Municipal"], False),
    ("Villa de Guadalupe", ["Vivero La Ilusión"], False)])
attractions("centro", [
    ("San Luis Potosí", ["Centro Histórico", "Museo Leonora Carrington", "CEART", "Museo Laberinto de las Ciencias y las Artes",
                         "Parque Tangamanga", "Club de Golf", "Hacienda de Peñasco"], False),
    ("Santa María del Río", ["Cabecera", "Escuela del Rebozo", "Cascada del Amparito", "Ex Hacienda La Labor del Río"], True),
    ("Soledad de Graciano Sánchez", ["Joya Honda", "Pueblo"], False),
    ("Armadillo de los Infante", ["Pueblo", "Pozo del Carmen", "Hacienda de Corcovada", "Cráter Encantado"], False),
    ("Cerro de San Pedro", ["Pueblo", "Monte Caldera", "Sendero 'El Capitán'"], False),
    ("Villa de Reyes", ["Pueblo", "Centro Vacacional Gogorrón", "Hacienda Jesús María"], False),
    ("Mexquitic", ["Ruta del Mezcal", "Pueblo", "Ruta del Pulque"], False),
    ("Villa de Zaragoza", ["Sierra de Álvarez"], False),
    ("Ahualulco", ["Pueblo", "Fábrica de Mezcal Santa Teresa", "Fábrica de Mezcal Ipiña"], False)])
attractions("zona-media", [
    ("Rioverde", ["Cabecera Municipal", "Manantial de la Media Luna", "Grutas de la Catedral", "Los Peroles", "Progreso",
                  "Templo de la Divina Pastora", "San Bartolo", "La Malanca", "Lumbreras"], False),
    ("Rayón / Cárdenas", ["Sabinito", "Canoas", "Ex Hacienda Vaqueros", "Río Vaqueros", "Cascada los Chorros"], False),
    ("Ciudad del Maíz", ["Cabecera Municipal", "Colonia Italiana", "Murales de Jorge Pasquel", "Festividad de la quema de diablos"], True),
    ("Ciudad Fernández", ["Cabecera Municipal", "Ruta del Arroyo de órganos", "Ruta Agroturística", "El Sermón"], False),
    ("Cerritos", ["Cabecera Municipal"], False),
    ("Lagunillas", ["Cañón de Pinihuán", "Cascada de la Lloviznosa", "Presa las Coloradas"], False),
    ("Villa Juárez", ["Cabecera Municipal", "Hacienda de Guaxcamá", "Manantial San Tiburcio"], False),
    ("San Nicolás Tolentino", ["Cabecera Municipal", "Presa de las Golondrinas", "Hacienda los Moreno"], False)])

# seasons, gastronomy, recommendations, culture, practical
F("huasteca", 1, "season", {"place": "Cascada de Tamul", "months": [11, 12, 1, 2, 3], "text": "La mejor temporada para apreciarla es de noviembre a marzo."})
F("huasteca", 1, "season", {"place": "El Naranjo (Cascada El Salto, El Meco, Minas Viejas)", "months": [11, 12, 1, 2, 3],
                            "text": "Una buena temporada para visitar estos sitios es de noviembre a marzo."})
F("huasteca", 3, "season", {"place": "Cascada El Salto", "text": "*Cascada de temporada, lluvias y Semana Santa."},
  note="Footnote in the activities table. Implies El Salto flows seasonally; no months given.")
F("huasteca", 1, "physical", {"place": "Cascada de Tamul", "drop_m": 105})
F("huasteca", 1, "physical", {"place": "Cascada El Salto", "drop_m": 70})
F("huasteca", 1, "physical", {"place": "Cascada El Meco", "drop_m": 35})
F("huasteca", 1, "physical", {"place": "Cascadas de Pago Pago (Micos)", "falls": 7, "drop_m_range": [2, 20]})
F("huasteca", 2, "physical", {"place": "Jardín Escultórico de Edward James", "area_ha": 30, "structures": 36, "waterfall_m": 37})
F("huasteca", 2, "culture", {"place": "Tancanhuitz", "text": "Semana Santa y Día de Muertos o Xantolo; fiestas patronales en honor a San Miguel Arcángel en septiembre."})
F("huasteca", 2, "culture", {"place": "Tancanhuitz", "text": "Centro Ceremonial Maam ts'itsin inik: Danza del Gavilán de los Voladores de Tamaletom, "
                                                            "reconocidos dentro de la declaratoria de la UNESCO como Patrimonio Intangible de la Humanidad."},
  note="Brochure wording; the UNESCO inscription itself ('Ritual ceremony of the Voladores', 2009) was not checked this pass.",
  status="pending")
F("huasteca", 2, "culture", {"place": "Axtla de Terrazas", "text": "Castillo de la Salud de Beto Ramón en Ahuacatitla: curanderos náhuatl y plantas medicinales."})
F("huasteca", 2, "culture", {"place": "Tamuín", "text": "Tamtoc ('Lugar de las nubes de agua', en Tének): más de setenta edificaciones prehispánicas; "
                                                        "Tamohi (El Consuelo), donde se encontró el Adolescente Huasteco."})
F("huasteca", 1, "gastronomy", {"dishes": ["enchiladas huastecas", "bocoles", "zacahuil", "huevos enhojados", "nieves artesanales", "café", "pan artesanal"]})
F("huasteca", 2, "gastronomy", {"place": "Axtla de Terrazas", "dishes": ["cecina", "bocoles", "dulce de pipián y de chayote", "pacholes",
                                                                         "zacahuil", "enchiladas", "vino de capulín, jobo y ciruela", "atole de piña"]})
F("altiplano", 2, "gastronomy", {"dishes": ["enchiladas huastecas", "bocoles", "zacahuil", "huevos enhojados", "nieves artesanales", "café", "pan artesanal"]},
  status="conflict", note="The Altiplano brochure repeats the Huasteca gastronomy box verbatim (layout reuse). Not Altiplano gastronomy.")
F("altiplano", 1, "gastronomy", {"place": "Matehuala", "dishes": ["chorizo", "cabrito", "dulces de leche quemada", "obleas", "cajeta"]})
F("altiplano", 2, "gastronomy", {"place": "Charcas", "dishes": ["quesos estilo gourmet", "escamoles", "gorditas ferrocarrileras"]})
F("centro", 2, "gastronomy", {"dishes": ["enchiladas potosinas", "chiles ventilla", "tacos rojos", "campechanas", "queso de tuna", "vinos"]})
F("centro", 1, "gastronomy", {"place": "San Luis Potosí", "dishes": ["enchiladas potosinas", "gorditas rellenas", "asado de boda", "tacos rojos",
                                                                   "colonche", "aguamiel", "queso de tuna", "chocolates Costanzo y La Frontera"]})
F("zona-media", 2, "gastronomy", {"dishes": ["enchiladas rioverdenses", "guiso borracho", "chancaquillas", "pulque"]})
F("zona-media", 1, "gastronomy", {"place": "Ciudad Fernández", "dishes": ["birria", "barbacoa de borrego", "nopales", "tamales", "choriza",
                                                                         "carnitas", "dulces de piloncillo, calabaza y biznaga"]})
F("altiplano", 2, "climate", {"text": "El clima del Altiplano es extremo: días muy soleados, calurosos y secos en el verano. Y frío extremo en el invierno."})
for reg in B:
    F(reg, 1, "recommendation", {"text": "Consulta la oferta hotelera y reserva con tiempo. Se recomienda contratar los servicios de un guía certificado y reservar tours con anticipación."})
    F(reg, 2, "recommendation", {"text": "Los sitios turísticos y parajes tienen una capacidad de carga limitada. Consulta el estatus en visitasanluispotosi.com."})
F("huasteca", 1, "recommendation", {"text": "Usar siempre chaleco salvavidas (rentables en los parajes), no rebasar áreas restringidas, no perder de vista a los niños."})
F("huasteca", 1, "packing", {"items": ["repelente para mosquitos y bloqueador solar", "zapato cómodo", "gorra y/o pañuelo", "lentes de sol", "cámara fotográfica (pide permiso)"]})
F("huasteca", 4, "practical", {"text": "SEDE Secretaría de Turismo: Manuel J. Othón 516, Ciudad Valles, tel. 481 385 1490; SUBSEDE: Manuel J. Othón 130, S.L.P., tel. 444 812 9939."})
F("zona-media", 4, "map_note", {"text": "The Media map also draws El Naranjo and Tamasopo with their sites (red markers) as neighbouring context."},
  note="See municipality-region-map.json (border case).")

brochure_doc = {
    "generated": TODAY,
    "method": "Pages rendered at 300–400 % with Edge's built-in PDF viewer (render-pdf.mjs) and read visually. "
              "The brochures are vector/outlined text (no text layer).",
    "not_transcribed": ["Activity icons in the 'Actividades turísticas' tables (legend matching is error-prone; activities are "
                        "taken from the brochure prose instead).", "Map labels other than those cited."],
    "inconsistencies": [
        "Capital → Ciudad Valles: 290 km / 3h 27m (Centro) vs Ciudad Valles → Capital 291 km / 3h 21m (Huasteca).",
        "Matehuala ↔ Rioverde: 233 km / 2h 16m (Altiplano) vs 227 km / 2h 24m (Media).",
        "Matehuala ↔ Capital: 2h (Altiplano) vs 2h 20m (Centro), both 194 km.",
        "Matehuala → Salinas printed as 359 km / 3h; implausibly long for the stated time. Kept as printed, flagged.",
        "Altiplano brochure repeats the Huasteca gastronomy box."],
    "counts": {"facts": len(facts), "distance_rows": sum(f["field"] == "distance" for f in facts),
               "attraction_rows": sum(f["field"] == "attractions" for f in facts)},
    "facts": facts}
write("generated/brochure-tables.json", brochure_doc)

# ============================================================== events
EV = []
def E(eid, name, dest, mun, region, month, date2026, src, status, recurring, category, notes=None):
    EV.append({"event_id": eid, "event_name": name, "destination": dest, "municipality": mun, "region": region,
               "typical_month": month, "2026_date_if_confirmed": date2026, "source_id": S(src),
               "source_url": SOURCES[src]["url"], "verification_status": status, "recurring": recurring,
               "category": category, "notes": notes})

E("ev-procesion-silencio", "Procesión del Silencio", "C03", "San Luis Potosí", "centro", "Semana Santa (Viernes Santo; marzo/abril)",
  "2026-04-03 20:00", "cultura-slp-procesion-2026", "verified", "annual (movable: Viernes Santo)", "religiosa / cultural",
  "Starts and ends at Plaza del Carmen (turismo-slp-lugar-plaza-del-carmen). 2026 edition already held.")
E("ev-fenapo", "Feria Nacional Potosina (FENAPO)", "C01", "San Luis Potosí", "centro", "agosto", "2026-08-07/2026-08-30",
  "fenapo-2026", "verified", "annual", "feria", "2026 edition already held.")
E("ev-lila-lopez", "Festival Internacional de Danza Contemporánea 'Lila López'", "C01", "San Luis Potosí (y 5 municipios más)",
  "centro", "julio–agosto", "2026-07-24/2026-08-02", "cultura-gob-lila-lopez-2026", "verified", "annual", "festival cultural",
  "46th edition. Venues also in Matehuala, Santa María del Río, Soledad, Villa de Pozos, Villa de Reyes.")
E("ev-xantolo", "Xantolo (Día de Muertos en la Huasteca)", "H18", "Huasteca (varios)", "huasteca", "finales de octubre – 2 de noviembre",
  None, "slp-gob-xantolo-2025", "verified", "annual", "tradición / patrimonio inmaterial",
  "Official 2025 period: 29 Oct – 2 Nov 2025. 2026 dates not officially confirmed yet; do not reuse 2025 dates.")
E("ev-san-francisco-catorce", "Veneración de San Francisco de Asís (peregrinos)", "A01", "Catorce", "altiplano", "octubre (4 de octubre)",
  None, "turismo-slp-lugar-real-de-catorce", "verified", "annual (fixed date)", "religiosa / peregrinación",
  "'muy venerada cada 4 de octubre por cientos de peregrinos'. 2026 programme not confirmed.")
E("ev-asuncion-tlaxcala", "Fiestas de la Virgen de la Asunción", "C09", "San Luis Potosí", "centro", "agosto", None,
  "turismo-slp-lugar-barrio-magico-de-tlaxcala", "verified", "annual", "fiesta patronal")
E("ev-san-miguel-tancanhuitz", "Fiestas patronales de San Miguel Arcángel", None, "Tancanhuitz", "huasteca", "septiembre", None,
  "brochure-huasteca", "verified", "annual", "fiesta patronal")
E("ev-semana-santa-tancanhuitz", "Semana Santa y Xantolo en Tancanhuitz", None, "Tancanhuitz", "huasteca", "marzo/abril; octubre/noviembre",
  None, "brochure-huasteca", "verified", "annual", "tradición")
E("ev-semana-santa-xiiui", "Semana Santa indígena xi'iui", "M09", "Ciudad del Maíz", "zona-media", "Semana Santa (marzo/abril)", None,
  "brochure-media", "verified", "annual (movable)", "tradición indígena",
  "Mediodía en el barrio de San José; por la tarde, escenificación de la crucifixión.")
E("ev-quema-diablos", "Festividad de la quema de diablos", "M09", "Ciudad del Maíz", "zona-media", None, None,
  "brochure-media", "pending", "annual?", "tradición", "Listed in the activities table; month not stated in any source read.")
E("ev-san-juan-cerritos", "Fiesta patronal de San Juan Bautista y feria regional", None, "Cerritos", "zona-media", "junio (24 de junio)",
  None, "brochure-media", "verified", "annual (fixed date)", "fiesta patronal / feria",
  "Charrería, juegos mecánicos, pabellón gastronómico, carreras de caballos, exposición ganadera.")
E("ev-san-nicolas-tolentino", "Fiesta patronal de San Nicolás Tolentino", None, "San Nicolás Tolentino", "zona-media",
  "diciembre (inicia el 10 de diciembre)", None, "brochure-media", "verified", "annual", "fiesta patronal",
  "Carreras de caballos, jaripeos, fuegos artificiales, danzas y bailes.")
E("ev-fiestas-tierra-nueva", "Jaripeos y bailes de septiembre", "C13", "Tierra Nueva", "centro", "septiembre", None,
  "turismo-slp-lugar-tierra-nueva", "verified", "annual", "fiesta",
  "The page also names the Santa Cruz festivity, without a date (not recorded as an event).")
E("ev-el-salto-temporada", "Temporada de caída de la Cascada El Salto", "H15", "El Naranjo", "huasteca", "temporada de lluvias y Semana Santa",
  None, "brochure-huasteca", "verified", "seasonal", "naturaleza",
  "Natural condition, not an event; listed so 'Qué hacer ahora' can surface it.")
write("generated/events.json", {"generated": TODAY,
                                "rule": "Only officially supported events. Exact 2026 dates only when an official 2026 source says so.",
                                "count": len(EV), "events": EV})

# ============================================================== seasonal calendar
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
SEASON = {12: "invierno", 1: "invierno", 2: "invierno", 3: "primavera", 4: "primavera", 5: "primavera",
          6: "verano", 7: "verano", 8: "verano", 9: "otoño", 10: "otoño", 11: "otoño"}
climate = load("generated/climate-monthly.json")["points"]
REC = []
def R(rid, dest, region, months, activities, src, water=None, rain=None, festivals=None, cultural=None, nature=None,
      photo=None, gastro=None, status="verified", notes=None):
    REC.append({"record_id": rid, "destination": dest, "region": region, "months": months,
                "seasons": sorted({SEASON[m] for m in months}, key=["primavera", "verano", "otoño", "invierno"].index) if months else [],
                "recommended_activities": activities, "water_conditions": water, "rain_dry_context": rain,
                "festivals": festivals, "cultural_periods": cultural, "nature_conditions": nature,
                "photography_opportunities": photo, "gastronomy_relevance": gastro,
                "source_id": S(src), "verification_status": status, "notes": notes})

R("se-tamul", "H01", "huasteca", [11, 12, 1, 2, 3], ["visita en panga", "kayak en el río Tampaón"], "brochure-huasteca",
  water="Brochure names Nov–Mar as the best season to appreciate the falls.",
  rain="Supporting data: Ciudad Valles point is wettest Jun–Oct (Open-Meteo 2016–2025).")
R("se-el-naranjo", "H13|H14|H15", "huasteca", [11, 12, 1, 2, 3], ["natación", "paddle", "kayak", "rapel", "campismo", "observación de fauna"],
  "brochure-huasteca", notes="'Una buena temporada para visitar estos sitios es de noviembre a marzo' (El Naranjo).")
R("se-el-salto", "H15", "huasteca", [], ["contemplar la caída cuando hay temporada"], "brochure-huasteca",
  water="Seasonal waterfall: flows in the rainy season and during Semana Santa (brochure footnote). No months given.",
  status="verified", notes="Months intentionally empty: the source names periods, not months.")
R("se-media-luna", "M01", "zona-media", list(range(1, 13)), ["natación", "buceo recreativo y deportivo", "campismo"], "brochure-media",
  water="Corrientes tranquilas; segura todo el año para natación y buceo.")
R("se-golondrinas", "H04|H05", "huasteca", list(range(1, 13)), ["observación de aves al amanecer y al caer la tarde", "senderismo", "espeleología"],
  "brochure-huasteca", nature="Loros y vencejos, sobre todo al amanecer y al caer la tarde (time of day, all year).",
  photo="Salida/entrada de aves al amanecer y atardecer.")
R("se-procesion", "C03", "centro", [3, 4], ["Procesión del Silencio (Viernes Santo)"], "cultura-slp-procesion-2026",
  festivals=["ev-procesion-silencio"], cultural="Semana Santa", photo="Procesión nocturna en el Centro Histórico.")
R("se-fenapo", "C01", "centro", [8], ["FENAPO"], "fenapo-2026", festivals=["ev-fenapo"])
R("se-lila-lopez", "C01", "centro", [7, 8], ["Festival de danza contemporánea"], "cultura-gob-lila-lopez-2026", festivals=["ev-lila-lopez"])
R("se-xantolo", "H18", "huasteca", [10, 11], ["altares", "comparsas", "danzas tének y nahuas"], "slp-gob-xantolo-2025",
  festivals=["ev-xantolo"], cultural="Xantolo / Día de Muertos", gastro="Zacahuil and Huasteca dishes (brochure-huasteca) — season link not stated by source.",
  notes="2026 dates not yet official.")
R("se-catorce-oct", "A01", "altiplano", [10], ["peregrinación de San Francisco (4 de octubre)"], "turismo-slp-lugar-real-de-catorce",
  festivals=["ev-san-francisco-catorce"], cultural="Peregrinación")
R("se-altiplano-clima", "A01|A06|A15", "altiplano", [6, 7, 8, 12, 1, 2], [], "brochure-altiplano",
  rain="Verano muy soleado, caluroso y seco; invierno de frío extremo (brochure). Supporting data: Real de Catorce point "
       "averages 3.6 °C minimum in January (Open-Meteo).", notes="Climate caution, not a recommendation.")
R("se-tlaxcala", "C09", "centro", [8], ["Fiestas de la Virgen de la Asunción"], "turismo-slp-lugar-barrio-magico-de-tlaxcala",
  festivals=["ev-asuncion-tlaxcala"])
R("se-tancanhuitz", "Tancanhuitz", "huasteca", [9], ["fiestas de San Miguel Arcángel"], "brochure-huasteca", festivals=["ev-san-miguel-tancanhuitz"])
R("se-xiiui", "M09", "zona-media", [3, 4], ["Semana Santa indígena xi'iui"], "brochure-media", festivals=["ev-semana-santa-xiiui"],
  cultural="Semana Santa")
R("se-cerritos", "Cerritos", "zona-media", [6], ["fiesta de San Juan Bautista y feria regional"], "brochure-media", festivals=["ev-san-juan-cerritos"])
R("se-tolentino", "San Nicolás Tolentino", "zona-media", [12], ["fiesta patronal"], "brochure-media", festivals=["ev-san-nicolas-tolentino"])
R("se-tierra-nueva", "C13", "centro", [9], ["jaripeos y bailes"], "turismo-slp-lugar-tierra-nueva", festivals=["ev-fiestas-tierra-nueva"])
R("se-la-taza", "M05", "zona-media", [], ["nacimiento de agua cristalina"], "turismo-slp-lugar-la-taza",
  water="Visited by locals 'en temporada de calor' (no months given).",
  notes="Official page says it is visited mostly by local people: low-key promotion recommended.")

by_month = []
for m in range(1, 13):
    recs = [r["record_id"] for r in REC if m in r["months"]]
    by_month.append({"month": m, "name_es": MONTHS[m - 1], "season": SEASON[m], "records": recs,
                     "events": sorted({e for r in REC if m in r["months"] for e in (r["festivals"] or [])}),
                     "climate": {p: next(x for x in climate[p]["months"] if x["month"] == m) for p in
                                 ("altiplano", "centro", "zona-media", "huasteca")}})
write("generated/seasonal-calendar.json", {
    "generated": TODAY,
    "seasons_definition": "Meteorological seasons (Dec–Feb invierno, Mar–May primavera, Jun–Aug verano, Sep–Nov otoño).",
    "rule": "Recommendations come only from official sources. Open-Meteo climate is attached per month as quantitative "
            "context (label: modelled 2016–2025 average), never as a recommendation on its own.",
    "climate_source": "generated/climate-monthly.json", "records": REC, "by_month": by_month})

# ============================================================== weather model update
wm = load("generated/weather-model.json")
coords = load("generated/coordinates.json")["places"]
pts = {}
for region, pid, why in [("altiplano", "A06", "Largest city and gateway of the Altiplano (brochure); hub of the Altiplano distance table."),
                         ("centro", "C01", "State capital; hub of the Centro distance table."),
                         ("zona-media", "M02", "'La capital de la Región Media' (brochure); hub of the Media distance table."),
                         ("huasteca", "H17", "'La Puerta Grande de la Huasteca' (brochure); hub of the Huasteca distance table.")]:
    c = coords[pid]
    pts[region] = {"location_name": c["name"], "place_id": pid, "latitude": c["latitude"], "longitude": c["longitude"],
                   "region": region, "reason_selected": why, "coordinate_source": c["coordinate_source"],
                   "verification_status": c["verification_status"], "crosscheck_distance_m": c.get("crosscheck_distance_m")}
extra = {"real-de-catorce": ("A01", "High-altitude destination (~2,700 m) whose climate differs strongly from Matehuala."),
         "xilitla": ("H07", "Wettest Huasteca mountain town; fog/coffee climate differs from Ciudad Valles.")}
for k, (pid, why) in extra.items():
    c = coords[pid]
    pts[k] = {"location_name": c["name"], "place_id": pid, "latitude": c["latitude"], "longitude": c["longitude"],
              "region": "altiplano" if pid.startswith("A") else "huasteca", "reason_selected": why,
              "coordinate_source": c["coordinate_source"], "verification_status": c["verification_status"]}
wm.update({"generated": TODAY, "status": "design (not implemented); points verified",
           "points": {"rule": "Region widgets use the four verified INEGI locality points; destination widgets only for verified coordinates.",
                      "locations": pts}})
wm["current"]["params"]["daily"] = "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code"
wm["current"]["params"]["forecast_days"] = 3
wm["current"]["fields"].update({"daily.temperature_2m_max": "°C", "daily.temperature_2m_min": "°C",
                                "daily.precipitation_probability_max": "%", "daily.weather_code": "WMO code"})
wm["climate"]["output"] = "generated/climate-monthly.json (built, 6 points)"
write("generated/weather-model.json", wm)

# ============================================================== destinations (all 63)
places = {p["place_id"]: p for p in load("generated/workbook-places.json")["places"]}
regions_map = {r["municipality"]: r for r in load("generated/municipality-region-map.json")["municipalities"]}
media = load("media-registry/media-candidates.json")["records"]
_rev = ROOT / "media-registry" / "media-reviewed.json"
REVIEWED = json.loads(_rev.read_text(encoding="utf-8"))["assets"] if _rev.exists() else []
_dm = ROOT / "media-registry" / "destination-asset-manifest.json"
DEST_MEDIA = json.loads(_dm.read_text(encoding="utf-8"))["destinations"] if _dm.exists() else {}

def V(value, source, note=None):
    return {"value": value, "status": "verified", "source": S(source), "verifiedAt": TODAY, **({"note": note} if note else {})}
def P(value=None, source=None, note=None):
    return {"value": value, "status": "pending", **({"source": S(source)} if source else {}), **({"note": note} if note else {})}
def U(note):
    return {"value": None, "status": "unavailable", "note": note}

PM = lambda: V(True, "sectur-com-244-2023")
# Pass-2 additions for Priority B/C (Priority A keep their pass-1 curation, updated below).
BC = {
    "A04": dict(desc=V("Cerro de la sierra de Catorce que se recorre a caballo desde Real de Catorce, junto con sus minas abandonadas.", "brochure-altiplano"),
                mun="Catorce", cat="natural", tags=["naturaleza", "mineria", "cabalgata", "sitio-sagrado"],
                extra={"protected_area_context": P("Wirikuta y la Ruta Histórico Cultural del Pueblo Wixárika (Sitio Sagrado Natural, 2008)",
                                                   "segam-anp", "Inclusion of Cerro del Quemado in Wirikuta not confirmed in a source read.")},
                ethics="Sacred site of the Wixárika people: respectful framing, no staged ritual imagery."),
    "A05": dict(desc=P(None, "brochure-altiplano", "Listed in the Altiplano attractions table and distance table (76.4 km from Matehuala), no descriptive text."),
                mun="Catorce", cat="cultural", tags=["ferrocarril", "desierto", "paisaje"]),
    "A07": dict(desc=V("Catedral de Matehuala, joya arquitectónica que es una réplica de la iglesia de San José de Lyon, Francia.", "brochure-altiplano"),
                mun="Matehuala", cat="cultural", tags=["arquitectura", "patrimonio", "fe"]),
    "A08": dict(desc=V("Pueblo que creció por su riqueza minera, en la transición entre el árido Altiplano y la Región Media: Casa de Moneda, "
                       "Templo de la Purísima Concepción y la parroquia de San Pedro Apóstol con su retablo barroco y Museo de Arte Sacro.", "brochure-altiplano"),
                mun="Guadalcázar", cat="cultural", tags=["patrimonio", "mineria", "arquitectura"],
                extra={"protected_area_context": V("Real de Guadalcázar – Reserva Estatal (27 Sep 1997)", "segam-anp",
                                                   "Reserve exists; its exact relation to the town not stated.")}),
    "A09": dict(desc=V("Gruta poco profunda pero muy atractiva y enigmática, ideal para una sesión fotográfica.", "brochure-altiplano"),
                mun="Guadalcázar", cat="natural", tags=["cuevas", "naturaleza", "fotografia"]),
    "A10": dict(desc=V("En la comunidad de El Realejo, a los pies del Cerro de las Comadres, paisajes de pino-encino y formaciones rocosas "
                       "aptas para bicicleta de montaña, senderismo, cabalgata y escalada deportiva.", "brochure-altiplano"),
                mun="Guadalcázar", cat="natural", tags=["escalada", "aventura", "senderismo", "ciclismo"]),
    "A11": dict(desc=V("Pueblo minero que conserva su traza original; destacan la Alhóndiga, la parroquia de San Francisco de Asís, la Ermita "
                       "de Cristo Rey (Cruz del Siglo), el centro cultural El Refugio y el Museo Interactivo El Meteorito.", "brochure-altiplano"),
                mun="Charcas", cat="cultural", tags=["patrimonio", "mineria", "gastronomia"]),
    "A13": dict(desc=V("La ciudad más importante del Altiplano oeste, conocida por sus quesos; su Centro Cultural ocupa un edificio decimonónico "
                       "de imagen afrancesada, cerca de las salinas y las ruinas de las antiguas fábricas de sal.", "brochure-altiplano"),
                mun="Salinas", cat="cultural", tags=["patrimonio", "paisaje", "gastronomia"]),
    "A14": dict(desc=V("'El Oasis del Altiplano': población frondosa gracias al ojo de agua que irriga sus alrededores; Centro Cultural Roberto "
                       "Donis, parroquia de San Sebastián, acueducto de piedra y la ex hacienda de Guanamé.", "brochure-altiplano"),
                mun="Venado", cat="cultural", tags=["patrimonio", "haciendas", "artesania"]),
    "C04": dict(desc=P(None, "brochure-capital", "Labelled on the official Centro Histórico map; no descriptive official text found."),
                mun="San Luis Potosí", cat="cultural", tags=["arquitectura", "barroco", "fe"]),
    "C05": dict(desc=V("Recinto con la sala principal del Teatro de la Paz, la Galería Germán Gedovius y la sala Flavio F. Carlos.",
                       "turismo-slp-lugar-teatro-de-la-paz-slp"), mun="San Luis Potosí", cat="cultural", tags=["arquitectura", "artes-escenicas"]),
    "C06": dict(desc=P(None, "brochure-capital", "Caja del Agua and Calzada de Guadalupe labelled on the official map; no descriptive text."),
                mun="San Luis Potosí", cat="cultural", tags=["patrimonio", "paseo"]),
    "C07": dict(desc=V("Institución dedicada a la educación, producción y divulgación de las artes; en su interior está el Museo Leonora Carrington.",
                       "turismo-slp-lugar-centro-de-las-artes-de-san-luis-potosi"), mun="San Luis Potosí", cat="cultural",
                tags=["arte", "patrimonio", "museos"]),
    "C09": dict(desc=V("Barrio Mágico fundado en 1592 por familias tlaxcaltecas, con la Parroquia de Nuestra Señora de la Asunción y el mercado "
                       "República; en agosto celebra a la Virgen de la Asunción.", "turismo-slp-lugar-barrio-magico-de-tlaxcala"),
                mun="San Luis Potosí", cat="cultural", tags=["cultura-viva", "patrimonio", "gastronomia"]),
    "C13": dict(desc=V("Pueblo Mágico de raíces otomíes conocido por sus sombreros de palma, la laja roja 'sangre de pichón', el Cerro de León "
                       "y la presa La Muñeca.", "turismo-slp-lugar-tierra-nueva"), mun="Tierra Nueva", pm=True, cat="cultural",
                tags=["pueblos-magicos", "artesania", "senderismo"]),
    "C14": dict(desc=P(None, None, "No tourism description in the sources read."), mun="San Luis Potosí", cat="natural",
                tags=["naturaleza", "senderismo"], extra={"protected_area": V("Área natural protegida (decreto 20 Sep 2018)", "segam-anp")}),
    "C15": dict(desc=V("Haciendas del Valle de San Francisco: Gogorrón (legado industrial textil e hidroeléctrico, primer ejido del país en 1915), "
                       "Jesús María (casa-museo de Concepción Cabrera de Armida) y Carranco.", "turismo-slp-lugar-ex-hacienda-gogorron",
                       "Also turismo-slp-lugar-hacienda-jesus-maria and turismo-slp-lugar-hacienda-de-carranco."),
                mun="Villa de Reyes", cat="cultural", tags=["haciendas", "patrimonio", "aguas-termales"],
                extra={"protected_area_context": P("Gogorrón (federal ANP listed by SEGAM)", "segam-anp", "Relation to the hacienda not stated.")}),
    "M04": dict(desc=V("Manantial donde se fundó la misión de Santa Catarina Mártir del Rioverde (1617) y referencia de la fundación de Ciudad Fernández.",
                       "turismo-slp-lugar-manantial-ojito-de-agua"), mun="Ciudad Fernández", cat="mixed", tags=["agua", "historia"]),
    "M05": dict(desc=V("Nacimiento de agua cristalina entre el ejido La Reformita y Ojo de Agua de Solano, visitado sobre todo por la población "
                       "local en temporada de calor.", "turismo-slp-lugar-la-taza"), mun="Ciudad Fernández", cat="natural",
                tags=["agua", "naturaleza"], ethics="Official page frames it as a locally kept site: promote gently, if at all."),
    "M06": dict(desc=V("Museo con cerca de mil piezas prehispánicas de la antigua zona pame, a unos 20 minutos de la plaza de Ciudad Fernández.",
                       "turismo-slp-lugar-museo-arqueologico-la-mezclita"), mun="Ciudad Fernández", cat="cultural", tags=["arqueologia", "museos"]),
    "M07": dict(desc=V("Uno de los puntos de turismo religioso más importantes del estado, en Atotonilco.", "turismo-slp-lugar-santuario-del-nino-de-la-salud"),
                mun="Ciudad Fernández", cat="cultural", tags=["fe", "peregrinacion"]),
    "M08": dict(desc=V("Inmueble porfiriano de arquitectura neoclásica francesa construido entre 1906 y 1921 como estación agrícola experimental; "
                       "hoy centro de investigación de la UASLP.", "turismo-slp-lugar-el-balandran-uaslp"),
                mun="Ciudad Fernández", cat="cultural", tags=["arquitectura", "patrimonio"]),
    "M10": dict(desc=V("Casa Barraganeña, sede actual del gobierno municipal de Ciudad del Maíz.", "turismo-slp-lugar-ciudad-del-maiz"),
                mun="Ciudad del Maíz", cat="cultural", tags=["patrimonio", "arquitectura"]),
    "M11": dict(desc=V("Parroquia neoclásica del siglo XVIII en el centro de Ciudad del Maíz.", "turismo-slp-lugar-ciudad-del-maiz"),
                mun="Ciudad del Maíz", cat="cultural", tags=["arquitectura", "fe"]),
    "M12": dict(desc=V("En la comunidad de El Tepeyac, dos murales diseñados por Diego Rivera y elaborados por sus discípulos: 'Ritual de una "
                       "alegoría' y 'Transformación del Tepeyac'.", "turismo-slp-lugar-ciudad-del-maiz"),
                mun="Ciudad del Maíz", cat="cultural", tags=["arte", "muralismo"],
                conflicts=["Brochure-media table calls them 'Murales de Jorge Pasquel'; brochure text credits execution to Roseado Soto "
                           "Álvarez and Jorge Best Berganzo."]),
    "M13": dict(desc=V("Comunidad del municipio de Santa Catarina, corazón espiritual de la región media donde se entrelazan historia, fe y "
                       "tradición xi'iuy.", "turismo-slp-lugar-santa-maria-acapulco", "Page text only partially readable."),
                mun="Santa Catarina", cat="cultural", tags=["cultura-viva", "xi-iuy", "fe"],
                ethics="Indigenous community: portraits only with consent; follow community guidance."),
    "M14": dict(desc=V("En la comunidad de Alamitos, gruta con formaciones calcáreas semejantes a un púlpito, un altar y reclinatorios.",
                       "brochure-media"), mun="Rioverde", cat="natural", tags=["cuevas", "naturaleza"],
                conflicts=["Workbook municipality 'Región Media' corrected to Rioverde (brochure-media activities table)."]),
    "M15": dict(desc=P(None, "brochure-media", "Brochure mentions agro-tourism routes and fields around Ciudad Fernández; no text for the landscape itself."),
                mun="Rioverde", cat="natural", tags=["paisaje", "agroturismo"]),
    "H03": dict(desc=P(None, None, "Not described in any official source read."), mun="Aquismón", cat="natural", tags=["agua", "cuevas"]),
    "H05": dict(desc=V("Hoya de las Huahuas: sitio para espeleología, senderismo y observación de aves al amanecer y al caer la tarde.", "brochure-huasteca"),
                mun="Aquismón", cat="natural", tags=["naturaleza", "aves", "espeleologia"],
                extra={"official_name": V("Hoya de las Huahuas", "brochure-huasteca", "Workbook says 'Sótano de las Huahuas'; SEGAM also 'Hoya'."),
                       "protected_area": V("Área natural protegida estatal (decreto multisitio)", "segam-anp")}),
    "H09": dict(desc=V("Ex convento de San Agustín, del siglo XVI, en el centro de Xilitla.", "brochure-huasteca"),
                mun="Xilitla", cat="cultural", tags=["patrimonio", "arquitectura"]),
    "H15": dict(desc=V("Cascada de 70 metros que forma enormes pozas azules; es una cascada de temporada (lluvias y Semana Santa).", "brochure-huasteca"),
                mun="El Naranjo", cat="natural", tags=["agua", "cascadas"], extra={"height_m": V(70, "brochure-huasteca")}),
    "H17": dict(desc=V("'La Puerta Grande de la Huasteca': segundo municipio más importante del estado y punto de partida hacia el resto de la Huasteca.",
                       "turismo-slp-lugar-ciudad-valles"), mun="Ciudad Valles", cat="cultural", tags=["ciudad-base", "gastronomia"]),
    "H18": dict(desc=V("Semana Santa y Día de Muertos o Xantolo son de las temporadas más importantes de la Huasteca, con fiestas, máscaras, "
                       "altares tradicionales y comida.", "brochure-huasteca"), mun=None, cat="cultural",
                tags=["cultura-viva", "xantolo", "tradiciones"], ethics="Ceremonial events: photograph with permission; no staged scenes."),
}
SEASON_TAGS = {"H01": ["noviembre-marzo"], "H13": ["noviembre-marzo"], "H14": ["noviembre-marzo"], "H15": ["temporada-lluvias", "semana-santa"],
               "M01": ["todo-el-ano"], "H04": ["amanecer-atardecer"], "H05": ["amanecer-atardecer"], "C03": ["semana-santa"],
               "M09": ["semana-santa"], "A01": ["octubre"], "C09": ["agosto"], "C13": ["septiembre"], "H18": ["octubre-noviembre"],
               "C01": ["julio-agosto"]}
PROTECTED_A = {"M01": V("Parque Estatal Manantial de la Media Luna (decreto 7 Jun 2003)", "segam-anp"),
               "H04": V("Área natural protegida estatal (decreto multisitio con Hoya de las Huahuas)", "segam-anp",
                        "Category (Monumento Natural) reported by secondary sources, not read on SEGAM's page.")}

index = []
for pid, wb in places.items():
    path = ROOT / "destinations" / f"{pid}.json"
    rec = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    c = coords[pid]
    mun_name = (rec["municipality"]["value"] if rec else (BC.get(pid, {}).get("mun")))
    rm = regions_map.get(mun_name) if mun_name else None
    region = (V(rm["region"], "pdu-slp", f'{rm["microregion"]}; municipality {mun_name}') if rm and rm["region"]
              else P(wb["region"], None, "Region from workbook; no single municipality."))
    if rec is None:
        b = BC[pid]
        rec = {"place_id": pid, "name": wb["name"],
               "workbook": {"region_label": wb["region_label"], "type": wb["type"], "priority": wb["priority"],
                            "official_source": wb["official_source"]},
               # the municipality is stated by the same source as the description, or by the region's brochure
               "municipality": (V(b["mun"], b["desc"].get("source") or B[wb["region"]]) if b["mun"]
                                else U("Spans several municipalities.")),
               "type": wb["type"], "description": b["desc"],
               "pueblo_magico": PM() if b.get("pm") else {"value": False, "status": "not-applicable"},
               "category": {"value": b["cat"], "status": "editorial"}, "interest_tags": {"value": b["tags"], "status": "editorial"},
               "facts": b.get("extra", {}), "conflicts": b.get("conflicts", []), "ethics": b.get("ethics"),
               "official_resources": [], "access": []}
    else:
        rec.setdefault("facts", {})
        if pid in PROTECTED_A:
            rec["facts"]["protected_area"] = PROTECTED_A[pid]
        if pid == "A12":
            rec["conflicts"] = ["Resolved: the state portal (slp-gob-visita-altiplano) places 'la ruta del Mezcal en el municipio de "
                                "Charcas'. The brochures also tie mezcal routes to Villa de Guadalupe (Altiplano) and Mexquitic/Ahualulco (Centro); "
                                "both are true — several mezcal routes exist."]
            rec["facts"]["mezcal_route"] = V("Ruta del Mezcal en el municipio de Charcas", "slp-gob-visita-altiplano")
        if pid in ("H10", "H11", "H13", "H14"):
            rec["conflicts"] = [x for x in rec["conflicts"] if "Region assignment pending" not in x] + [
                "Resolved: region Huasteca (PDU-SLP Huasteca Norte + Huasteca brochure). The Media brochure map shows these sites as context."]
        if pid == "H11":
            rec["conflicts"] = [x for x in rec["conflicts"] if "possibly a second site" not in x] + [
                "Resolved: two places share the name. INEGI lists a locality 'Puente de Dios (Paso Alto)' in Aquismón; this record is the "
                "Tamasopo site described by the brochure."]
        if pid in ("A01", "A02"):
            rec["conflicts"] = [x for x in rec["conflicts"] if "Tunnel length" not in x] + [
                "Unresolved: tunnel length 2.3 km (turismo-slp-lugar-real-de-catorce) vs 2.5 km (brochure-altiplano). SECTUR's article "
                "gives no length. Use wording without a number until a primary source (e.g. INAH/municipal) is found."]
        if pid in ("H07", "H08"):
            rec["conflicts"] = [x for x in rec["conflicts"] if "Edward James" not in x] + [
                "Unresolved: Edward James described as 'escocés' (brochure-huasteca; laspozas-xilitla-org: 'nació en Escocia') and as "
                "'inglés' (turismo-slp-lugar-xilitla). Recommended wording: 'Edward James (1907–1984), poeta y mecenas del surrealismo'."]
    rec["conflicts"] = list(dict.fromkeys(rec.get("conflicts", [])))  # idempotent reruns
    rec["region"] = region
    rec["coordinates"] = {k: c.get(k) for k in ("latitude", "longitude", "precision", "coordinate_source", "source_url",
                                                "verification_status", "crosscheck_source", "crosscheck_distance_m", "notes")}
    rec["coordinate_source"] = c.get("coordinate_source")
    rec["map_status"] = c.get("map_status") or "not-a-point"
    rec["seasonal_tags"] = SEASON_TAGS.get(pid, [])
    rec["priority"] = wb["priority"]
    rv = [x for x in REVIEWED if x["place_id"] == pid]
    dm = DEST_MEDIA.get(pid)
    rec["media_status"] = (dm["status"].lower() if dm else "none") if REVIEWED else "not-reviewed"
    rec["media_selected"] = [x["asset_id"] for x in rv if x["status"] == "SELECTED"]
    rec["media_card"] = dm["slots"]["card"] if dm else None
    rec["official_source"] = [s for s, v in SOURCES.items() if v.get("destination") == pid and
                              v["source_type"] in ("official-destination-page", "official-article", "official-heritage-page")]
    core = [rec["region"], rec["municipality"], rec["description"], {"status": c.get("verification_status")}]
    vc = sum(x.get("status") == "verified" for x in core)
    rec["verified_core_fields"] = f"{vc}/4 (region, municipality, description, coordinates)"
    rec["verification_status"] = "verified" if vc == 4 else "pending"
    rec["researched_in_pass"] = 1 if wb["priority"] == "A" else 2
    write(f"destinations/{pid}.json", rec)
    index.append({"place_id": pid, "name": wb["name"], "region": rec["region"]["value"], "priority": wb["priority"],
                  "verification_status": rec["verification_status"], "verified_core_fields": rec["verified_core_fields"],
                  "description": rec["description"]["status"], "coordinates": c.get("verification_status"),
                  "map_status": rec["map_status"], "media_status": rec["media_status"], "official_page": bool(rec["official_source"]),
                  "conflicts": len(rec.get("conflicts", []))})

cnt = lambda k, v: sum(e[k] == v for e in index)
write("destinations/index.json", {
    "generated": TODAY, "statuses": ["pending", "verified", "unavailable"],
    "rule": "A destination is 'verified' only when region, municipality, description and coordinates are all verified.",
    "total": len(index), "researched": len(index), "verified": cnt("verification_status", "verified"),
    "descriptions_verified": cnt("description", "verified"),
    "coordinates": {"verified": cnt("coordinates", "verified"), "pending": cnt("coordinates", "pending"),
                    "unavailable": cnt("coordinates", "unavailable")},
    "map_status": {s: cnt("map_status", s) for s in ("ready", "provisional", "pending", "not-a-point")},
    "destinations": index})

# ============================================================== MapLibre
features, pending = [], []
for pid in places:
    rec = json.loads((ROOT / "destinations" / f"{pid}.json").read_text(encoding="utf-8"))
    c = coords[pid]
    props = {"place_id": pid, "name": rec["name"], "region": rec["region"]["value"],
             "municipality": rec["municipality"].get("value"), "category": rec["category"]["value"],
             "interest_tags": rec["interest_tags"]["value"], "priority": rec["priority"],
             "description_short": rec["description"]["value"] if rec["description"]["status"] == "verified" else None,
             "description_status": rec["description"]["status"], "verification_status": rec["verification_status"],
             "coordinate_status": c.get("verification_status"), "coordinate_precision": c.get("precision"),
             "map_status": rec["map_status"], "media_candidate_id": rec.get("media_card"),
             "official_source": rec["official_source"][0] if rec["official_source"] else (rec["description"].get("source"))}
    if c.get("latitude") is not None and rec["map_status"] in ("ready", "provisional"):
        features.append({"type": "Feature", "id": pid,
                         "geometry": {"type": "Point", "coordinates": [c["longitude"], c["latitude"]]}, "properties": props})
    else:
        pending.append({**props, "reason": c.get("notes") or "No coordinates.", "coordinate_status": c.get("verification_status")})
geo = {"type": "FeatureCollection",
       "metadata": {"generated": TODAY, "crs": "EPSG:4326 (WGS84; INEGI ITRF treated as WGS84)",
                    "map_status": {"ready": "official coordinates (INEGI/INAH)",
                                   "provisional": "OpenStreetMap feature that passed plausibility checks; not verified"},
                    "attribution": "INEGI (ITER 2020, DENUE), INAH; © OpenStreetMap contributors (ODbL) for provisional points",
                    "media_candidate_id": "best card asset from media-registry/destination-asset-manifest.json (null = needs manual asset)"},
       "features": features}
write("generated/maplibre-places.geojson", geo)
write("generated/maplibre-places.json", {"generated": TODAY, "count": len(features),
                                         "ready": sum(f["properties"]["map_status"] == "ready" for f in features),
                                         "provisional": sum(f["properties"]["map_status"] == "provisional" for f in features),
                                         "places": [{**f["properties"], "longitude": f["geometry"]["coordinates"][0],
                                                     "latitude": f["geometry"]["coordinates"][1]} for f in features]})
write("generated/maplibre-pending.json", {"generated": TODAY, "count": len(pending), "places": pending})

print("sources", len(SOURCES), "| brochure facts", len(facts), "| events", len(EV), "| seasonal", len(REC))
print("destinations verified", cnt("verification_status", "verified"), "| desc verified", cnt("description", "verified"),
      "| coords", {s: cnt("coordinates", s) for s in ("verified", "pending", "unavailable")})
print("map features", len(features), "(ready", sum(f["properties"]["map_status"] == "ready" for f in features), ") pending", len(pending))
