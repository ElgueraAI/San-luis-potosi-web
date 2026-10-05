"""Research pass 1: build the source, PDF, destination, media, guide and weather registries.

Inputs (all produced earlier in this pass):
  research/generated/workbook-places.json     master list (read-only export of the workbook)
  research/generated/geocode-candidates.json  OSM Nominatim candidates
  research/generated/commons-candidates.json  Wikimedia Commons metadata
  research/raw/pdfs/*.pdf                     the 5 official brochures (git-ignored, hashed here)

Every fact below was read in an official source during this pass and carries
that source's id. Anything not read in a source is `pending` or `unavailable`.
Nothing here is invented to fill a gap.

Run: python research/scripts/build-registry.py
"""
import hashlib, json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TODAY = "2026-10-04"
ARCHIVE_FOLLETERIA = "https://web.archive.org/web/20260606130105/https://visitasanluispotosi.com/folleteria-digital/"
ARCHIVE_MAPAS = "https://web.archive.org/web/20260417000147/https://visitasanluispotosi.com/mapas/"

def write(rel, data):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# --------------------------------------------------------------------------- sources
def S(source_id, institution, domain, title, url, source_type, region=None, destination=None,
      access="accessible", verification="official", notes=None):
    return {"source_id": source_id, "institution": institution, "domain": domain, "title": title, "url": url,
            "source_type": source_type, "region": region, "destination": destination,
            "retrieval_date": TODAY, "accessibility_status": access, "verification_status": verification,
            "notes": notes}

SEC_SLP = "Secretaría de Turismo del Estado de San Luis Potosí"
GOB_SLP = "Gobierno del Estado de San Luis Potosí"
SECTUR = "Secretaría de Turismo (SECTUR), Gobierno de México"
TURISMO = "turismo.slp.gob.mx"

def lugar(slug, title, region, destination, kind="official-destination-page"):
    return S(f"turismo-slp-lugar-{slug}", SEC_SLP, TURISMO, title, f"https://turismo.slp.gob.mx/lugares/{slug}/",
             kind, region, destination,
             notes="Destination page on the state tourism portal. Readable HTML; no photo credits; "
                   "map links are Google Maps text searches, not coordinates.")

def brochure(rid, title, region, drive_id):
    return S(rid, SEC_SLP, "drive.google.com", title, f"https://drive.google.com/file/d/{drive_id}/view",
             "official-brochure-pdf", region, None,
             notes="Linked from Folletería Digital (visitasanluispotosi.com). Live page blocks automated access; "
                   f"link list read from the Internet Archive copy {ARCHIVE_FOLLETERIA}. PDF downloaded for analysis "
                   "only (research/raw/pdfs, git-ignored). Back cover: Secretaría de Turismo, Gobierno del Estado 2021–2027.")

