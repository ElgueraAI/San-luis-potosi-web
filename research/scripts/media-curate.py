"""Pass 2B: visual review decisions, scoring, selection, manifests and attributions.

The decisions below were made by looking at every candidate on contact sheets
(research/raw/media-review/sheets/*.png, built by make-sheets.py + contact-sheets.mjs).
Filename/title metadata was NOT trusted on its own: several searches returned other
places with the same name (Salinas → Canary Islands, Tierra Nueva → Philippines, Venado → Argentina).

Score (0–100) = accuracy 25 + impact 20 + technical 15 + composition 10 + resolution 10 + licence 10 + adaptability 10.
Accuracy, impact, technical, composition and adaptability are judged on the sheet; resolution and licence
are computed from metadata.

Statuses: SELECTED · BACKUP · NEEDS_MANUAL_ASSET (slot level) · REFERENCE_ONLY · REJECTED · NEEDS_REVIEW
Run after media-review.py. Outputs:
  media-registry/media-reviewed.json, attributions.json, home-asset-manifest.json,
  huasteca-asset-manifest.json, destination-asset-manifest.json
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TODAY = "2026-10-05"
MR = ROOT / "media-registry"

cands = {c["asset_id"]: c for c in json.loads((ROOT / "generated/commons-candidates-all.json").read_text(encoding="utf-8"))["records"]}
places = {p["place_id"]: p for p in json.loads((ROOT / "generated/workbook-places.json").read_text(encoding="utf-8"))["places"]}

PEXELS = {
    "px-14842050": dict(place_id="H01", title="Cascada de Tamul, Tamul Waterfall, San Luis Potosi, Mexico",
                        source_url="https://www.pexels.com/photo/cascada-de-tamul-tamul-waterfall-san-luis-potosi-mexico-14842050/",
                        author="Jean Paul Montanaro", author_url="https://www.pexels.com/@jean-paul-montanaro-49563862/",
                        width=4424, height=5530),
    "px-11775031": dict(place_id="H01", title="People riding on kayak on river between rocky mountains",
                        source_url="https://www.pexels.com/photo/people-riding-on-kayak-on-river-between-rocky-mountains-11775031/",
                        author="Lehi Lara Leyvas", author_url="https://www.pexels.com/@lehi-lara-leyvas-173624/", width=3400, height=5100),
    "px-11798031": dict(place_id=None, title="cascada huasteca potosina",
                        source_url="https://www.pexels.com/photo/cascada-huasteca-potosina-11798031/",
                        author="Ali Alcántara", author_url="https://www.pexels.com/@alialcantara/", width=4640, height=6960),
}
for k, v in PEXELS.items():
    cands[k] = {"asset_id": k, "place_id": v["place_id"], "theme": None, "title": v["title"], "source": "Pexels",
                "source_url": v["source_url"], "file_url": None, "width": v["width"], "height": v["height"],
                "author": v["author"], "author_url": v["author_url"], "credit": None, "licence": "Pexels License",
                "licence_url": "https://www.pexels.com/license/", "attribution_required": False, "restrictions": None,
                "licence_free": True, "not_photo": False, "region": "huasteca"}

# ------------------------------------------------------------------ review decisions
# asset_id: (place_id, status, role, (accuracy/25, impact/20, technical/15, composition/10, adaptability/10), note)
# place_id None = keep the candidate's own place; roles: hero, landscape, vertical, detail, culture, card, editorial, experience
R = {}
def r(aid, status, role, s, note, place=None, extra=None):
    R[aid] = dict(place=place, status=status, role=role, s=s, note=note, **(extra or {}))

# ---- HUASTECA
r("wc-48806929", "SELECTED", "hero", (25, 18, 12, 9, 8), "Tamul from the river: turquoise water, full canyon. Best Commons Tamul; 1920 px limits 4K hero.")
r("wc-45072519", "SELECTED", "landscape", (25, 15, 13, 9, 8), "Canyon framing of Tamul; clean, natural colour.")
r("wc-116896461", "BACKUP", "vertical", (25, 16, 13, 9, 8), "Vertical Tamul, high-res; superseded by the Pexels vertical.")
r("wc-45072503", "BACKUP", "vertical", (25, 14, 12, 8, 7), "Vertical falls, slightly flat light.")
r("wc-48806880", "SELECTED", "detail", (25, 18, 11, 8, 6), "Aerial over the lip of Tamul with mist: the 'drop' moment of The Descent.")
r("wc-45072507", "BACKUP", "landscape", (25, 12, 12, 8, 8), "Wider canyon, falls small.")
r("wc-123298771", "REJECTED", None, (20, 6, 6, 4, 4), "Muddy water, identifiable people in foreground, phone snapshot.")
r("px-14842050", "SELECTED", "vertical", (25, 20, 15, 10, 9), "Visually confirmed Tamul (Pexels tag says Tamasopo — wrong tag). Premium long exposure; mobile hero.")
r("px-11775031", "SELECTED", "experience", (25, 19, 14, 9, 9), "Visually confirmed Tamul with a panga approaching (tag says 'kayak', Tamasopo). Small, non-identifiable people.")
r("px-11798031", "NEEDS_REVIEW", "detail", (12, 16, 14, 8, 8), "Travertine cascades; exact place unknown (tag Ciudad Valles). Could be El Meco/Micos — confirm before use.")

r("wc-29767255", "SELECTED", "hero", (25, 18, 12, 9, 8), "Las Pozas: mossy dome, gothic windows, jungle. HDR-processed: grade down before use.")
r("wc-29767259", "SELECTED", "vertical", (25, 18, 11, 9, 8), "Water running under concrete arches; vertical, cinematic. Heavy HDR.")
r("wc-29767260", "SELECTED", "detail", (25, 16, 11, 8, 7), "Gothic arch doors and stair: signature Las Pozas detail.")
r("wc-2003803", "SELECTED", "landscape", (25, 15, 12, 8, 8), "Green 'ribs' structure with stairs, natural colour (Bernardo Bolaños).")
r("wc-29767254", "BACKUP", "vertical", (25, 14, 11, 8, 7), "Columns, HDR.")
r("wc-29767881", "BACKUP", "vertical", (25, 14, 11, 8, 7), "Stair between columns, HDR.")
r("wc-29767257", "BACKUP", "detail", (25, 13, 11, 8, 7), "Circular window, HDR.")
r("wc-29767882", "BACKUP", "detail", (25, 12, 11, 7, 6), "Painted sculpture, HDR.")

r("wc-112989200", "SELECTED", "landscape", (22, 13, 12, 8, 7), "Xilitla mountains; pastoral, not the town itself.")
r("wc-40384009", "BACKUP", "card", (25, 13, 9, 8, 6), "Xilitla in misty mountains; emblematic but 1600 px.")
r("wc-128308393", "SELECTED", "culture", (24, 16, 13, 9, 8), "Huehue mask from Xilitla: strong culture detail, vertical.")
r("wc-29767217", "BACKUP", "editorial", (25, 9, 11, 7, 6), "Xilitla street; brand signage and cars.")
r("wc-90841476", "REJECTED", None, (18, 8, 9, 6, 4), "Identifiable couple, partly undressed: privacy.")
r("wc-83576040", "BACKUP", "card", (25, 12, 8, 7, 6), "Las Pozas view, 1026 px only.")
r("wc-106469998", "REJECTED", None, (22, 5, 5, 4, 4), "Weak phone snapshot.")
r("wc-106470063", "REJECTED", None, (22, 5, 5, 4, 4), "Weak phone snapshot.")
r("wc-75414250", "BACKUP", "editorial", (22, 8, 10, 6, 6), "View from Museo Leonora Carrington Xilitla.", place="H07")

r("wc-45072628", "SELECTED", "hero", (25, 18, 13, 9, 8), "Puente de Dios: waterfall into turquoise pool, rock walls.")
r("wc-45072664", "SELECTED", "landscape", (25, 16, 12, 9, 8), "Pool seen through jungle.")
r("wc-89848894", "SELECTED", "vertical", (24, 17, 13, 9, 9), "Puente de Dios vertical, high-res (Eneas De Troya, CC BY).", place="H11")
r("wc-45072640", "BACKUP", "experience", (25, 12, 12, 8, 7), "Climber over the pool.")
r("wc-45072659", "BACKUP", "vertical", (25, 11, 11, 7, 7), "Vertical with climber.")
r("wc-45072627", "BACKUP", "experience", (25, 12, 12, 7, 7), "Swimmers on the guide rope; identifiable people (privacy check).")
r("wc-45072631", "BACKUP", "experience", (25, 12, 12, 7, 7), "Swimmers on rope; identifiable people.")
r("wc-45072619", "REJECTED", None, (20, 5, 4, 4, 3), "Motion-blurred jump.")
r("wc-53430894", "NEEDS_REVIEW", "editorial", (10, 10, 6, 6, 4), "Historic photo titled 'Puente de Dios'; which Puente de Dios is unconfirmed.")

r("wc-98007105", "SELECTED", "hero", (25, 17, 14, 9, 9), "Minas Viejas: boardwalk, double fall, turquoise pools; 8630 px.")
r("wc-98007106", "SELECTED", "landscape", (25, 16, 14, 9, 9), "Double fall over travertine pools.")
r("wc-98007108", "SELECTED", "vertical", (25, 15, 13, 9, 9), "Vertical double fall.")
r("wc-75414206", "SELECTED", "card", (25, 16, 12, 9, 8), "Direct view of the falls, vivid (Adam Jones).")
for a in ("wc-98007112", "wc-98007101", "wc-98007104"):
    r(a, "BACKUP", "landscape", (25, 13, 13, 8, 8), "Alternative Minas Viejas frames, overcast.")
r("wc-676261", "REJECTED", None, (25, 8, 3, 6, 3), "450 px.")

r("wc-98005525", "SELECTED", "hero", (25, 15, 14, 9, 9), "Micos: cascade foreground leading to the falls; 7273 px.")
r("wc-98005522", "SELECTED", "landscape", (25, 13, 14, 9, 9), "River Micos with falls, framed by trees.")
r("wc-98005523", "SELECTED", "vertical", (25, 13, 13, 9, 8), "Falls framed through a tree trunk; vertical.")
r("wc-98005524", "BACKUP", "landscape", (25, 12, 13, 8, 8), "Wide river view.")
r("wc-75414205", "NEEDS_REVIEW", "landscape", (12, 9, 10, 4, 3), "Panorama titled 'Micos River at Minas Viejas' — contradictory place; extreme ratio.")

r("wc-93308060", "SELECTED", "hero", (25, 14, 12, 8, 8), "El Meco stepped cascades; good but not premium.")
r("wc-15380133", "BACKUP", "landscape", (25, 11, 9, 7, 7), "El Meco, blown highlights (CC0).")
r("wc-58150052", "BACKUP", "card", (22, 10, 9, 7, 6), "El Naranjo cascade, 1280 px.")
r("wc-29799423", "REJECTED", None, (10, 5, 8, 2, 1), "2100×300 banner.")

r("wc-6172324", "SELECTED", "card", (25, 15, 12, 9, 7), "Tamasopo fall into blue pool: strong but 1280 px — cards/thumbnails only.")
r("wc-58150033", "BACKUP", "card", (25, 10, 9, 7, 6), "Tamasopo falls, flat light, 1280 px.")
r("wc-2615154", "BACKUP", "card", (25, 10, 8, 7, 6), "Tamasopo falls, 1030 px (PD).")

r("wc-2005486", "SELECTED", "landscape", (25, 15, 10, 8, 7), "Golondrinas mouth with cavers for scale (FAL).")
r("wc-2008166", "SELECTED", "vertical", (25, 16, 10, 8, 7), "Looking up from inside the shaft during a rappel (FAL).")
r("wc-48931625", "BACKUP", "landscape", (25, 11, 9, 7, 6), "Shaft wall, 1600 px.")
r("wc-90843616", "BACKUP", "editorial", (22, 10, 9, 7, 6), "Person from behind at the viewpoint (non-identifiable).")
r("wc-90843613", "REJECTED", None, (18, 6, 7, 4, 4), "Power lines, weak frame.")
r("wc-3549856", "REJECTED", None, (22, 8, 3, 5, 3), "450 px.")
r("wc-4277461", "REJECTED", None, (0, 10, 10, 6, 5), "Bird-nest harvesting on a sea cliff: not San Luis Potosí.")
r("wc-66633932", "SELECTED", "card", (24, 12, 11, 7, 7), "Inside the Sótano/Hoya de las Huahuas.", place="H05")

r("wc-45072511", "SELECTED", "hero", (25, 17, 13, 9, 8), "Tampaón canyon with pangas: scale and colour.")
r("wc-45072553", "SELECTED", "experience", (25, 18, 12, 9, 8), "POV from a panga's bow into the canyon: cinematic, itinerary image.")
r("wc-45072509", "SELECTED", "detail", (25, 14, 12, 8, 7), "Travertine cliff over turquoise water: texture.")
r("wc-45072522", "BACKUP", "landscape", (25, 13, 12, 8, 8), "River with seeping falls.")
for a in ("wc-45072530", "wc-45072517", "wc-45072543"):
    r(a, "BACKUP", "detail", (25, 10, 12, 7, 7), "Tampaón texture/backup.")
r("wc-45072540", "REJECTED", None, (10, 5, 11, 5, 4), "Portrait of an identifiable person.")

r("wc-21612508", "SELECTED", "card", (25, 13, 11, 8, 7), "Templo de San Miguel Arcángel, Aquismón (town identity).")
r("wc-52606453", "SELECTED", "landscape", (24, 16, 12, 8, 8), "Tampaón embarkation with pangas (titled Aquismón).")
r("wc-21612638", "BACKUP", "culture", (25, 10, 9, 7, 6), "Church interior with worshippers (privacy).")
r("wc-52605814", "REJECTED", None, (12, 8, 8, 5, 4), "Generic swing shot.")
r("wc-132577783", "REJECTED", None, (20, 6, 8, 2, 1), "Banner ratio.")

r("wc-60066386", "SELECTED", "hero", (25, 15, 13, 9, 8), "Tamtoc aerial over the plazas and mounds.")
r("wc-18354459", "BACKUP", "detail", (25, 12, 4, 7, 4), "Monumento 32 (La Sacerdotisa), 600 px only.")

# ---- ALTIPLANO
r("wc-69780780", "SELECTED", "hero", (25, 18, 14, 9, 9), "Real de Catorce panorama in its valley (6000 px, CC BY).")
r("wc-119874344", "SELECTED", "landscape", (25, 16, 11, 9, 7), "Street to the Purísima Concepción tower, dramatic sky.")
r("wc-119874435", "SELECTED", "editorial", (25, 16, 11, 8, 7), "Real de Catorce from the Pueblo Fantasma on horseback.")
r("wc-32558730", "SELECTED", "landscape", (22, 14, 11, 8, 8), "Sierra de Catorce ridges above the town: establishing shot.", place="A04")
r("wc-145400200", "SELECTED", "detail", (22, 14, 12, 8, 7), "Barrel cactus in desert gravel. Title says 'peyote' — it is a barrel cactus; never caption as peyote.", place="A15")
r("wc-145400211", "BACKUP", "vertical", (25, 11, 10, 7, 7), "Vertical street, phone image.")
r("wc-32558731", "BACKUP", "editorial", (25, 11, 10, 7, 6), "Street with old trucks.")
r("wc-145400208", "REJECTED", None, (20, 4, 4, 3, 3), "Dark mine gate snapshot.")
r("wc-12418759", "SELECTED", "vertical", (25, 10, 10, 7, 6), "Túnel de Ogarrio entrance, documentary.")
r("wc-76830445", "BACKUP", "card", (25, 12, 5, 7, 4), "Tunnel silhouette, 876 px.")
r("wc-12249749", "NEEDS_REVIEW", "landscape", (22, 12, 10, 4, 3), "360° panorama of Real de Catorce; crop needed (CC BY-SA allows it).", place="A01")
r("wc-43024327", "REJECTED", None, (0, 4, 8, 4, 3), "Engraving of a Spanish monument.")
r("wc-42373253", "SELECTED", "landscape", (24, 15, 12, 9, 8), "Yucca desert on the way to Matehuala: Altiplano identity.", place="A15")
r("wc-43679590", "SELECTED", "hero", (25, 15, 13, 9, 9), "Matehuala cathedral with clouds.", place="A07")
r("wc-129510016", "SELECTED", "vertical", (25, 12, 12, 8, 7), "Cathedral façade detail, vertical.", place="A07")
r("wc-182004799", "SELECTED", "card", (25, 15, 8, 8, 6), "Aerial of Matehuala with the cathedral and the sierra.", place="A06")
r("wc-129510111", "BACKUP", "landscape", (25, 12, 13, 8, 8), "Cathedral with market stalls.", place="A07")
r("wc-43679526", "BACKUP", "landscape", (25, 12, 12, 8, 8), "Cathedral and plaza.", place="A07")
r("wc-43679216", "BACKUP", "editorial", (22, 10, 12, 8, 7), "Arcade in Matehuala.")
r("wc-53595891", "BACKUP", "detail", (20, 11, 11, 8, 7), "Tropic monument (caption without unverified claims).")
r("wc-196569891", "REJECTED", None, (15, 4, 8, 3, 2), "Industrial residue subject.")
r("wc-66038963", "SELECTED", "card", (22, 10, 9, 8, 6), "Charcas railway station (CC BY-SA 2.0).")
r("wc-197397037", "REJECTED", None, (15, 4, 8, 3, 2), "Toxic-waste mound subject.")
r("wc-71718877", "REJECTED", None, (22, 8, 2, 5, 2), "538 px.")
r("wc-72428429", "SELECTED", "hero", (25, 16, 12, 9, 8), "Purísima Concepción, Guadalcázar, dark dramatic sky.", place="A08")
r("wc-43653605", "SELECTED", "editorial", (25, 12, 12, 8, 7), "Red municipal palace, Guadalcázar.", place="A08")
r("wc-48544817", "SELECTED", "card", (25, 12, 10, 8, 7), "Deer statue and parish tower, Venado.", place="A14")

# ---- CENTRO
r("wc-21525423", "SELECTED", "hero", (25, 15, 13, 9, 8), "Catedral and Plaza de Armas, clean daylight.", place="C02")
r("wc-50604762", "SELECTED", "vertical", (25, 16, 13, 9, 8), "Cathedral at night, B&W, vertical.", place="C02")
r("wc-116976144", "BACKUP", "landscape", (25, 15, 10, 6, 6), "Fisheye cathedral, heavy distortion.", place="C02")
r("wc-62994012", "BACKUP", "card", (25, 8, 7, 7, 6), "Faded scan.", place="C02")
r("wc-63495269", "SELECTED", "landscape", (25, 13, 12, 8, 8), "Templo de Loreto and Plaza Fundadores.", place="C01")
r("wc-77789641", "BACKUP", "landscape", (25, 11, 10, 7, 7), "Plaza with cathedral, burnt sky.", place="C01")
r("wc-63500691", "BACKUP", "editorial", (25, 9, 11, 7, 7), "Calle Othón, pedestrians.", place="C01")
r("wc-41833060", "SELECTED", "detail", (25, 17, 13, 9, 8), "Teatro de la Paz auditorium.", place="C05")
r("wc-77789645", "SELECTED", "hero", (25, 15, 13, 9, 8), "Templo del Carmen façade under blue sky.", place="C03")
r("wc-81112902", "SELECTED", "vertical", (25, 15, 14, 9, 9), "Templo del Carmen, vertical, 9162 px.", place="C03")
r("wc-75414140", "SELECTED", "detail", (25, 17, 12, 9, 7), "Baroque frieze detail, Templo del Carmen.", place="C04")
r("wc-21525467", "SELECTED", "landscape", (25, 13, 12, 8, 8), "Plaza del Carmen with fountain.", place="C03")
for a in ("wc-75414138", "wc-24677325", "wc-5783490", "wc-75414136"):
    r(a, "BACKUP", "detail", (25, 13, 11, 7, 6), "Carmen interior/detail alternatives.", place="C04")
r("wc-79606411", "SELECTED", "hero", (25, 16, 13, 9, 8), "Patio de las Grullas, Museo Leonora Carrington SLP. Third-party artwork in frame.", place="C08")
r("wc-81089617", "SELECTED", "detail", (25, 15, 12, 9, 7), "'La barca de las grullas' sculpture. Third-party artwork.", place="C08")
r("wc-67983604", "BACKUP", "card", (25, 13, 9, 8, 6), "CEART entrance with sculpture, 1184 px.", place="C08")
r("wc-67983603", "BACKUP", "card", (25, 12, 9, 8, 6), "Patio, 1500 px.", place="C08")
r("wc-110842527", "BACKUP", "vertical", (25, 11, 8, 7, 6), "Sculpture, 1024 px.", place="C08")
r("wc-50604767", "SELECTED", "hero", (25, 16, 14, 9, 9), "Cerro de San Pedro: hill and old buildings, 9162 px.", place="C10")
r("wc-50604761", "SELECTED", "landscape", (25, 14, 13, 9, 8), "Stone street in Cerro de San Pedro.", place="C10")
r("wc-158635553", "SELECTED", "editorial", (25, 13, 12, 8, 8), "Street to the church, blue sky (CC0).", place="C10")
r("wc-50604759", "SELECTED", "vertical", (25, 12, 12, 8, 7), "Old building, vertical.", place="C10")
r("wc-50604760", "BACKUP", "detail", (25, 12, 11, 8, 7), "Church framed by stone.", place="C10")
r("wc-197397789", "REJECTED", None, (18, 6, 8, 4, 2), "Ruin labelled with a mining company: sensitive.")
r("wc-58118619", "SELECTED", "landscape", (24, 13, 13, 9, 8), "Colonial patio in Santa María del Río.", place="C11")
r("wc-58139974", "SELECTED", "detail", (22, 12, 13, 8, 7), "Inlaid wooden box with a rebozo: local crafts.", place="C11")
r("wc-58138183", "BACKUP", "editorial", (25, 8, 12, 7, 7), "Presidencia Municipal with traffic cones.", place="C11")
r("wc-130690556", "BACKUP", "card", (25, 9, 10, 7, 6), "Town arch sign at night.", place="C11")
r("wc-52523104", "NEEDS_REVIEW", "landscape", (8, 13, 8, 8, 6), "'Mountain near San Luis Potosí': location unconfirmed.")
r("wc-58139971", "SELECTED", "detail", (25, 15, 14, 9, 8), "Silk rebozo texture, 6016 px.", place="C12")
r("wc-58139975", "SELECTED", "culture", (25, 15, 14, 9, 8), "Purple rebozo with ikat pattern.", place="C12")
r("wc-58139976", "BACKUP", "detail", (25, 13, 13, 8, 6), "Rebozo fringe.", place="C12")
r("wc-58139972", "BACKUP", "detail", (25, 11, 13, 8, 7), "Rebozo on table.", place="C12")
r("wc-136072397", "REJECTED", None, (22, 6, 8, 2, 1), "Banner ratio.")
r("wc-30504652", "SELECTED", "landscape", (25, 14, 14, 8, 8), "Teatro de la Paz and plaza, 6016 px.", place="C05")
r("wc-28794550", "SELECTED", "detail", (25, 16, 12, 9, 7), "Teatro de la Paz dome at golden hour.", place="C05")
r("wc-108267867", "SELECTED", "vertical", (25, 15, 9, 9, 7), "Teatro de la Paz with reflection, vertical (1080 px wide).", place="C05")
r("wc-147096098", "SELECTED", "landscape", (25, 12, 13, 8, 8), "Patio of the Centro de las Artes.", place="C07")
r("wc-147096090", "SELECTED", "vertical", (25, 14, 13, 8, 7), "Painted panopticon tower.", place="C07")
r("wc-147096089", "SELECTED", "detail", (25, 13, 13, 9, 7), "Brick corridor of the former penitentiary.", place="C07")

# ---- ZONA MEDIA
r("wc-76389273", "SELECTED", "landscape", (22, 15, 13, 9, 8), "Media Luna channels with reflections. Not the turquoise spring itself.", place="M01")
r("wc-2693871", "BACKUP", "landscape", (22, 10, 11, 7, 7), "Media Luna lagoon with boat (PD).", place="M01")
r("wc-43657425", "SELECTED", "hero", (25, 16, 13, 9, 8), "Rioverde parish at blue hour.", place="M02")
r("wc-43657320", "SELECTED", "landscape", (25, 14, 13, 8, 8), "Rioverde municipal palace at night.", place="M02")
r("wc-72476949", "BACKUP", "landscape", (25, 12, 13, 8, 8), "Rioverde church by day.", place="M02")
r("wc-145121025", "SELECTED", "culture", (20, 14, 9, 8, 6), "Community embroideries ('Bordados de las comunidades').", place="M02")
r("wc-21412685", "BACKUP", "editorial", (25, 10, 9, 7, 6), "Iron railway bridge, B&W.", place="M02")
r("wc-21779359", "SELECTED", "card", (25, 12, 9, 8, 6), "Parroquia de El Refugio, Ciudad Fernández (1280 px).", place="M03")
r("wc-52687925", "BACKUP", "card", (25, 9, 7, 7, 6), "Jardín de Cd. Fernández, 1024 px.", place="M03")
r("wc-52785194", "BACKUP", "card", (25, 7, 7, 6, 6), "Plaza principal, 1024 px.", place="M03")
r("wc-21780263", "BACKUP", "editorial", (22, 7, 8, 7, 6), "Zapata monument.", place="M03")
r("wc-76389275", "NEEDS_REVIEW", "editorial", (10, 13, 10, 8, 6), "'La Panadería': location not stated.")
r("wc-23888804", "REJECTED", None, (0, 3, 10, 5, 4), "Basketball player named Fernández: wrong subject.")
r("wc-57989824", "REJECTED", None, (0, 2, 9, 4, 3), "Plaque in Spain: wrong subject.")
r("wc-43619684", "SELECTED", "landscape", (25, 13, 13, 8, 8), "Arcades of the Presidencia (Casa Barraganeña) with jacaranda.", place="M10")
r("wc-72476440", "SELECTED", "vertical", (25, 12, 13, 8, 7), "Parroquia de la Purísima Concepción, vertical.", place="M11")
r("wc-72476536", "SELECTED", "hero", (25, 13, 13, 8, 8), "Iglesia del Pueblo, Ciudad del Maíz.", place="M09")
r("wc-72476489", "BACKUP", "vertical", (25, 11, 12, 7, 7), "Templo de San José.", place="M09")
r("wc-76389272", "BACKUP", "card", (25, 11, 9, 7, 6), "Church with lens flare.", place="M09")
r("wc-63333466", "BACKUP", "editorial", (20, 11, 12, 7, 7), "Cedillo family crypt (Palomas) — story material.", place="M09")
r("wc-150336646", "REJECTED", None, (22, 5, 8, 2, 1), "Banner ratio.")

r("wc-30478447", "SELECTED", "detail", (25, 15, 11, 8, 7), "Venus de Tamtoc in situ, vertical.", place="H16")
r("wc-30478452", "SELECTED", "landscape", (25, 13, 11, 8, 7), "Monument 32 under its shelter with the water channel.", place="H16")
r("wc-30479902", "BACKUP", "detail", (25, 10, 10, 7, 6), "Mural fragment.", place="H16")
r("wc-30478453", "BACKUP", "detail", (25, 8, 10, 6, 6), "Sculpture under shelter.", place="H16")

# Wirikuta / Altiplano theme: sacred site and identifiable Wixárika people -> reference only.
r("wc-98527780", "BACKUP", "culture", (22, 15, 13, 8, 7), "Milpa in Wirikuta with the sierra; identifiable farmer (needs consent before use).", place="A15")
for a in ("wc-90683299", "wc-24676885", "wc-24676572", "wc-90644073", "wc-174032402"):
    r(a, "REFERENCE_ONLY", None, (15, 10, 10, 5, 4), "Wixárika pilgrimage/people: sacred and identifiable — reference only, never decorative use.")
r("wc-866173", "REFERENCE_ONLY", None, (10, 8, 10, 6, 5), "Peyote: protected sacred plant; do not use as decoration.")
for a in ("wc-61620906", "wc-22406415", "wc-62055635"):
    r(a, "REJECTED", None, (0, 0, 0, 0, 0), "Not in San Luis Potosí (Montreal / Mexico City).")
r("wc-3364738", "NEEDS_REVIEW", "detail", (8, 12, 11, 8, 6), "Echinocactus platyacanthus, location not stated.")
# Xantolo: the results are Veracruz/Hidalgo/Guanajuato events -> not usable for SLP.
for a in ("wc-139963032", "wc-75281431", "wc-75281442", "wc-75281432", "wc-75281438", "wc-75281433", "wc-76971779",
          "wc-75281441", "wc-76971782"):
    r(a, "REJECTED", None, (0, 0, 0, 0, 0), "Xantolo in Veracruz/Hidalgo (Xalapa, Tempoal, Huejutla): not San Luis Potosí.")
r("wc-90688756", "REFERENCE_ONLY", None, (5, 15, 13, 8, 6), "Xantolo dance at the Festival Cervantino (Guanajuato): reference only.")
r("wc-128418546", "NEEDS_REVIEW", "culture", (8, 14, 10, 8, 6), "Xantolo catrina; location and model consent unknown.")

r("wc-52774850", "SELECTED", "landscape", (24, 16, 11, 9, 8), "Road to Estación Catorce across the yucca plain: classic Altiplano establishing shot.", place="A05")
r("wc-145400197", "SELECTED", "vertical", (22, 11, 11, 8, 7), "Railway tracks to the horizon (Estación Catorce area).", place="A05")
r("wc-145400195", "BACKUP", "detail", (20, 10, 11, 7, 6), "Railway water tank.", place="A05")
r("wc-145400198", "BACKUP", "editorial", (20, 9, 10, 7, 6), "Tracks with riders.", place="A05")
for a in ("wc-92115884", "wc-52908789", "wc-55621334", "wc-130638244", "wc-35803610", "wc-144086214", "wc-185343946"):
    r(a, "REJECTED", None, (0, 0, 0, 0, 0), "'Estación 14' of other places (Spain, Colombia, Argentina, Mexico City).")
r("wc-32612408", "SELECTED", "vertical", (25, 12, 10, 7, 6), "Formations inside the Grutas de la Catedral; colour lighting.", place="M14")
r("wc-32612423", "SELECTED", "detail", (25, 13, 10, 7, 6), "Stalactites, Grutas de la Catedral.", place="M14")
r("wc-32612381", "BACKUP", "landscape", (25, 8, 10, 7, 6), "Approach trail.", place="M14")
for a in ("wc-32612398", "wc-32612404", "wc-32612415"):
    r(a, "REJECTED", None, (25, 2, 8, 2, 2), "Interpretive signboards.", place="M14")
r("wc-105308560", "SELECTED", "culture", (23, 14, 13, 8, 7), "Zacahuil wrapped in leaves before baking (Huasteca dish named by the brochure).", place="H18")
for a in ("wc-89073639", "wc-6225243", "wc-104356044", "wc-87152682", "wc-104356046", "wc-148411952", "wc-148411948",
          "wc-122602111", "wc-89338852", "wc-89073646"):
    r(a, "REJECTED", None, (0, 0, 0, 0, 0), "Tamales from other regions (Oaxaca, Yucatán, USA): not Huasteca potosina.")
for a in ("wc-1467864", "wc-69358359", "wc-27643921", "wc-22083876", "wc-33648079", "wc-58557724", "wc-175421351"):
    r(a, "REJECTED", None, (0, 0, 0, 0, 0), "Search noise ('Jiji' railway, Taiwan; a map).")
r("wc-32046305", "BACKUP", "culture", (18, 14, 12, 8, 7), "Huastec life-death figure (museum object, 900–1250). Location of object not SLP-specific.", place="H16")
for a in ("wc-1385761", "wc-25529839"):
    r(a, "REFERENCE_ONLY", None, (15, 8, 6, 6, 4), "Huastec figurines in museum display; low quality.")

# ---- whole-search rejections (wrong place with the same name)
for k, why in (("A13", "Search returned other salt flats (Canary Islands, Peru, Argentina): none is Salinas de Hidalgo."),
               ("C13", "Search returned the Philippines and historic maps: none is Tierra Nueva, SLP.")):
    for c in cands.values():
        if c.get("search_key") == k and c["asset_id"] not in R:
            r(c["asset_id"], "REJECTED", None, (0, 0, 0, 0, 0), why)
for a in ("wc-37910912", "wc-89006197", "wc-141881282", "wc-6720564", "wc-47860364"):
    r(a, "REJECTED", None, (0, 0, 0, 0, 0), "Not Venado, SLP (deer species / Argentina / Mazatepec).")

# ------------------------------------------------------------------ scoring
def res_points(w, h):
    m = max(w or 0, h or 0)
    return 10 if m >= 5000 else 8 if m >= 3000 else 6 if m >= 2400 else 4 if m >= 1800 else 2 if m >= 1200 else 0

def lic_points(lic):
    l = (lic or "").lower()
    if l in ("cc0", "public domain", "no restrictions", "pexels license"):
        return 10
    if re.match(r"cc by \d", l):
        return 9
    if "by-sa" in l or l == "fal":
        return 7
    return 0

def licence_info(c):
    l = (c.get("licence") or "").lower()
    if l in ("cc0", "public domain"):
        return dict(modification_allowed=True, commercial_use_allowed=True, share_alike_required=False, attribution_legally_required=False)
    if l == "no restrictions":
        return dict(modification_allowed=True, commercial_use_allowed=True, share_alike_required=False, attribution_legally_required=False,
                    note="Flickr Commons 'No known copyright restrictions': confirm institution statement.")
    if l == "pexels license":
        return dict(modification_allowed=True, commercial_use_allowed=True, share_alike_required=False, attribution_legally_required=False,
                    note="Pexels License: no attribution required (credit given as courtesy); do not sell unaltered copies; "
                         "people in photos must not be shown as endorsing.")
    if "by-sa" in l or l == "fal":
        return dict(modification_allowed=True, commercial_use_allowed=True, share_alike_required=True, attribution_legally_required=True,
                    note="Share-alike: crops/edits must be released under the same licence; credit author and licence with a link.")
    if re.match(r"cc by \d", l):
        return dict(modification_allowed=True, commercial_use_allowed=True, share_alike_required=False, attribution_legally_required=True)
    return dict(modification_allowed=None, commercial_use_allowed=None, share_alike_required=None, attribution_legally_required=None,
                note="Licence interpretation uncertain: NEEDS_REVIEW.")

THIRD_PARTY = {"H08": "Las Pozas (Edward James) is a work of art/architecture on private property; Commons hosts it, but "
                      "commercial use of images of the sculptures may need a rights check. Filming on site needs a permit.",
               "C08": "Sculptures by Leonora Carrington (under copyright) appear in frame. Fine for academic use; check before commercial use.",
               "H16": "Archaeological monuments: commercial reproduction of images of federal monuments may require INAH authorisation. "
                      "Academic/non-commercial use is the current scope."}

def strip_author(a):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", a or "")).strip() or None

reviewed = []
for aid, d in R.items():
    c = cands.get(aid)
    if not c:
        continue
    place = d["place"] or c.get("place_id")
    acc, imp, tech, comp, adapt = d["s"]
    rp, lp = res_points(c.get("width"), c.get("height")), lic_points(c.get("licence"))
    score = acc + imp + tech + comp + rp + lp + adapt if d["status"] != "REJECTED" else min(acc + imp + tech + comp + rp + lp + adapt, 40)
    w, h = c.get("width") or 0, c.get("height") or 0
    li = licence_info(c)
    status = d["status"]
    if li["modification_allowed"] is None and status in ("SELECTED", "BACKUP"):
        status = "NEEDS_REVIEW"
    reviewed.append({
        "asset_id": aid, "place_id": place, "region": (places[place]["region"] if place in places else c.get("region")),
        "destination": places[place]["name"] if place in places else None, "subject": c["title"].removeprefix("File:"),
        "source": c["source"], "source_url": c["source_url"], "file_url": c.get("file_url"),
        "author": strip_author(c.get("author")), "licence": c.get("licence"), "licence_url": c.get("licence_url"),
        "width": w, "height": h, "orientation": "landscape" if w > h * 1.05 else "portrait" if h > w * 1.05 else "square",
        "aspect_ratio": f"{w / h:.2f}:1" if h else None,
        "role": d["role"], "status": status, "score": score,
        "score_breakdown": {"destination_accuracy": acc, "visual_impact": imp, "technical_quality": tech,
                            "composition_flexibility": comp, "resolution": rp, "licence_usability": lp, "adaptability": adapt},
        "rationale": d["note"], "visually_reviewed": True, "review_date": TODAY,
        "desktop_ok": w >= 1920 and w > h, "mobile_ok": h >= 1600 or (w >= 2400 and w > h),
        "crop_allowed": li["modification_allowed"], "third_party_rights": THIRD_PARTY.get(place),
        **{k: li[k] for k in ("share_alike_required", "commercial_use_allowed")}})

# Everything not decided above: metadata-only, not visually reviewed.
unreviewed = [c for aid, c in cands.items() if aid not in R]
for c in unreviewed:
    reviewed.append({"asset_id": c["asset_id"], "place_id": c.get("place_id"), "region": c.get("region"),
                     "destination": places[c["place_id"]]["name"] if c.get("place_id") in places else None,
                     "subject": c["title"].removeprefix("File:"), "source": c["source"], "source_url": c["source_url"],
                     "author": strip_author(c.get("author")), "licence": c.get("licence"), "width": c.get("width"),
                     "height": c.get("height"), "role": None,
                     "status": "REFERENCE_ONLY" if c.get("not_photo") else "NEEDS_REVIEW", "score": None,
                     "rationale": "Map/arms/logo, not photography." if c.get("not_photo") else "Not visually reviewed in pass 2B.",
                     "visually_reviewed": False})

by_id = {x["asset_id"]: x for x in reviewed}
reviewed.sort(key=lambda x: (x["place_id"] or "zz", -(x["score"] or 0)))
(MR / "media-reviewed.json").write_text(json.dumps({
    "generated": TODAY,
    "method": __doc__.split("Statuses:")[0].strip(),
    "statuses": ["SELECTED", "BACKUP", "NEEDS_MANUAL_ASSET", "REFERENCE_ONLY", "REJECTED", "NEEDS_REVIEW"],
    "counts": {s: sum(x["status"] == s for x in reviewed) for s in ("SELECTED", "BACKUP", "REJECTED", "NEEDS_REVIEW", "REFERENCE_ONLY")},
    "visually_reviewed": {"wikimedia": sum(x["visually_reviewed"] and x["source"] == "Wikimedia Commons" for x in reviewed),
                          "pexels": sum(x["visually_reviewed"] and x["source"] == "Pexels" for x in reviewed)},
    "assets": reviewed}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ helpers for manifests
def best(place, role=None, status=("SELECTED",)):
    xs = [x for x in reviewed if x["place_id"] == place and x["status"] in status and (role is None or x["role"] == role)]
    return max(xs, key=lambda x: x["score"]) if xs else None

def slot_from(x, slot_id, section, desktop, mobile, crop, note=None, region=None, destination=None, tier=1):
    if x is None:
        return {"slot_id": slot_id, "section": section, "region": region, "destination": destination, "asset_id": None,
                "desktop_ratio": desktop, "mobile_ratio": mobile, "recommended_crop": crop, "licence": None, "author": None,
                "attribution": None, "status": "NEEDS_MANUAL_ASSET", "tier": tier, "note": note}
    return {"slot_id": slot_id, "section": section, "region": x["region"], "destination": x["place_id"], "asset_id": x["asset_id"],
            "desktop_ratio": desktop, "mobile_ratio": mobile, "recommended_crop": crop, "licence": x["licence"],
            "author": x["author"], "attribution": attribution_text(x), "status": "SELECTED", "score": x["score"],
            "source_size": f'{x["width"]}×{x["height"]}', "tier": tier, "note": note}

def attribution_text(x):
    if x["source"] == "Pexels":
        return f'Foto: {x["author"]} / Pexels'
    lic = x["licence"] or "?"
    return f'Foto: {x["author"] or "autor en Wikimedia Commons"} · {lic} · vía Wikimedia Commons'

A = lambda aid: by_id.get(aid)

# ------------------------------------------------------------------ region signature assets
REGION_SIG = {
    "altiplano": dict(
        hero_desktop=(A("wc-69780780"), "Real de Catorce in its valley. Strong, but daylight/overcast: the planned dawn layered hero still needs a commissioned shoot."),
        hero_mobile=(None, "No vertical premium Altiplano image."),
        card=(A("wc-69780780"), None), landscape=(A("wc-42373253"), "Yucca desert"),
        culture=(None, "No usable Altiplano culture/people image (Wixárika subjects need consent and context)."),
        detail=(A("wc-145400200"), "Barrel cactus texture"), video="vid-transition-altiplano"),
    "centro": dict(
        hero_desktop=(A("wc-21525423"), "Cathedral & Plaza de Armas; daylight. A blue-hour version would be stronger."),
        hero_mobile=(A("wc-81112902"), "Templo del Carmen vertical (9162 px)."),
        card=(A("wc-77789645"), None), landscape=(A("wc-50604767"), "Cerro de San Pedro"),
        culture=(A("wc-58139975"), "Rebozo (Santa María del Río)"), detail=(A("wc-75414140"), "Baroque frieze, Templo del Carmen"),
        video="vid-transition-centro"),
    "zona-media": dict(
        hero_desktop=(None, "Media Luna turquoise spring (aerial or underwater) is missing; current images do not show it."),
        hero_mobile=(None, "Missing."), card=(A("wc-43657425"), "Rioverde parish at blue hour"),
        landscape=(A("wc-76389273"), "Media Luna channels"), culture=(A("wc-145121025"), "Community embroideries"),
        detail=(A("wc-43619684"), "Arcades, Ciudad del Maíz"), video="vid-transition-media"),
    "huasteca": dict(
        hero_desktop=(A("wc-48806929"), "Tamul from the river (1920 px: acceptable for 1920 hero, not 4K)."),
        hero_mobile=(A("px-14842050"), "Tamul long exposure, vertical (Pexels)."),
        card=(A("wc-29767255"), "Las Pozas"), landscape=(A("wc-45072511"), "Tampaón canyon"),
        culture=(A("wc-128308393"), "Huehue mask, Xilitla"), detail=(A("wc-48806880"), "Aerial over the lip of Tamul"),
        video="vid-transition-huasteca"),
}
region_out = {}
for reg, d in REGION_SIG.items():
    slots = {}
    for k in ("hero_desktop", "hero_mobile", "card", "landscape", "culture", "detail"):
        x, note = d[k]
        slots[k] = {"asset_id": x["asset_id"] if x else None, "status": "SELECTED" if x else "NEEDS_MANUAL_ASSET",
                    "score": x["score"] if x else None, "note": note}
    slots["video"] = {"video_slot": d["video"], "status": "see video-manifest.json"}
    region_out[reg] = slots

# ------------------------------------------------------------------ home manifest
H = []
def add(*a, **k):
    H.append(slot_from(*a, **k))
add(None, "home-01-hero", "01 HERO", "21:9 / 16:9 (layered planes)", "9:16 (separate composition)",
    "Layered plates: sky/sierra, plain, focal ruin, foreground agaves, haze", region="altiplano", destination="A15", tier=1,
    note="No free image provides separable layers. Commission or license a dawn Altiplano plate set (see manual-assets-needed.md). "
         "Fallback for MVP: wc-69780780 as a single plane with the existing SVG planes.")
add(A("wc-69780780"), "home-01-hero-fallback", "01 HERO (fallback still)", "16:9", "4:5 crop on the church", "Keep the valley floor and ridge; crop sky ~15 %", tier=1)
add(A("wc-42373253"), "home-02-intro", "02 INTRODUCTION", "3:2", "4:5", "Centre on the yucca cluster", tier=2)
for reg, aid, crop in (("altiplano", "wc-69780780", "4:5 on the parish dome"), ("centro", "wc-77789645", "4:5 on the façade"),
                       ("zona-media", "wc-43657425", "4:5 on the tower"), ("huasteca", "wc-29767255", "4:5 on the dome window")):
    add(A(aid), f"home-03-region-{reg}", "03 FOUR REGIONS", "4:5", "4:5", crop, tier=1)
for i, (aid, crop) in enumerate((("wc-48806929", "4:5 centred on the falls"), ("wc-29767255", "4:5"),
                                  ("wc-69780780", "4:5 on the town"), ("wc-60066386", "4:5 on the plaza"),
                                  ("wc-98007105", "4:5 on the double fall"), ("wc-81112902", "already vertical"),
                                  ("wc-45072628", "4:5 on the fall"), ("wc-50604767", "4:5 on the buildings")), 1):
    add(A(aid), f"home-04-must-see-{i}", "04 DESTINOS IMPERDIBLES", "4:5", "4:5", crop, tier=1)
for reg in ("altiplano", "centro", "zona-media", "huasteca"):
    H.append({"slot_id": f"home-05-descent-{reg}", "section": "05 THE DESCENT", "region": reg, "destination": None,
              "asset_id": region_out[reg]["landscape"]["asset_id"], "desktop_ratio": "16:9 (lower half under the line)",
              "mobile_ratio": "9:16", "recommended_crop": "Ground plane only; sky replaced by the region colour field",
              "licence": None, "author": None, "attribution": None, "tier": 1,
              "status": "SELECTED" if region_out[reg]["landscape"]["asset_id"] else "NEEDS_MANUAL_ASSET",
              "note": "Fill under the terrain line; see video-manifest for the transition clips."})
for i, (tag, aid) in enumerate((("agua", "wc-45072628"), ("cultura-viva", "wc-128308393"), ("arquitectura", "wc-75414140"),
                                 ("aventura", "wc-2008166"), ("arte", "wc-79606411"), ("artesania", "wc-58139971"),
                                 ("arqueologia", "wc-60066386"), ("desierto", "wc-145400200")), 1):
    add(A(aid), f"home-06-interest-{tag}", "06 EXPLORA POR INTERÉS", "1:1", "1:1", f"Square tile for '{tag}'", tier=2)
add(A("wc-98007106"), "home-07-now", "07 QUÉ HACER AHORA", "3:2", "4:5", "Season card (Nov–Mar: Huasteca waterfalls)", tier=2)
add(None, "home-08-map-thumbs", "08 MAPLIBRE PANEL", "1:1 thumbnails", "1:1", "One per mapped destination",
    note="Generated from destination-asset-manifest.json (best card per place). See coverage there.", tier=1)
for i, aid in enumerate(("wc-45072553", "wc-119874435", "wc-50604761"), 1):
    add(A(aid), f"home-09-itinerary-{i}", "09 RUTAS E ITINERARIOS", "3:2", "4:5", "Journey/POV framing", tier=1)
add(None, "home-10-guides", "10 GUÍAS Y RECURSOS", "4:5", "4:5", "Portrait of a certified guide at work (with release)",
    note="Must be a consented portrait; cannot come from Commons/Pexels.", tier=2)
for i, aid in enumerate(("px-11775031", "wc-2005486", "wc-58139975"), 1):
    add(A(aid), f"home-11-experience-{i}", "11 EXPERIENCIAS", "4:5", "4:5", "Experience card", tier=2)
for i, aid in enumerate(("wc-128308393", "wc-63333466"), 1):
    add(A(aid), f"home-12-story-{i}", "12 HISTORIAS", "3:2", "4:5", "Story lead image", tier=3)
add(A("wc-21525423"), "home-13-plan", "13 PLANEA TU VIAJE", "16:9", "4:5", "Calm background, low contrast for text", tier=2)
add(A("wc-48806880"), "home-14-close", "14 CINEMATIC CLOSE", "21:9", "9:16 (use px-14842050)", "Mist over the lip of Tamul",
    note="Still fallback; final close is a video (vid-close).", tier=1)

def coverage(slots):
    t1 = [s for s in slots if s["tier"] == 1]
    ok = [s for s in t1 if s["status"] == "SELECTED"]
    return {"tier1_slots": len(t1), "tier1_filled": len(ok), "tier1_coverage_pct": round(100 * len(ok) / len(t1)) if t1 else None,
            "all_slots": len(slots), "all_filled": sum(s["status"] == "SELECTED" for s in slots),
            "all_coverage_pct": round(100 * sum(s["status"] == "SELECTED" for s in slots) / len(slots))}
(MR / "home-asset-manifest.json").write_text(json.dumps({
    "generated": TODAY, "region_signature_assets": region_out, "coverage": coverage(H), "slots": H}, ensure_ascii=False, indent=1) + "\n",
    encoding="utf-8")

# ------------------------------------------------------------------ Huasteca manifest
HU = []
def hadd(*a, **k):
    HU.append(slot_from(*a, **k))
hadd(A("wc-48806929"), "hua-hero-desktop", "Hero", "21:9 / 16:9", "—", "Falls on the right third; water as base", tier=1,
     note="Final hero should be the Tamul/Las Pozas video (vid-huasteca-hero).")
hadd(A("px-14842050"), "hua-hero-mobile", "Hero (mobile)", "—", "9:16", "Native vertical", tier=1)
hadd(A("wc-45072511"), "hua-intro", "Emotional intro", "16:9", "4:5", "Canyon with pangas", tier=1)
for i, aid in enumerate(("wc-45072553", "wc-29767259", "wc-98007105", "wc-128308393"), 1):
    hadd(A(aid), f"hua-reason-{i}", "Reasons to visit", "4:5", "4:5", "Card", tier=2)
hadd(A("wc-48806880"), "hua-tamul-1", "Tamul", "16:9", "9:16 (px-14842050)", "Aerial over the lip", tier=1)
hadd(A("px-11775031"), "hua-tamul-2", "Tamul", "4:5", "9:16", "Panga approaching", tier=1)
hadd(A("wc-29767255"), "hua-xilitla-1", "Xilitla / Las Pozas", "16:9", "4:5", "Dome and windows", tier=1)
hadd(A("wc-29767259"), "hua-xilitla-2", "Xilitla / Las Pozas", "4:5", "9:16", "Water under arches", tier=1)
hadd(A("wc-112989200"), "hua-xilitla-3", "Xilitla / Las Pozas", "16:9", "4:5", "Mountains (town in mist still missing)", tier=2)
hadd(None, "hua-tamasopo-hero", "Tamasopo", "16:9", "4:5", "Cascadas de Tamasopo wide, high-res", tier=1,
     note="Only 1280 px images exist (wc-6172324 used for cards).", region="huasteca", destination="H10")
hadd(A("wc-6172324"), "hua-tamasopo-card", "Tamasopo", "4:5", "4:5", "Card only (1280 px)", tier=1)
hadd(A("wc-93308060"), "hua-meco", "El Meco / El Salto", "16:9", "4:5", "Stepped cascades", tier=2)
hadd(None, "hua-salto", "El Meco / El Salto", "16:9", "4:5", "El Salto in season (70 m drop)", tier=3,
     note="No usable El Salto image; seasonal waterfall.", region="huasteca", destination="H15")
hadd(A("wc-45072628"), "hua-puente-dios-1", "Puente de Dios", "16:9", "4:5", "Fall into pool", tier=1)
hadd(A("wc-89848894"), "hua-puente-dios-2", "Puente de Dios", "4:5", "9:16", "Vertical", tier=1)
hadd(A("wc-128308393"), "hua-culture-1", "Culture", "4:5", "4:5", "Huehue mask", tier=1)
hadd(None, "hua-teenek", "Teenek", "4:5", "4:5", "Teenek community portrait/craft (with consent)", tier=2,
     note="No consented Teenek imagery found; do not use unverified ethnographic photos.", region="huasteca")
hadd(None, "hua-xantolo", "Culture (Xantolo)", "16:9", "4:5", "Xantolo altar / comparsa (with permission)", tier=2,
     note="See theme review; ceremonial imagery needs permission.", region="huasteca", destination="H18")
hadd(None, "hua-gastronomy", "Gastronomy", "1:1", "4:5", "Zacahuil, bocoles, enchiladas huastecas", tier=2,
     note="No free high-quality Huasteca food photography found.", region="huasteca")
hadd(A("wc-45072553"), "hua-itinerary-1", "Itineraries", "3:2", "4:5", "POV journey", tier=1)
hadd(A("wc-98005525"), "hua-itinerary-2", "Itineraries", "3:2", "4:5", "Micos stop", tier=2)
hadd(A("wc-60066386"), "hua-itinerary-3", "Itineraries", "3:2", "4:5", "Tamtoc stop", tier=2)
HU.append({"slot_id": "hua-map", "section": "Map", "region": "huasteca", "destination": None, "asset_id": None,
           "desktop_ratio": "map", "mobile_ratio": "map", "recommended_crop": None, "licence": None, "author": None,
           "attribution": None, "status": "DATA", "tier": 1, "note": "MapLibre layer from generated/maplibre-places.geojson; thumbnails per destination manifest."})
hadd(A("wc-2005486"), "hua-planning", "Practical planning", "16:9", "4:5", "Calm, low-contrast area for text", tier=2)
hadd(A("wc-66633932"), "hua-story-1", "Stories", "3:2", "4:5", "Hoya de las Huahuas", tier=3)
hadd(A("wc-48806880"), "hua-close", "Cinematic close", "21:9", "9:16", "Mist over Tamul (still fallback for vid-close)", tier=1)
(MR / "huasteca-asset-manifest.json").write_text(json.dumps({"generated": TODAY, "coverage": coverage(HU), "slots": HU},
                                                            ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ destination manifest
dests = {}
coords = json.loads((ROOT / "generated/coordinates.json").read_text(encoding="utf-8"))["places"]
seasonal = json.loads((ROOT / "generated/seasonal-calendar.json").read_text(encoding="utf-8"))["records"]
for pid, p in places.items():
    def pick(*roles):
        for role in roles:
            x = best(pid, role)
            if x:
                return x["asset_id"]
        return None
    hero = pick("hero", "landscape")
    vertical = pick("vertical")
    card = pick("card", "hero", "landscape", "vertical", "detail")
    slots = {
        "hero_desktop": hero, "hero_mobile": vertical,
        "gallery_landscape": [x["asset_id"] for x in reviewed if x["place_id"] == pid and x["status"] in ("SELECTED", "BACKUP")
                              and x["orientation"] == "landscape" and x["asset_id"] != hero][:6],
        "gallery_vertical": [x["asset_id"] for x in reviewed if x["place_id"] == pid and x["status"] in ("SELECTED", "BACKUP")
                             and x["orientation"] == "portrait" and x["asset_id"] != vertical][:4],
        "detail": pick("detail", "culture"),
        "card": card,
        "map_preview": {"type": "generated", "from": "maplibre-places.geojson",
                        "status": coords[pid].get("map_status") or "not-a-point"},
        "seasonal": [s["record_id"] for s in seasonal if pid in (s["destination"] or "").split("|")],
        "experience": pick("experience", "editorial"),
        "nearby_destination": None,
    }
    filled = sum(bool(slots[k]) for k in ("hero_desktop", "hero_mobile", "detail", "card"))
    dests[pid] = {"place_id": pid, "name": p["name"], "region": p["region"], "priority": p["priority"], "slots": slots,
                  "core_filled": f"{filled}/4 (hero, mobile, detail, card)",
                  "status": "READY" if filled == 4 else "PARTIAL" if filled else "NEEDS_MANUAL_ASSET"}
# nearby: closest mapped neighbour by straight line
import math
def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    return 2 * 6371 * math.asin(math.sqrt(math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2))
pts = {k: (v["latitude"], v["longitude"]) for k, v in coords.items() if v.get("latitude") is not None}
for pid in dests:
    if pid in pts:
        near = sorted(((hav(pts[pid], pts[q]), q) for q in pts if q != pid and hav(pts[pid], pts[q]) > 0.3))[:2]
        dests[pid]["slots"]["nearby_destination"] = [{"place_id": q, "straight_line_km": round(d, 1)} for d, q in near]
(MR / "destination-asset-manifest.json").write_text(json.dumps({
    "generated": TODAY, "route": "/destinos/[slug]",
    "model": {"hero_desktop": "16:9 / 21:9, ≥1920 px wide", "hero_mobile": "9:16 or 4:5 native vertical",
              "gallery_landscape": "3:2", "gallery_vertical": "4:5", "detail": "1:1 or 4:5", "card": "4:5",
              "map_preview": "generated from MapLibre data", "seasonal": "seasonal-calendar record ids",
              "experience": "image of an activity", "nearby_destination": "two nearest mapped places (straight line, not road)"},
    "counts": {s: sum(d["status"] == s for d in dests.values()) for s in ("READY", "PARTIAL", "NEEDS_MANUAL_ASSET")},
    "destinations": dests}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

# ------------------------------------------------------------------ attributions (every SELECTED asset)
attr = []
for x in reviewed:
    if x["status"] != "SELECTED":
        continue
    c = cands[x["asset_id"]]
    li = licence_info(c)
    attr.append({"asset_id": x["asset_id"], "author": x["author"], "source": x["source"], "source_url": x["source_url"],
                 "licence": x["licence"], "licence_url": c.get("licence_url"), "attribution_text": attribution_text(x),
                 "modification_allowed": li["modification_allowed"], "commercial_use_allowed": li["commercial_use_allowed"],
                 "share_alike_required": li["share_alike_required"], "attribution_legally_required": li["attribution_legally_required"],
                 "third_party_rights": x.get("third_party_rights"),
                 "notes": " ".join(filter(None, [li.get("note"), "Author credit as given on the file page." if x["source"] != "Pexels" else None])),
                 "status": "OK" if li["modification_allowed"] is not None else "NEEDS_REVIEW"})
(MR / "attributions.json").write_text(json.dumps({"generated": TODAY, "count": len(attr),
                                                  "rules": ["CC BY-SA: credit + licence link; edited versions stay CC BY-SA.",
                                                            "CC BY-NC / NC-ND: never promoted to production use (none selected).",
                                                            "Pexels: credit given as courtesy; licence does not require it."],
                                                  "attributions": attr}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

print("reviewed", sum(x["visually_reviewed"] for x in reviewed), "| statuses",
      {s: sum(x["status"] == s for x in reviewed) for s in ("SELECTED", "BACKUP", "REJECTED", "NEEDS_REVIEW", "REFERENCE_ONLY")})
print("home", coverage(H)); print("huasteca", coverage(HU))
print("destinations", {s: sum(d["status"] == s for d in dests.values()) for s in ("READY", "PARTIAL", "NEEDS_MANUAL_ASSET")})
print("attributions", len(attr))
