"""Video slots for the MVP and the reference clips from the workbook shotlist (05_VIDEO_SHOTLIST).

Nothing is downloaded. YouTube / Vimeo / AirVuz clips stay REFERENCE_ONLY (no reuse rights).
The two Pexels clips in the shotlist are listed as licence-check candidates (Pexels License), not yet reviewed.
Output: research/media-registry/video-manifest.json
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REFS = {  # from the workbook shotlist (verbatim URLs and timestamps)
    "ref-rc-airvuz-exploring": dict(region="altiplano", destination="A01", source="AirVuz / Postandfly",
        title="Exploring Mexico 6", url="https://www.airvuz.com/video/Exploring-Mexico-6-?id=5c7d85be2278dc2e53a68d71",
        timestamp="01:15–01:30", confirmed=True, capture="Panorámica aérea del pueblo y sierra"),
    "ref-rc-airvuz-real": dict(region="altiplano", destination="A01", source="AirVuz / Postandfly", title="REAL DE CATORCE",
        url="https://www.airvuz.com/video/REAL-DE-CATORCE?id=5b9fcae597ae20374f778988", timestamp="00:00–03:28", confirmed=True,
        capture="Aéreos, calles, iglesia, sierra"),
    "ref-rc-yt-solis": dict(region="altiplano", destination="A01", source="YouTube / Joel Solis",
        title="Real de Catorce, San Luis Potosí - Mexico | A Magical Town in 4K", url="https://www.youtube.com/watch?v=xBLoaudNQUI",
        timestamp=None, confirmed=False, capture="Iglesia, Túnel Ogarrio, Cerro del Quemado, pueblo"),
    "ref-slp-pexels-aerial": dict(region="centro", destination="C01", source="Pexels", title="Vista Aérea De San Luis Potosí, México",
        url="https://www.pexels.com/es-es/video/vista-aerea-de-san-luis-potosi-mexico-34597317/", timestamp="00:00–00:50",
        confirmed=True, capture="Arquitectura histórica y paisaje urbano (clip vertical)", licence="Pexels License (to verify on the clip page)"),
    "ref-slp-pexels-cathedral": dict(region="centro", destination="C02", source="Pexels",
        title="Drone view of historic cathedral in Mexico",
        url="https://www.pexels.com/video/la-catedral-basilica-menor-de-la-inmaculada-concepcion-17673280/", timestamp=None,
        confirmed=False, capture="Catedral, plaza, arquitectura", licence="Pexels License (to verify; title suggests a Matehuala/other cathedral — check location)"),
    "ref-csp-yt": dict(region="centro", destination="C10", source="YouTube / Droner San-luis",
        title="CERRO DE SAN PEDRO / SAN LUIS POTOSI / MÉXICO", url="https://www.youtube.com/watch?v=3su7hkyV4dU", timestamp=None,
        confirmed=False, capture="Pueblo, cerro, calles y tomas aéreas"),
    "ref-rioverde-yt": dict(region="zona-media", destination="M02", source="YouTube / Alejandro Reynaga",
        title="Centro de Ríoverde SLP | DJI Mavic", url="https://www.youtube.com/watch?v=IqX7p4f3P58", timestamp=None,
        confirmed=False, capture="Centro urbano y panorama de Rioverde"),
    "ref-medialuna-vimeo": dict(region="zona-media", destination="M01", source="Vimeo", title="La Media Luna – Buceo",
        url="https://vimeo.com/117912061", timestamp="00:00–FIN", confirmed=True, capture="Tomas subacuáticas, peces y claridad del agua"),
    "ref-tamul-yt": dict(region="huasteca", destination="H01", source="YouTube / Trip Insight",
        title="Wonders of Mexico | The Hidden Places No One Talks About! | Travel Video 4K",
        url="https://www.youtube.com/watch?v=zqu3cbgbmzI", timestamp="01:56–04:00", confirmed=True, capture="Tamul y contexto natural"),
    "ref-huasteca-yt": dict(region="huasteca", destination=None, source="YouTube / Trip Insight", title="(same video, chapter)",
        url="https://www.youtube.com/watch?v=zqu3cbgbmzI", timestamp="14:50–17:06", confirmed=True, capture="Planos generales de la Huasteca"),
    "ref-meco-yt": dict(region="huasteca", destination="H14", source="YouTube / Trip Insight", title="(same video, chapter)",
        url="https://www.youtube.com/watch?v=zqu3cbgbmzI", timestamp="17:07–18:49", confirmed=True, capture="Cascada El Meco"),
    "ref-huasteca-helivant": dict(region="huasteca", destination=None, source="YouTube / Helivant Aerial Filming",
        title="El mejor video de la Huasteca Potosina", url="https://www.youtube.com/watch?v=jMcLNCyQ-LA", timestamp=None,
        confirmed=False, capture="Tamul, Puente de Dios, Tamasopo, Sótano de las Golondrinas"),
}
for k, r in REFS.items():
    r["usage_status"] = "LICENCE_CHECK_CANDIDATE" if r["source"] == "Pexels" else "REFERENCE_ONLY"
    r["usage_note"] = ("Pexels License allows free use; confirm clip page, location and that no identifiable people "
                       "need releases before downloading." if r["source"] == "Pexels"
                       else "Storyboard/reference only. A screenshot or excerpt does not become free to use.")

SLOTS = [
    dict(slot_id="vid-home-hero", section="01 HERO", region="altiplano", destination="A15",
         shot="Amanecer en el Altiplano: horizonte de sierra (Sierra de Catorce) con yucas/agaves en primer plano; luz rasante.",
         movement="Locked-off or very slow lateral slide (≤5 % frame width); no zoom. Must loop seamlessly.",
         duration="8–12 s loop", desktop="16:9 (also 21:9 safe area)", mobile="9:16 (separate vertical shot, not a crop)",
         lighting="Pre-dawn blue hour → first sun", references=["ref-rc-airvuz-real", "ref-rc-airvuz-exploring"],
         layers="Plate for parallax: deliver background (sky+sierra) and foreground (plants) as separate passes if possible.",
         tier=1, status="NEEDS_MANUAL_ASSET"),
    dict(slot_id="vid-transition-altiplano", section="05 THE DESCENT", region="altiplano", destination="A01",
         shot="Aerial pull-back from Real de Catorce rooftops revealing the sierra and desert plain beyond.",
         movement="Single continuous backward/upward drone move", duration="6–8 s", desktop="16:9", mobile="9:16",
         lighting="Golden hour, low sun from west", references=["ref-rc-airvuz-exploring"], tier=2, status="NEEDS_MANUAL_ASSET"),
    dict(slot_id="vid-transition-centro", section="05 THE DESCENT", region="centro", destination="C01",
         shot="Blue-hour aerial glide over the Centro Histórico (cathedral towers, cantera rooftops) as lights switch on.",
         movement="Slow forward glide, constant altitude", duration="6–8 s", desktop="16:9", mobile="9:16",
         lighting="Blue hour", references=["ref-slp-pexels-aerial"], tier=2, status="LICENCE_CHECK_CANDIDATE",
         note="The Pexels SLP aerial (vertical) may cover the mobile version once licence and location are confirmed."),
    dict(slot_id="vid-transition-media", section="05 THE DESCENT", region="zona-media", destination="M01",
         shot="Top-down drone over the Media Luna spring: turquoise water against green reeds, swimmers small in frame.",
         movement="Slow vertical descent or slow rotation over the spring", duration="6–8 s", desktop="16:9", mobile="9:16",
         lighting="Late morning, high sun for water colour", references=["ref-medialuna-vimeo"], tier=2, status="NEEDS_MANUAL_ASSET"),
    dict(slot_id="vid-transition-huasteca", section="05 THE DESCENT", region="huasteca", destination="H01",
         shot="Drone descending through the Tamul canyon toward the waterfall (the 'drop' of The Descent).",
         movement="Single continuous forward + downward motion, no cuts", duration="8–15 s", desktop="16:9", mobile="9:16",
         lighting="Late afternoon, soft haze; turquoise water (Nov–Mar per official season)",
         references=["ref-tamul-yt", "ref-huasteca-helivant"], tier=1, status="NEEDS_MANUAL_ASSET",
         note="This clip is the existing 'huasteca-drop-video' slot. The engine scrubs it: encode with a dense GOP."),
    dict(slot_id="vid-tamul-descent", section="Huasteca page / Tamul", region="huasteca", destination="H01",
         shot="Panga upstream on the Tampaón to the foot of Tamul (eye-level, water texture), then reveal of the falls.",
         movement="Gimbal forward from the boat", duration="10–15 s", desktop="16:9", mobile="9:16", lighting="Morning",
         references=["ref-tamul-yt"], tier=2, status="NEEDS_MANUAL_ASSET"),
    dict(slot_id="vid-huasteca-hero", section="Huasteca page / Hero", region="huasteca", destination="H08",
         shot="Las Pozas in mist: slow push through jungle toward a concrete stair/arch structure, waterfall pool in frame.",
         movement="Slow forward gimbal push", duration="8–12 s loop", desktop="16:9 / 21:9", mobile="9:16", lighting="Overcast morning with mist",
         references=["ref-huasteca-helivant"], tier=1, status="NEEDS_MANUAL_ASSET",
         note="Las Pozas requires a filming permit ('Permiso para toma de imagen y video', laspozasxilitla.org.mx)."),
    dict(slot_id="vid-close", section="14 CINEMATIC CLOSE", region="huasteca", destination="H01",
         shot="Wide, still: turquoise river at dusk with canyon walls — the end of the line.",
         movement="Locked-off, imperceptible push", duration="8–10 s loop", desktop="21:9", mobile="9:16", lighting="Dusk",
         references=["ref-huasteca-yt"], tier=1, status="NEEDS_MANUAL_ASSET",
         note="A high-quality still from the selected image set can stand in for the MVP (see home-asset-manifest)."),
]
(ROOT / "media-registry" / "video-manifest.json").write_text(json.dumps({
    "generated": "2026-10-05",
    "rules": ["Do not download YouTube, Vimeo or AirVuz videos; they are references only.",
              "Encode scrubbed clips with a dense GOP (keyframe every ~4–8 frames) and a separate mobile encode.",
              "Original masters stay outside Git (media-source/)."],
    "slots": SLOTS, "references": REFS,
    "counts": {"slots": len(SLOTS), "needs_manual": sum(s["status"] == "NEEDS_MANUAL_ASSET" for s in SLOTS),
               "references": len(REFS)}}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(len(SLOTS), "slots;", sum(s["status"] == "NEEDS_MANUAL_ASSET" for s in SLOTS), "need manual assets")