SOURCES = [
    # State government and state tourism
    S("slp-gob-portal", GOB_SLP, "slp.gob.mx", "Portal del Gobierno del Estado de San Luis Potosí", "https://slp.gob.mx/",
      "official-portal", notes="Readable. Lists ~65 /lugares/ destination pages. Site-wide © notice; no photo credits."),
    S("slp-gob-visita", GOB_SLP, "slp.gob.mx", "Visita San Luis Potosí", "https://slp.gob.mx/visitasanluispotosi/",
      "official-portal", notes="Regional landing pages (region-altiplano, region-centro, region-media, region-huasteca). "
                               "Used by the workbook as a generic source for 48 of 63 places; not destination-specific."),
    S("slp-gob-visita-huasteca", GOB_SLP, "slp.gob.mx", "Región Huasteca", "https://slp.gob.mx/visitasanluispotosi/region-huasteca/",
      "official-regional-page", "huasteca"),
    S("turismo-slp-portal", SEC_SLP, TURISMO, "Secretaría de Turismo – portal", "https://turismo.slp.gob.mx/",
      "official-portal", notes="Readable. Links administrative PDFs on turismoslp.com.mx/Descargas/."),
    S("turismo-slp-rnt", SEC_SLP, TURISMO, "Registro Nacional de Turismo (trámites)", "https://turismo.slp.gob.mx/rnt/",
      "official-procedure-page", notes="RNT registration procedures and forms for providers (updated 17/02/2026). "
                                       "No public list of registered guides or operators on this page."),
    S("turismoslp-com-mx", SEC_SLP, "turismoslp.com.mx", "turismoslp.com.mx (Descargas)", "https://www.turismoslp.com.mx/",
      "official-file-host", access="partially-blocked",
      notes="Home page returns a JavaScript bot check; files under /Descargas/ are served directly."),
    S("visitaslp-folleteria", SEC_SLP, "visitasanluispotosi.com", "Folletería Digital",
      "https://visitasanluispotosi.com/folleteria-digital/", "official-resource-index", access="blocked",
      notes=f"Live site blocks automated access (bot check, also in a headless browser). Read via Internet Archive "
            f"snapshot of 2026-06-06: {ARCHIVE_FOLLETERIA}"),
    S("visitaslp-mapas", SEC_SLP, "visitasanluispotosi.com", "Mapas", "https://visitasanluispotosi.com/mapas/",
      "official-resource-index", access="blocked",
      notes=f"Read via Internet Archive snapshot of 2026-04-17: {ARCHIVE_MAPAS}. Five map images (WebP)."),
    S("visitaslp-guias", SEC_SLP, "visitasanluispotosi.com", "Guías de Turistas", "https://visitasanluispotosi.com/guias-de-turistas/",
      "official-resource-index", access="blocked", verification="unverified",
      notes="Live page blocked; no Internet Archive snapshot exists. Content unknown."),
    brochure("brochure-altiplano", "Folleto Región Altiplano (F-Altiplano.pdf)", "altiplano", "1A5Gzx1uLDWJf_0VD3132T1wWZU_5PZin"),
    brochure("brochure-centro", "Folleto Región Centro (F-Centro.pdf)", "centro", "1vVjQaF3-PMsITAAKO4wB6NbO_XOdNUZM"),
    brochure("brochure-huasteca", "Folleto Región Huasteca (F-Huasteca.pdf)", "huasteca", "1L8-2QGML1dNoqn42oH_PDK0nRrRVltoP"),
    brochure("brochure-media", "Folleto Región Media (F-Media.pdf)", "zona-media", "1dd56kW2i2GjGX1ePx2HaTRUty9xPZJIb"),
    brochure("brochure-capital", "Mapa turístico Capital Potosina (F-Capital.pdf)", "centro", "1T_Ix-RxH68nRhtiLrAzsGjAKi43LZ2xg"),
    # Destination pages read in this pass
    lugar("real-de-catorce", "Real de Catorce", "altiplano", "A01"),
    lugar("plaza-del-carmen", "Plaza del Carmen", "centro", "C03"),
    lugar("centro-de-las-artes-de-san-luis-potosi", "Centro de las Artes de San Luis Potosí", "centro", "C08"),
    lugar("museo-leonora-carrinton-slp", "Museo Leonora Carrington S.L.P.", "centro", "C08"),
    lugar("santa-maria-del-rio", "Santa María del Río", "centro", "C11"),
    lugar("barrio-magico-de-tlaxcala", "Barrio Mágico de Tlaxcala", "centro", "C09"),
    lugar("tierra-nueva", "Tierra Nueva", "centro", "C13"),
    lugar("teatro-de-la-paz-slp", "Teatro de la Paz", "centro", "C05"),
    lugar("centro-historico-de-ciudad-fernandez", "Centro Histórico de Ciudad Fernández", "zona-media", "M03"),
    lugar("ciudad-del-maiz", "Ciudad del Maíz", "zona-media", "M09"),
    lugar("aquismon", "Aquismón", "huasteca", "H06"),
    lugar("xilitla", "Xilitla", "huasteca", "H07"),
    lugar("museo-leonora-carrington-xilitla", "Museo Leonora Carrington Xilitla", "huasteca", "H07"),
    lugar("ciudad-valles", "Ciudad Valles", "huasteca", None, "official-municipal-page"),
    lugar("el-naranjo", "El Naranjo", "huasteca", None, "official-municipal-page"),
    lugar("tamuinslp", "Tamuín", "huasteca", None, "official-municipal-page"),
    # Federal tourism
    S("sectur-com-244-2023", SECTUR, "gob.mx", "Comunicado 244/2023: La riqueza turística, artesanal y surrealista de San Luis Potosí llega a Punto México",
      "https://www.gob.mx/sectur/prensa/la-riqueza-turistica-artesanal-y-surrealista-de-san-luis-potosi-llega-a-punto-mexico?idiom=es-MX",
      "official-press-release", access="accessible-via-webfetch",
      notes="7 Nov 2023. Names the state's 6 Pueblos Mágicos: Real de Catorce, Xilitla, Aquismón, Santa María del Río, "
            "Ciudad del Maíz, Tierra Nueva. gob.mx serves a JS challenge to plain HTTP clients; WebFetch reads it."),
    S("sectur-art-real-de-catorce", SECTUR, "gob.mx", "Real de Catorce, San Luis Potosí",
      "https://www.gob.mx/sectur/articulos/real-de-catorce-san-luis-potosi", "official-article", "altiplano", "A01",
      access="accessible-via-webfetch", notes="18 Jul 2019. States incorporation into Pueblos Mágicos in 2001."),
    S("sectur-art-xilitla", SECTUR, "gob.mx", "Xilitla, San Luis Potosí", "https://www.gob.mx/sectur/articulos/xilitla-san-luis-potosi",
      "official-article", "huasteca", "H07", access="accessible-via-webfetch",
      notes="15 Aug 2019. 'Se incorporó al programa Pueblos Mágicos en el año 2011.'"),
    S("sectur-guias-acreditacion", SECTUR, "gob.mx", "Acreditación de Guías de Turistas",
      "https://www.gob.mx/sectur/acciones-y-programas/acreditacion-de-guias-de-turistas", "official-program-page",
      access="accessible-via-webfetch", notes="11 Sep 2023. Accreditation under NOM-08-TUR-2002 and NOM-09-TUR-2002."),
    S("sectur-guias-directorio", SECTUR, "guiadeturistas.sectur.gob.mx", "Directorio / consulta de Guías de Turistas",
      "https://guiadeturistas.sectur.gob.mx:444/dgtic-app-109/web/consulta/consultaguia.cfm", "official-registry",
      notes="Reachable, no captcha. Filters: estado (San Luis Potosí = 24), municipio, tipo de guía, idioma. "
            "Results are personal data; not queried or copied in this pass."),
    S("sectur-nom-08-tur-2002", SECTUR, "gob.mx", "NOM-08-TUR-2002 (guías generales y especializados en temas culturales)",
      "https://www.gob.mx/cms/uploads/attachment/file/19513/1_NOM-08-TUR-2002.pdf", "official-standard-pdf",
      access="not-fetched", notes="Found by search on gob.mx; not opened in this pass."),
    S("datatur", SECTUR, "datatur.sectur.gob.mx", "DataTur", "https://www.datatur.sectur.gob.mx/SitePages/inicio.aspx",
      "official-statistics", notes="Readable. Sections: Compendio Estadístico, Actividad Hotelera, Pueblos Mágicos study, "
                                   "PIB turístico estatal y municipal. File downloads and SLP coverage not yet confirmed."),
    # Geography, heritage, environment
    S("inegi-cem", "Instituto Nacional de Estadística y Geografía (INEGI)", "inegi.org.mx", "Continuo de Elevaciones Mexicano (CEM)",
      "https://www.inegi.org.mx/app/geo2/elevacionesmex/", "official-dataset",
      notes="Downloadable by state (San Luis Potosí) at 15–120 m. Not downloaded (not authorized yet). Terms not shown on the app page."),
    S("inah-lugares-tamtoc", "Instituto Nacional de Antropología e Historia (INAH)", "lugares.inah.gob.mx", "Tamtoc",
      "https://lugares.inah.gob.mx/es/node/4460", "official-heritage-page", "huasteca", "H16",
      notes="Point coordinate (schema.org geo) and site polygon, hours, admission, address, access. Photo credits shown "
            "(Mauricio Marat / INAH-Dirección de Medios de Comunicación). Repository content under CC BY-NC-ND 4.0 "
            "unless stated otherwise."),
    S("inah-mediateca-tamtoc", "Instituto Nacional de Antropología e Historia (INAH)", "mediateca.inah.gob.mx", "Tamtoc (guía)",
      "https://mediateca.inah.gob.mx/islandora_74/islandora/object/guia:22", "official-guide", "huasteca", "H16",
      access="not-fetched", notes="Found by search; not opened in this pass."),
    S("inah-boletin-tamtoc-reapertura", "Instituto Nacional de Antropología e Historia (INAH)", "inah.gob.mx",
      "El INAH anuncia la reapertura de la zona arqueológica de Tamtoc, en San Luis Potosí",
      "https://inah.gob.mx/boletines/el-inah-anuncia-la-reapertura-de-la-zona-arqueologica-de-tamtoc-en-san-luis-potosi",
      "official-press-release", "huasteca", "H16", access="not-fetched", notes="Found by search; date not read."),
    S("conanp-simec", "Comisión Nacional de Áreas Naturales Protegidas (CONANP)", "simec.conanp.gob.mx",
      "SIMEC – Sistema de Información, Monitoreo y Evaluación para la Conservación", "https://simec.conanp.gob.mx/",
      "official-environmental", notes="Readable; links SIMEC books (PDF). Federal ANPs only; state ANPs (e.g. Media Luna "
                                      "as stated by the brochure) need the state environmental authority."),
    S("conanp-gob-mx", "Comisión Nacional de Áreas Naturales Protegidas (CONANP)", "gob.mx", "CONANP en gob.mx",
      "https://www.gob.mx/conanp", "official-environmental", access="blocked", verification="unverified",
      notes="JS challenge / connection reset in this pass."),
    # Open data and media
    S("osm-nominatim", "OpenStreetMap Foundation / contributors", "nominatim.openstreetmap.org", "Nominatim geocoder",
      "https://nominatim.openstreetmap.org/", "open-geodata", verification="community-data",
      notes="ODbL 1.0, © OpenStreetMap contributors. Used sequentially (≥1.1 s), identifying User-Agent, cached. Candidates only."),
    S("open-meteo", "Open-Meteo", "open-meteo.com", "Open-Meteo weather API", "https://open-meteo.com/",
      "open-weather-api", verification="open-data",
      notes="No API key, CORS supported, free for non-commercial use, fair use ~10,000 requests/day. Data CC BY 4.0; "
            "attribution link required next to displayed data (README, github.com/open-meteo/open-meteo)."),
    S("wikimedia-commons", "Wikimedia Foundation / contributors", "commons.wikimedia.org", "Wikimedia Commons API",
      "https://commons.wikimedia.org/w/api.php", "open-media", verification="per-file-licence",
      notes="Per-file licence, author and credit read from extmetadata. Metadata only; no downloads."),
    S("pexels", "Pexels", "pexels.com", "Pexels", "https://www.pexels.com/es-es/", "stock-media", verification="platform-licence",
      notes="robots.txt disallows search URLs (*q=*). Candidates found through web search results that point to individual "
            "photo pages (allowed). API requires a free key (not configured)."),
    S("unsplash", "Unsplash", "unsplash.com", "Unsplash", "https://unsplash.com/", "stock-media", access="blocked",
      verification="unverified", notes="Bot challenge on the website; API requires a free key."),
    # Non-official, recorded so they are never mistaken for verification
    S("realde14-com-mx", "Non-official (commercial/local site)", "realde14.com.mx", "Ruta del Pueblo Fantasma",
      "https://www.realde14.com.mx/ruta-del-pueblo-fantasma.html", "non-official", "altiplano", "A03",
      access="not-fetched", verification="not-official", notes="Workbook source for A03. Not usable as verification."),
    S("uaslp-seguridadalimentaria", "Universidad Autónoma de San Luis Potosí (unrelated page)", "seguridadalimentaria.uaslp.mx",
      "Página 2242", "https://seguridadalimentaria.uaslp.mx/Paginas/2242", "non-tourism", "zona-media", "M14",
      access="not-fetched", verification="not-official",
      notes="Workbook source for M14 (Grutas de la Catedral); a food-security page, apparently unrelated."),
    S("rntsecturgob-com-mx", "Unknown operator", "rntsecturgob.com.mx", "\"Consulta pública RNT\"", "https://rntsecturgob.com.mx/",
      "non-official", access="not-inspected", verification="not-official",
      notes="Surfaced by web search as an RNT consultation site, but the domain is not gob.mx. Do not use."),
]
SOURCE_IDS = {s["source_id"] for s in SOURCES}
write("source-registry/sources.json", {"generated": TODAY, "count": len(SOURCES), "sources": SOURCES})

# --------------------------------------------------------------------------- resources (PDF / guides / maps)
def sha(path):
    p = ROOT / path
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None

def R(rid, title, institution, region, url, file_type, downloadable, usage, redistribution, notes,
      language="es", publication_date=None, source_id=None, local=None, downloaded=False):
    return {"resource_id": rid, "title": title, "institution": institution, "region": region, "url": url,
            "file_type": file_type, "language": language, "publication_date": publication_date,
            "downloadable": downloadable, "downloaded": downloaded, "local_path": local,
            "sha256": sha(local) if local else None, "redistribution_status": redistribution,
            "usage_status": usage, "source_id": source_id, "notes": notes}

LINK_ONLY = "link-only: may be linked from the site as an external official resource; do not mirror"
BROCHURE_NOTE = ("4 pages: two of destination texts with tips, an 'Actividades turísticas' table by municipality, "
                 "and a 'Mapa turístico' with a distance/time table. Image-only PDF (no text layer); read visually.")
RESOURCES = [
    R("pdf-brochure-altiplano", "Región Altiplano – folleto", SEC_SLP, "altiplano",
      "https://drive.google.com/file/d/1A5Gzx1uLDWJf_0VD3132T1wWZU_5PZin/view", "pdf", True, LINK_ONLY, "unknown",
      BROCHURE_NOTE + " Distance table from Matehuala.", publication_date="2021–2027 administration (exact date unknown)",
      source_id="brochure-altiplano", local="raw/pdfs/F-Altiplano.pdf", downloaded=True),
    R("pdf-brochure-centro", "Región Centro – folleto", SEC_SLP, "centro",
      "https://drive.google.com/file/d/1vVjQaF3-PMsITAAKO4wB6NbO_XOdNUZM/view", "pdf", True, LINK_ONLY, "unknown",
      BROCHURE_NOTE + " Distance table from the capital.", publication_date="2021–2027 administration (exact date unknown)",
      source_id="brochure-centro", local="raw/pdfs/F-Centro.pdf", downloaded=True),
    R("pdf-brochure-huasteca", "Región Huasteca – folleto", SEC_SLP, "huasteca",
      "https://drive.google.com/file/d/1L8-2QGML1dNoqn42oH_PDK0nRrRVltoP/view", "pdf", True, LINK_ONLY, "unknown",
      BROCHURE_NOTE + " Distance table from Ciudad Valles. Season notes for Tamul and El Naranjo.",
      publication_date="2021–2027 administration (exact date unknown)",
      source_id="brochure-huasteca", local="raw/pdfs/F-Huasteca.pdf", downloaded=True),
    R("pdf-brochure-media", "Región Media – folleto", SEC_SLP, "zona-media",
      "https://drive.google.com/file/d/1dd56kW2i2GjGX1ePx2HaTRUty9xPZJIb/view", "pdf", True, LINK_ONLY, "unknown",
      BROCHURE_NOTE + " Distance table from Rioverde. Its map also marks El Naranjo and Tamasopo sites (see region conflict).",
      publication_date="2021–2027 administration (exact date unknown)",
      source_id="brochure-media", local="raw/pdfs/F-Media.pdf", downloaded=True),
    R("pdf-brochure-capital", "Capital Potosina – mapa turístico (ciudad y Centro Histórico)", SEC_SLP, "centro",
      "https://drive.google.com/file/d/1T_Ix-RxH68nRhtiLrAzsGjAKi43LZ2xg/view", "pdf", True, LINK_ONLY, "unknown",
      "2 pages: city map and Centro Histórico map, bilingual legend (ES/EN), Procesión del Silencio route. Has a text layer.",
      language="es/en", publication_date="unknown", source_id="brochure-capital", local="raw/pdfs/F-Capital.pdf", downloaded=True),
    *[R(f"map-{k}", f"Mapa {t}", SEC_SLP, reg, f"https://visitasanluispotosi.com/wp-content/uploads/{path}", "image/webp",
        True, LINK_ONLY, "unknown", f"Listed on the Mapas page (read via {ARCHIVE_MAPAS}). Not downloaded. "
        f"Upload path suggests {path[:7]}.", publication_date=path[:7], source_id="visitaslp-mapas")
      for k, t, reg, path in [
          ("general-2026", "general del estado 2026", None, "2026/03/M-SLP-Gral-C2026-scaled.webp"),
          ("altiplano", "Región Altiplano", "altiplano", "2024/07/Mapa-Altiplano.webp"),
          ("centro", "Región Centro", "centro", "2024/12/mapa-centro.webp"),
          ("huasteca", "Región Huasteca", "huasteca", "2024/07/Mapa-Huasteca.webp"),
          ("media", "Región Media", "zona-media", "2024/07/Mapa-Media.webp")]],
    R("inah-guia-tamtoc", "Tamtoc (guía, Mediateca INAH)", "INAH", "huasteca",
      "https://mediateca.inah.gob.mx/islandora_74/islandora/object/guia:22", "html/guide", None, LINK_ONLY,
      "INAH repository: CC BY-NC-ND 4.0 unless stated otherwise (lugares.inah.gob.mx notice); not confirmed for this item",
      "Found by search; not opened.", source_id="inah-mediateca-tamtoc"),
    R("inah-lugar-tamtoc", "Tamtoc – ficha INAH", "INAH", "huasteca", "https://lugares.inah.gob.mx/es/node/4460", "html",
      None, LINK_ONLY, "CC BY-NC-ND 4.0 unless stated otherwise",
      "Hours, admission, address, access, structures, related publications list.", source_id="inah-lugares-tamtoc"),
    R("inegi-cem-app", "Continuo de Elevaciones Mexicano (CEM) – descarga", "INEGI", None,
      "https://www.inegi.org.mx/app/geo2/elevacionesmex/", "dataset (raster)", True,
      "not downloaded (awaiting authorization); needed for the measured elevation profile", "INEGI terms not yet read",
      "By state; 15/30/60/90/120 m. A help PDF ('Ayuda general', ~403 KB) is linked from the app.", source_id="inegi-cem"),
    *[R(f"simec-libro-{y}", f"SIMEC – libro {y}", "CONANP", None, f"https://simec.conanp.gob.mx/libros/simec_{y}.pdf", "pdf",
        True, LINK_ONLY, "unknown", "National ANP publication listed on SIMEC home; not SLP-specific; not opened.",
        language="en" if y.endswith("ing") else "es", source_id="conanp-simec")
      for y in ["2004", "2006", "2010_esp", "2010_ing"]],
    R("sectur-nom-08-tur-2002", "NOM-08-TUR-2002", SECTUR, None,
      "https://www.gob.mx/cms/uploads/attachment/file/19513/1_NOM-08-TUR-2002.pdf", "pdf", True, LINK_ONLY,
      "official standard (public)", "Guide accreditation standard; not opened.", source_id="sectur-nom-08-tur-2002"),
    R("turismo-slp-rnt-formato", "Formato Único para los Trámites del RNT", SEC_SLP, None,
      "https://www.turismoslp.com.mx/Descargas/RNT/FormatoUnicoparalosTramitesdelRNT.pdf", "pdf", True,
      "administrative; not visitor-facing", "unknown", "Provider registration form linked from turismo.slp.gob.mx/rnt/.",
      source_id="turismo-slp-rnt"),
]
write("pdf-registry/resources.json", {
    "generated": TODAY,
    "policy": "Official PDFs are linked as external resources. Nothing is mirrored or republished unless reuse rights are explicit.",
    "count": len(RESOURCES), "downloaded": sum(r["downloaded"] for r in RESOURCES), "resources": RESOURCES})

# --------------------------------------------------------------------------- destinations
def V(value, source, note=None):
    assert source in SOURCE_IDS, source
    return {"value": value, "status": "verified", "source": source, "verifiedAt": TODAY, **({"note": note} if note else {})}

def P(value=None, source=None, note=None):
    assert source is None or source in SOURCE_IDS, source
    return {"value": value, "status": "pending", **({"source": source} if source else {}), **({"note": note} if note else {})}

def U(note):
    return {"value": None, "status": "unavailable", "note": note}

PM = lambda: V(True, "sectur-com-244-2023")
SEASON_ELNARANJO = V("noviembre a marzo", "brochure-huasteca", "Stated for El Naranjo's sites as 'una buena temporada'.")
REGION_CONFLICT = ("Listed in the Huasteca brochure, but the Región Media brochure map also marks this municipality's sites. "
                   "Region assignment pending the official state regionalisation (gob-slp-regiones).")

# Hand-curated from the sources read in this pass. desc = short Spanish paraphrase of the source text.
CURATED = {
    "A01": dict(
        desc=V("Antiguo real de minas del Altiplano, fundado hacia 1778; se llega cruzando el Túnel de Ogarrio y hoy es uno de "
               "los mayores atractivos turísticos del estado.", "turismo-slp-lugar-real-de-catorce"),
        municipality=V("Catorce", "brochure-altiplano"), pueblo_magico=PM(),
        pueblo_magico_since=V(2001, "sectur-art-real-de-catorce"),
        category="cultural", tags=["pueblos-magicos", "patrimonio", "mineria", "aventura", "fotografia"],
        access=[V("Acceso por el Túnel de Ogarrio.", "turismo-slp-lugar-real-de-catorce"),
                V("Recorridos a caballo o en vehículos Willys por los alrededores.", "turismo-slp-lugar-real-de-catorce")],
        season=V("Clima extremo en el Altiplano: verano muy soleado, caluroso y seco; invierno de frío extremo.",
                 "brochure-altiplano", "Regional climate note, not destination-specific."),
        resources=["pdf-brochure-altiplano", "map-altiplano"],
        conflicts=["Tunnel length: 2.3 km (turismo-slp-lugar-real-de-catorce) vs 2.5 km (brochure-altiplano)."]),
    "A02": dict(
        desc=V("Túnel perforado en roca maciza que desemboca en el pueblo; es la entrada tradicional a Real de Catorce.",
               "turismo-slp-lugar-real-de-catorce"),
        municipality=V("Catorce", "turismo-slp-lugar-real-de-catorce"), category="cultural",
        tags=["patrimonio", "mineria", "arquitectura"],
        length=P(None, "turismo-slp-lugar-real-de-catorce", "Conflict: 2.3 km (state page) vs 2.5 km (brochure-altiplano)."),
        resources=["pdf-brochure-altiplano"],
        conflicts=["Tunnel length: 2.3 km vs 2.5 km between two official sources."]),
    "A03": dict(
        desc=U("No official description found. Workbook source realde14.com.mx is not official. The Altiplano brochure "
               "mentions the abandoned mines of Cerro del Quemado, not a 'Pueblo Fantasma' by name."),
        municipality=P("Catorce", None, "Workbook value; no official page."), category="cultural",
        tags=["mineria", "aventura", "patrimonio"], resources=[]),
    "A06": dict(
        desc=V("La ciudad más dinámica y comercial del Altiplano y punto de partida para recorrer la región; destaca la "
               "Catedral de la Inmaculada Concepción, réplica de la iglesia de San José de Lyon, Francia.", "brochure-altiplano"),
        municipality=V("Matehuala", "brochure-altiplano"), category="cultural",
        tags=["arquitectura", "gastronomia", "artesania", "ciudad-base"],
        gastronomy=V(["chorizo", "cabrito", "dulces de leche quemada", "obleas", "cajeta"], "brochure-altiplano"),
        resources=["pdf-brochure-altiplano", "map-altiplano"]),
    "A12": dict(
        desc=V("Pueblo minero que conserva gran parte de su traza original, con calles irregulares y callejones; produce "
               "quesos de estilo gourmet y es conocido por sus gorditas ferrocarrileras.", "brochure-altiplano"),
        municipality=V("Charcas", "brochure-altiplano"), category="cultural",
        tags=["patrimonio", "mineria", "gastronomia"],
        resources=["pdf-brochure-altiplano"],
        conflicts=["Workbook frames this place as 'Ruta del Mezcal – Charcas'. The official brochures associate the "
                   "mezcal route with Villa de Guadalupe (Altiplano) and Mexquitic/Ahualulco (Centro), not Charcas."]),
    "A15": dict(
        desc=P(None, "brochure-altiplano", "Landscape theme, not a destination. Only a regional climate note is official."),
        municipality=U("Regional landscape; spans several municipalities."), category="natural",
        tags=["naturaleza", "paisaje", "fotografia"], coords_unavailable="A landscape, not a single point.",
        resources=["pdf-brochure-altiplano", "map-altiplano"]),
    "C01": dict(
        desc=V("Uno de los centros históricos más señoriales del país, con grandes mansiones, parroquias y templos; se "
               "recorre a pie, en bicicleta o en el Tranvía Turístico.", "brochure-centro"),
        municipality=V("San Luis Potosí", "brochure-centro"), category="cultural",
        tags=["patrimonio", "arquitectura", "gastronomia", "ciudad-base"],
        gastronomy=V(["enchiladas potosinas", "gorditas rellenas", "asado de boda", "tacos rojos", "colonche",
                      "aguamiel", "queso de tuna", "chocolates Costanzo y La Frontera"], "brochure-centro"),
        resources=["pdf-brochure-capital", "pdf-brochure-centro", "map-centro"]),
    "C02": dict(
        desc=P(None, "brochure-capital", "Named on the official Centro Histórico map (Plaza de Armas, Catedral, Palacio de "
                                         "Gobierno), but no official descriptive text was found."),
        municipality=V("San Luis Potosí", "brochure-capital"), category="cultural",
        tags=["patrimonio", "arquitectura"], resources=["pdf-brochure-capital"]),
    "C03": dict(
        desc=V("Una de las plazas más tradicionales de la ciudad, escenario de eventos artísticos y culturales; en Semana "
               "Santa es punto de inicio y término de la Procesión del Silencio.", "turismo-slp-lugar-plaza-del-carmen"),
        municipality=V("San Luis Potosí", "turismo-slp-lugar-plaza-del-carmen"), category="cultural",
        tags=["patrimonio", "cultura-viva", "arquitectura"],
        season=V("Semana Santa: Procesión del Silencio (inicio y término en la plaza).", "turismo-slp-lugar-plaza-del-carmen",
                 "Event association only; no dates."),
        resources=["pdf-brochure-capital"]),
    "C08": dict(
        desc=V("Dentro del Centro de las Artes (CEART San Luis); inaugurado en 2018, es el primer espacio dedicado a Leonora "
               "Carrington y expone esculturas, joyas, grabados y objetos personales.",
               "turismo-slp-lugar-centro-de-las-artes-de-san-luis-potosi"),
        municipality=V("San Luis Potosí", "turismo-slp-lugar-museo-leonora-carrinton-slp"), category="cultural",
        tags=["arte", "museos", "surrealismo"],
        address=V("Calzada de Guadalupe 705, San Luis Potosí", "turismo-slp-lugar-museo-leonora-carrinton-slp"),
        resources=["pdf-brochure-centro", "pdf-brochure-capital"],
        conflicts=["Not to be confused with the Museo Leonora Carrington in Xilitla (turismo-slp-lugar-museo-leonora-carrington-xilitla)."]),
    "C10": dict(
        desc=V("Antiguo real de minas que dio origen a la fundación de la capital a finales del siglo XVI; casi un pueblo "
               "fantasma, con la Parroquia de San Pedro, la Capilla de San Nicolás y un museo de minería.", "brochure-centro"),
        municipality=V("Cerro de San Pedro", "brochure-centro"), category="cultural",
        tags=["mineria", "patrimonio", "senderismo", "ciclismo"],
        access=[V("Sendero del Capitán: parque lineal que inicia en Cerro de San Pedro y termina en Armadillo de los Infante; "
                  "se recomienda recorrerlo con guía certificado.", "brochure-centro",
                  "The brochure gives a length; transcription pending.")],
        resources=["pdf-brochure-centro", "map-centro"]),
    "C11": dict(
        desc=V("Pueblo Mágico fundado en 1542 y conocido como la Cuna del Rebozo, cerca de la capital; sus talleres trabajan "
               "el ikat y el telar de cintura.", "turismo-slp-lugar-santa-maria-del-rio"),
        municipality=V("Santa María del Río", "turismo-slp-lugar-santa-maria-del-rio"), pueblo_magico=PM(),
        category="cultural", tags=["pueblos-magicos", "artesania", "gastronomia", "patrimonio"],
        gastronomy=V(["asado de boda", "barbacoa", "nopales en escabeche", "queso de tuna", "muéganos", "dulce de membrillo"],
                     "turismo-slp-lugar-santa-maria-del-rio"),
        resources=["pdf-brochure-centro", "map-centro"],
        conflicts=["Travel time: '20 minutos' from the capital (state page) vs the brochure distance table (transcription pending)."]),
    "C12": dict(
        desc=V("Artesanas y artesanos elaboran rebozos con ikat y telar de cintura —entre ellos el rebozo de bolita—; el "
               "Museo Casa del Rebozo difunde este arte y varios domicilios particulares trabajan a diario.",
               "turismo-slp-lugar-santa-maria-del-rio", "Also brochure-centro (Museo Casa del Rebozo)."),
        municipality=V("Santa María del Río", "brochure-centro"), category="cultural",
        tags=["artesania", "cultura-viva", "textiles"], coords_unavailable="Workshops are spread across the town; use C11.",
        resources=["pdf-brochure-centro"],
        ethics="Portraits of artisans need informed consent."),
    "M01": dict(
        desc=V("Parque Estatal con manantial de corrientes tranquilas y fauna endémica; segura para nadar y bucear todo el "
               "año, con servicios para acampar.", "brochure-media"),
        municipality=V("Rioverde", "brochure-media", "Listed under Rioverde in the activities table."),
        category="natural", tags=["agua", "naturaleza", "buceo", "natacion", "campismo"],
        season=V("todo el año (natación y buceo)", "brochure-media"),
        protected_area=P("Área Natural Protegida / Parque Estatal", "brochure-media",
                         "Stated by the tourism brochure. Confirm the decree with the state environmental authority."),
        resources=["pdf-brochure-media", "map-media"]),
    "M02": dict(
        desc=V("'La capital de la Región Media': ciudad agrícola y comercial desde la que se practican buceo, kayak, ciclismo "
               "de montaña, espeleología y senderismo.", "brochure-media"),
        municipality=V("Rioverde", "brochure-media"), category="cultural",
        tags=["ciudad-base", "gastronomia", "aventura"], resources=["pdf-brochure-media", "map-media"]),
    "M03": dict(
        desc=V("Corazón cultural de Ciudad Fernández, fundada oficialmente en 1694: traza en damero, plaza de árboles "
               "centenarios, parroquia del Dulce Nombre de Jesús, Capilla El Refugio y El Balandrán.",
               "turismo-slp-lugar-centro-historico-de-ciudad-fernandez"),
        municipality=V("Ciudad Fernández", "turismo-slp-lugar-centro-historico-de-ciudad-fernandez"), category="cultural",
        tags=["patrimonio", "arquitectura", "gastronomia", "ciclismo"],
        resources=["pdf-brochure-media", "map-media"]),
    "M09": dict(
        desc=V("Pueblo Mágico de la Región Media con la Casa Barraganeña, la Parroquia neoclásica de la Purísima Concepción "
               "y los murales de El Tepeyac; su Semana Santa xi'iui es una de sus tradiciones más antiguas.",
               "turismo-slp-lugar-ciudad-del-maiz"),
        municipality=V("Ciudad del Maíz", "turismo-slp-lugar-ciudad-del-maiz"), pueblo_magico=PM(),
        region_note=V("zona-media", "turismo-slp-lugar-ciudad-del-maiz", "'Ubicado al este de la Región Media'."),
        category="cultural", tags=["pueblos-magicos", "patrimonio", "arte", "cultura-viva"],
        season=V("Semana Santa indígena xi'iui (pames).", "brochure-media", "Event association only; no dates."),
        gastronomy=V(["guiso borracho"], "brochure-media"),
        resources=["pdf-brochure-media", "map-media"],
        conflicts=["Mural credits differ: text says designed by Diego Rivera and executed by his disciples; the brochure's "
                   "activities table lists 'Murales de Jorge Pasquel'."]),
    "H01": dict(
        desc=V("Cascada de 105 metros de caída natural; se visita en panga y el río Tampaón puede recorrerse en kayak.",
               "brochure-huasteca"),
        municipality=V("Aquismón", "brochure-huasteca"), category="natural",
        tags=["agua", "cascadas", "aventura", "naturaleza"],
        height_m=V(105, "brochure-huasteca"),
        season=V("noviembre a marzo", "brochure-huasteca", "'La mejor temporada para apreciarla'."),
        access=[V("Visita en panga.", "brochure-huasteca")],
        resources=["pdf-brochure-huasteca", "map-huasteca"]),
    "H02": dict(
        desc=V("Río de la zona de Aquismón que se cruza en kayak y por el que se llega en panga a la Cascada de Tamul.",
               "brochure-huasteca"),
        municipality=P("Aquismón", "brochure-huasteca", "Listed under Aquismón; a river crosses several municipalities."),
        category="natural", tags=["agua", "aventura", "kayak", "rafting"],
        coords_unavailable="A river is a line; the visitor access point needs an official source.",
        resources=["pdf-brochure-huasteca", "map-huasteca"]),
    "H04": dict(
        desc=V("Sima ideal para espeleología y senderismo, y para observar aves como loros y vencejos, sobre todo al "
               "amanecer y al caer la tarde.", "brochure-huasteca"),
        municipality=V("Aquismón", "brochure-huasteca"), category="natural",
        tags=["naturaleza", "aves", "aventura", "espeleologia"],
        season=V("al amanecer y al caer la tarde (observación de aves)", "brochure-huasteca", "Time of day, not season."),
        protected_area=P(None, None, "Not stated in any source read in this pass."),
        resources=["pdf-brochure-huasteca", "map-huasteca"]),
    "H06": dict(
        desc=V("Pueblo Mágico entre Xilitla y Ciudad Valles donde aún se hablan teenek, náhuatl y xi'iui; punto de partida "
               "hacia Tamul, los sótanos de Las Golondrinas y Las Huahuas y el río Tampaón.", "turismo-slp-lugar-aquismon"),
        municipality=V("Aquismón", "turismo-slp-lugar-aquismon"), pueblo_magico=PM(),
        category="cultural", tags=["pueblos-magicos", "cultura-viva", "artesania", "aventura"],
        resources=["pdf-brochure-huasteca", "map-huasteca"]),
    "H07": dict(
        desc=V("Pueblo Mágico de niebla, selva y café, con raíces nahuas y téenek; aquí Edward James creó Las Pozas y se "
               "encuentran el Convento de San Agustín y el Museo Leonora Carrington.", "turismo-slp-lugar-xilitla",
               "Museum mention from brochure-huasteca."),
        municipality=V("Xilitla", "turismo-slp-lugar-xilitla"), pueblo_magico=PM(),
        pueblo_magico_since=V(2011, "sectur-art-xilitla"),
        category="cultural", tags=["pueblos-magicos", "arte", "surrealismo", "cultura-viva", "cafe"],
        resources=["pdf-brochure-huasteca", "map-huasteca"]),
    "H08": dict(
        desc=V("Jardín escultórico de Edward James: treinta hectáreas de vegetación con treinta y seis estructuras "
               "surrealistas y una cascada de 37 metros que desemboca en Las Pozas.", "brochure-huasteca"),
        municipality=V("Xilitla", "brochure-huasteca"), category="cultural",
        tags=["arte", "surrealismo", "naturaleza", "agua"],
        resources=["pdf-brochure-huasteca", "map-huasteca"],
        conflicts=["Edward James is called 'escocés' (brochure-huasteca) and 'poeta y artista inglés' "
                   "(turismo-slp-lugar-xilitla). Avoid stating nationality until checked."]),
    "H10": dict(
        desc=V("Cascadas de aguas cristalinas y pozas tranquilas, acondicionadas con cabañas, tiendas de souvenirs, "
               "restaurantes y áreas recreativas.", "brochure-huasteca"),
        municipality=V("Tamasopo", "brochure-huasteca"), category="natural",
        tags=["agua", "cascadas", "familia", "naturaleza"],
        resources=["pdf-brochure-huasteca", "map-huasteca"], conflicts=[REGION_CONFLICT]),
    "H11": dict(
        desc=V("Pozas de azul profundo con una caverna y un puente natural de roca; se puede caminar, cabalgar, nadar y "
               "bucear.", "brochure-huasteca"),
        municipality=V("Tamasopo", "brochure-huasteca"), category="natural",
        tags=["agua", "naturaleza", "natacion", "buceo"],
        resources=["pdf-brochure-huasteca", "map-huasteca"],
        conflicts=[REGION_CONFLICT, "The Huasteca activities table also lists a 'Puente de Dios' under Aquismón; "
                   "possibly a second site of the same name.",
                   "A Pexels photo titled 'Puente de Dios' is in Querétaro, not here."]),
    "H12": dict(
        desc=V("Las Cascadas de Pago Pago (Micos): siete cascadas con caídas de dos a veinte metros, para rafting, kayak "
               "y salto en cascadas.", "brochure-huasteca"),
        municipality=V("Ciudad Valles", "brochure-huasteca"), category="natural",
        tags=["agua", "cascadas", "aventura"], official_name=V("Cascadas de Pago Pago (Micos)", "brochure-huasteca"),
        resources=["pdf-brochure-huasteca", "map-huasteca"]),
    "H13": dict(
        desc=V("Cascada acondicionada con zonas de campismo y un mirador.", "brochure-huasteca"),
        municipality=V("El Naranjo", "brochure-huasteca"), category="natural",
        tags=["agua", "cascadas", "campismo"], season=SEASON_ELNARANJO,
        resources=["pdf-brochure-huasteca", "map-huasteca"], conflicts=[REGION_CONFLICT]),
    "H14": dict(
        desc=V("Cascada de 35 metros de caída, muy cerca de la cabecera de El Naranjo.", "brochure-huasteca"),
        municipality=V("El Naranjo", "brochure-huasteca"), category="natural",
        tags=["agua", "cascadas", "kayak", "paddle"], height_m=V(35, "brochure-huasteca"), season=SEASON_ELNARANJO,
        resources=["pdf-brochure-huasteca", "map-huasteca"], conflicts=[REGION_CONFLICT]),
    "H16": dict(
        desc=V("Antigua ciudad de la Huasteca (900–1100), con comercio fluvial, pirámides, monolitos, estelas, pintura "
               "mural y esculturas en piedra como la Venus de Tamtoc.", "inah-lugares-tamtoc"),
        municipality=V("Tamuín", "inah-lugares-tamtoc"), category="cultural",
        tags=["arqueologia", "patrimonio", "cultura-teenek"],
        official_coords=(21.924445, -98.812866),
        hours=V("Lunes a domingo, 09:00–18:00 h; último acceso 17:00 h", "inah-lugares-tamtoc",
                "Volatile: re-check before publishing."),
        admission=V("Sin costo (visitantes nacionales y extranjeros)", "inah-lugares-tamtoc",
                    "Volatile: re-check before publishing."),
        address=V("Ramal de carretera a Tamtoc km 10, Municipio de Tamuín; entronque con la carretera Tamuín–San Vicente (SLP 14)",
                  "inah-lugares-tamtoc"),
        extra=[V("Más de setenta edificaciones prehispánicas, una plaza ceremonial y esculturas monolíticas.", "brochure-huasteca")],
        resources=["inah-lugar-tamtoc", "inah-guia-tamtoc", "pdf-brochure-huasteca", "map-huasteca"]),
}

# Region of each Priority A place, as the official brochure that covers it states.
REGION_SOURCE = {"altiplano": "brochure-altiplano", "centro": "brochure-centro", "zona-media": "brochure-media",
                 "huasteca": "brochure-huasteca"}
DESTINATION_PAGE = {  # workbook official_source classification
    "turismo.slp.gob.mx/lugares/": "destination-specific", "slp.gob.mx/lugares/": "destination-specific",
    "gob.mx/sectur/articulos/": "destination-specific", "?page=": "generic-listing", "?cat=": "generic-listing",
    "visitasanluispotosi/region-": "regional", "slp.gob.mx/visitasanluispotosi/": "portal-home",
    "realde14": "non-official", "uaslp": "non-official"}

def classify(url):
    for k, v in DESTINATION_PAGE.items():
        if k in (url or ""):
            return v
    return "unknown"

def haversine(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))

places = json.loads((ROOT / "generated/workbook-places.json").read_text(encoding="utf-8"))["places"]
geo = json.loads((ROOT / "generated/geocode-candidates.json").read_text(encoding="utf-8"))["results"]
commons = json.loads((ROOT / "generated/commons-candidates.json").read_text(encoding="utf-8"))["records"]

PEXELS = [  # individual photo pages found through web search (robots.txt disallows Pexels search URLs)
    dict(id="14842050", place="H01", url="https://www.pexels.com/photo/cascada-de-tamul-tamul-waterfall-san-luis-potosi-mexico-14842050/",
         subject="Cascada de Tamul, Tamul Waterfall, San Luis Potosi, Mexico", author="Jean Paul Montanaro",
         author_url="https://www.pexels.com/@jean-paul-montanaro-49563862/", w=4424, h=5530, tag="Tamasopo, S.L.P., Mexico",
         status="NEEDS_REVIEW", why=["Location tag says Tamasopo; the official brochure places Tamul in Aquismón."]),
    dict(id="11798031", place="H12", url="https://www.pexels.com/photo/cascada-huasteca-potosina-11798031/",
         subject="cascada huasteca potosina", author="Ali Alcántara", author_url="https://www.pexels.com/@alialcantara/",
         w=4640, h=6960, tag="Ciudad Valles, S.L.P., Mexico", status="NEEDS_REVIEW",
         why=["Generic title; which waterfall is unconfirmed (tagged Ciudad Valles, matched to H12 Micos tentatively)."]),
    dict(id="11775031", place="H10", url="https://www.pexels.com/photo/people-riding-on-kayak-on-river-between-rocky-mountains-11775031/",
         subject="People riding on kayak on river between rocky mountains", author="Lehi Lara Leyvas",
         author_url="https://www.pexels.com/@lehi-lara-leyvas-173624/", w=3400, h=5100, tag="Tamasopo, S.L.P., México",
         status="NEEDS_REVIEW", why=["Tagged Tamasopo; exact site unconfirmed. Identifiable people may appear."]),
    dict(id="13070877", place="H11", url="https://www.pexels.com/photo/view-of-puente-de-dios-queretaro-mexico-13070877/",
         subject="View of Puente de Dios, Queretaro, Mexico", author=None, author_url=None, w=None, h=None,
         tag="Querétaro (per title)", status="REFERENCE_ONLY",
         why=["Different place with the same name (Querétaro). Recorded so it is never used for H11."]),
]

media_records = []
for r in commons:
    media_records.append({k: r[k] for k in ["asset_id", "place_id", "region", "destination", "subject", "source",
                                             "source_url", "author", "licence", "attribution_required", "intended_use",
                                             "orientation", "aspect_ratio", "status"]}
                         | {"credit": r["credit"], "licence_url": r["licence_url"], "file_url": r["file_url"],
                            "width": r["width"], "height": r["height"], "review_notes": r["review_notes"],
                            "visual_review": "not yet reviewed", "retrieved": r["retrieved"]})
pmap = {p["place_id"]: p for p in places}
for x in PEXELS:
    ratio = x["w"] / x["h"] if x["w"] else None
    media_records.append({
        "asset_id": f'{x["place"].lower()}-px-{x["id"]}', "place_id": x["place"], "region": pmap[x["place"]]["region"],
        "destination": pmap[x["place"]]["name"], "subject": x["subject"], "source": "Pexels", "source_url": x["url"],
        "author": x["author"], "licence": "Pexels License", "attribution_required": False,
        "intended_use": "card-candidate" if ratio and ratio < 0.9 else "reference",
        "orientation": ("portrait" if ratio < 0.95 else "landscape") if ratio else None,
        "aspect_ratio": f"{ratio:.2f}:1" if ratio else None, "status": x["status"],
        "credit": f'Foto: {x["author"]} / Pexels' if x["author"] else None, "licence_url": "https://www.pexels.com/license/",
        "file_url": None, "width": x["w"], "height": x["h"], "review_notes": x["why"] + [f'Location tag: {x["tag"]}'],
        "visual_review": "not yet reviewed", "retrieved": TODAY})

priority_a = [p for p in places if p["priority"] == "A"]
index = []
coord_verified = coord_pending = coord_unavailable = 0
for p in places:
    pid = p["place_id"]
    entry = {"place_id": pid, "name": p["name"], "region": p["region"], "priority": p["priority"],
             "researched_in_pass": 1 if p["priority"] == "A" else None}
    if p["priority"] != "A":
        entry["verification_status"] = "pending"
        entry["note"] = "Not researched in pass 1 (Priority B/C)."
        index.append(entry)
        continue
    c = CURATED[pid]
    g = geo.get(pid, {})
    hit = (g.get("hits") or [None])[0]
    if c.get("coords_unavailable") or g.get("status") == "unavailable" and not c.get("official_coords"):
        coords = U(c.get("coords_unavailable") or g.get("reason") or "No OSM candidate found.")
        coord_unavailable += 1
    elif c.get("official_coords"):
        lat, lon = c["official_coords"]
        d = haversine((lat, lon), (hit["lat"], hit["lon"])) if hit else None
        ok = d is not None and d < 1000
        coords = {"value": {"lat": lat, "lon": lon}, "status": "verified" if ok else "pending",
                  "source": "inah-lugares-tamtoc", **({"verifiedAt": TODAY} if ok else {}),
                  "cross_check": {"source": "osm-nominatim", "osm": hit and hit["osm"],
                                  "lat": hit and hit["lat"], "lon": hit and hit["lon"],
                                  "distance_m": round(d) if d is not None else None}}
        coord_verified += ok
        coord_pending += not ok
    elif hit:
        coords = {"value": {"lat": hit["lat"], "lon": hit["lon"]}, "status": "pending", "source": "osm-nominatim",
                  "osm": hit["osm"], "osm_feature": f'{hit["class"]}/{hit["type"]}',
                  "note": "OSM candidate; needs an official cross-check before it can be verified."}
        coord_pending += 1
    else:
        coords = U("No OSM candidate found.")
        coord_unavailable += 1
    region = V(p["region"], REGION_SOURCE[p["region"]])
    if any("Region assignment pending" in x for x in c.get("conflicts", [])):
        region = P(p["region"], REGION_SOURCE[p["region"]], "Conflicting official brochures; see conflicts.")
    m = [x for x in media_records if x["place_id"] == pid]
    facts = {k: c[k] for k in ["height_m", "length", "hours", "admission", "address", "gastronomy", "official_name",
                               "protected_area", "pueblo_magico_since", "region_note"] if k in c}
    rec = {
        "place_id": pid, "name": p["name"], "workbook": {"region_label": p["region_label"], "type": p["type"],
                                                         "priority": p["priority"], "official_source": p["official_source"],
                                                         "official_source_kind": classify(p["official_source"])},
        "region": region, "municipality": c["municipality"], "type": p["type"],
        "official_source": [s["source_id"] for s in SOURCES if s["destination"] == pid and s["source_type"] in
                            ("official-destination-page", "official-article", "official-heritage-page")],
        "description": c["desc"],
        "coordinates": coords,
        "coordinate_source": coords.get("source"),
        "pueblo_magico": c.get("pueblo_magico") or {"value": False, "status": "not-applicable"},
        "category": {"value": c["category"], "status": "editorial", "note": "Classification for site navigation, not a factual claim."},
        "interest_tags": {"value": c["tags"], "status": "editorial"},
        "season": c.get("season") or U("No season or month information in the sources read."),
        "access": c.get("access") or [],
        "facts": facts | ({"extra": c["extra"]} if "extra" in c else {}),
        "official_resources": c["resources"],
        "conflicts": c.get("conflicts", []),
        "ethics": c.get("ethics"),
        "media": {"commons": sum(x["source"] == "Wikimedia Commons" for x in m),
                  "commons_approved_candidates": sum(x["source"] == "Wikimedia Commons" and x["status"] == "APPROVED_CANDIDATE" for x in m),
                  "pexels": sum(x["source"] == "Pexels" for x in m)},
    }
    for r_id in rec["official_resources"]:
        assert any(r["resource_id"] == r_id for r in RESOURCES), r_id
    core = [rec["region"], rec["municipality"], rec["description"], rec["coordinates"]]
    verified_core = sum(x.get("status") == "verified" for x in core)
    rec["verified_core_fields"] = f"{verified_core}/4 (region, municipality, description, coordinates)"
    rec["verification_status"] = "verified" if verified_core == 4 else "pending"
    write(f"destinations/{pid}.json", rec)
    entry.update({"verification_status": rec["verification_status"], "verified_core_fields": rec["verified_core_fields"],
                  "description": rec["description"]["status"], "coordinates": rec["coordinates"]["status"],
                  "official_page": bool(rec["official_source"]), "conflicts": len(rec["conflicts"])})
    index.append(entry)

write("destinations/index.json", {
    "generated": TODAY, "statuses": ["pending", "verified", "unavailable"],
    "rule": "A destination is 'verified' only when region, municipality, description and coordinates are all verified.",
    "total": len(index), "researched": len(priority_a),
    "verified": sum(e["verification_status"] == "verified" for e in index),
    "coordinates": {"verified": coord_verified, "pending": coord_pending, "unavailable": coord_unavailable},
    "destinations": index})

write("media-registry/media-candidates.json", {
    "generated": TODAY,
    "policy": ["Nothing downloaded. Metadata only.",
               "APPROVED_CANDIDATE = explicit free licence + subject named + ≥1600 px + no flags. Still needs a human visual review.",
               "Official tourism-site photos (slp.gob.mx, turismo.slp.gob.mx, visitasanluispotosi.com) and the reference "
               "sites named in the brief are REFERENCE_ONLY unless explicit reuse rights exist.",
               "INAH photos: CC BY-NC-ND 4.0 (no derivatives) — cropping/re-encoding may not be allowed; not candidates yet."],
    "counts": {s: sum(x["status"] == s for x in media_records)
               for s in ["APPROVED_CANDIDATE", "NEEDS_REVIEW", "REFERENCE_ONLY", "PLACEHOLDER"]},
    "by_source": {s: sum(x["source"] == s for x in media_records) for s in ["Wikimedia Commons", "Pexels"]},
    "records": media_records})

# --------------------------------------------------------------------------- tour guides
write("generated/tour-guides-research.json", {
    "generated": TODAY,
    "question": "Is there an official registry of registered/certified tourist guides usable for San Luis Potosí?",
    "result": "official_registry_found",
    "summary": "SECTUR runs the official national directory of accredited guides (NOM-08-TUR-2002 / NOM-09-TUR-2002), "
               "filterable by state (San Luis Potosí), municipality, guide type and language. The state's own guide page "
               "(visitasanluispotosi.com/guias-de-turistas/) is blocked and has no archived copy.",
    "sources": [
        {"source_id": "sectur-guias-directorio", "official": True, "status": "accessible",
         "what": "Directory search form: inpEstado (24 = San Luis Potosí), inpMunicipio, inpTipoGuia, inpIdioma.",
         "not_done": "Not queried. Results are personal data (names, credential numbers)."},
        {"source_id": "sectur-guias-acreditacion", "official": True, "status": "accessible-via-webfetch",
         "what": "Accreditation program: Guía General (NOM-08), Guía Especializado en temas o localidades culturales (NOM-08), "
                 "Guía Especializado en actividades específicas — naturaleza/aventura (NOM-09)."},
        {"source_id": "sectur-nom-08-tur-2002", "official": True, "status": "not-fetched"},
        {"source_id": "turismo-slp-rnt", "official": True, "status": "accessible",
         "what": "State RNT procedures; provider categories include 'Operadora de Aventura Naturaleza'. No public list."},
        {"source_id": "visitaslp-guias", "official": True, "status": "blocked", "what": "Unknown content."},
        {"source_id": "rntsecturgob-com-mx", "official": False, "status": "rejected", "what": "Non-gob.mx domain; do not use."},
    ],
    "brochure_guidance": [V("Se recomienda contratar los servicios de un guía certificado y reservar tours con anticipación.",
                            "brochure-huasteca", "Same tip in all four regional brochures."),
                          V("Los sitios turísticos y parajes tienen una capacidad de carga limitada.", "brochure-huasteca")],
    "operators": {"status": "pending", "note": "No official public operator list found. The RNT is the registry; its "
                                               "official public consultation URL was not confirmed in this pass."},
    "recommendation": "On the site, link to the SECTUR directory (filtered to San Luis Potosí) and explain how to check a "
                      "credential. Do not list named guides without their consent and a fresh check in the directory.",
    "excluded": ["Facebook pages", "commercial directories"],
})

# --------------------------------------------------------------------------- weather model
write("generated/weather-model.json", {
    "generated": TODAY, "status": "design (not implemented)",
    "provider": {"source_id": "open-meteo", "api_key": False, "cors": True, "licence": "CC BY 4.0",
                 "terms": "Free for non-commercial use; fair use, contact above ~10,000 requests/day.",
                 "attribution": {"es": "Datos meteorológicos: Open-Meteo.com (CC BY 4.0)",
                                 "en": "Weather data: Open-Meteo.com (CC BY 4.0)",
                                 "links": ["https://open-meteo.com/", "https://creativecommons.org/licenses/by/4.0/"],
                                 "placement": "Next to every place weather data is shown."}},
    "current": {
        "where": "Client-side fetch, lazy (only when the widget is visible). The static build never depends on it.",
        "endpoint": "https://api.open-meteo.com/v1/forecast",
        "params": {"current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,"
                              "wind_speed_10m,wind_direction_10m,is_day",
                   "timezone": "America/Mexico_City", "wind_speed_unit": "kmh"},
        "fields": {"temperature_2m": "°C", "apparent_temperature": "°C", "relative_humidity_2m": "%",
                   "precipitation": "mm", "weather_code": "WMO code", "wind_speed_10m": "km/h",
                   "wind_direction_10m": "°", "is_day": "0/1", "time": "ISO 8601 local"},
        "cache": "localStorage per point, 30 min; wrapped in try/catch.",
        "failure": "Hide the widget; never show stale data without its timestamp.",
        "tested": {"date": TODAY, "point": "Ciudad Valles area (candidate)", "result": "200 OK, all fields present"}},
    "climate": {
        "where": "Build-time script → src/data/climate/<region>.json (12 monthly rows). No runtime calls.",
        "endpoint": "https://archive-api.open-meteo.com/v1/archive",
        "params": {"daily": "temperature_2m_max,temperature_2m_min,precipitation_sum", "start_date": "2016-01-01",
                   "end_date": "2025-12-31", "timezone": "America/Mexico_City"},
        "monthly_fields": {"tmax_mean_c": "mean of daily max", "tmin_mean_c": "mean of daily min",
                           "precip_mm": "mean monthly total", "rain_days": "mean days with ≥1 mm"},
        "label": {"es": "Promedio modelado 2016–2025 (reanálisis), no normal climatológica oficial",
                  "en": "Modelled 2016–2025 average (reanalysis), not an official climate normal"},
        "official_alternative": "SMN/CONAGUA Normales Climatológicas per station (not researched yet).",
        "tested": {"date": TODAY, "result": "10 years of daily data returned; monthly aggregation works."}},
    "points": {
        "rule": "One point per region for the region widget; destination points only once their coordinates are verified.",
        "regions": {
            "altiplano": {"anchor": "Matehuala (A06)", "coords_status": "pending"},
            "centro": {"anchor": "San Luis Potosí capital (C01)", "coords_status": "pending"},
            "zona-media": {"anchor": "Rioverde (M02)", "coords_status": "pending"},
            "huasteca": {"anchor": "Ciudad Valles (H17)", "coords_status": "pending (not geocoded in pass 1)"}}},
    "wmo_codes_es": {"0": "Despejado", "1": "Mayormente despejado", "2": "Parcialmente nublado", "3": "Nublado",
                     "45": "Niebla", "48": "Niebla con escarcha", "51": "Llovizna ligera", "53": "Llovizna",
                     "55": "Llovizna intensa", "61": "Lluvia ligera", "63": "Lluvia", "65": "Lluvia intensa",
                     "80": "Chubascos ligeros", "81": "Chubascos", "82": "Chubascos fuertes", "95": "Tormenta",
                     "96": "Tormenta con granizo ligero", "99": "Tormenta con granizo"},
})

print("sources", len(SOURCES), "| resources", len(RESOURCES), "| destinations", len(index),
      "| researched", len(priority_a), "| verified", sum(e["verification_status"] == "verified" for e in index))
print("coords verified/pending/unavailable", coord_verified, coord_pending, coord_unavailable)
print("media", {s: sum(x["status"] == s for x in media_records) for s in ["APPROVED_CANDIDATE", "NEEDS_REVIEW", "REFERENCE_ONLY"]})
