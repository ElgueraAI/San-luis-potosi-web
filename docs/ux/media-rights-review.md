# Misión 04A · revisión de medios y derechos

Fecha: 2026-11-07 (America/Mexico_City). Alcance: lectura de registros existentes y reutilización local; no se incorporó metraje ni se autoriza publicación.

## Diferencia 85 / 89

Se compararon los IDs de `research/media-registry/attributions.json` (85) con `src/data/generated/media.json` (89). Los cuatro adicionales coinciden exactamente con `research/media-registry/additions-pass4.json`. El proceso `scripts/media/build-media.mjs` fusiona los registros `additions-*.json`, construye sus atribuciones y conserva los registros generales. No son cuatro fotografías sin crédito: `creditos.astro` lee el catálogo de producción y muestra las 89, con autor, fuente, licencia enlazada y declaración de derivados.

| ID / asunto | Autor registrado | Fuente y licencia declaradas | Dictamen documental y pendientes |
|---|---|---|---|
| `wc-43676810` · San Juan Bautista, Cerritos | Antonio de Jesús Pérez Cruz | [Commons](https://commons.wikimedia.org/wiki/File:San_Juan_Bautista_Cerritos.jpg) · CC BY-SA 4.0 | Registro SELECTED, revisión visual fechada 2026-10-06, atribución y WebP presentes; compartir derivados con misma licencia. No hay reserva de terceros declarada; esto no acredita ausencia de otros derechos. |
| `wc-198070643` · Entrada FENAPO | EnchiladasyZacahuil | [Commons](https://commons.wikimedia.org/wiki/File:Entrada_Feria_Nacional_Potosina..jpg) · CC BY-SA 4.0 | Autor/crédito completos. Se declara señalética de feria visible; revisar marcas y uso promocional antes de publicación. Registro de revisión 2026-10-06; formato vertical de 1200 px de ancho. |
| `wc-44351463` · textiles de Tancanhuitz | AlejandroLinaresGarcia | [Commons](https://commons.wikimedia.org/wiki/File:ExpoIndigenous2015_042.JPG) · CC BY-SA 4.0 | Crédito fotográfico completo. La ficha limita el uso a editorial por diseños tradicionales; `commercial_use_allowed: true` no resuelve esos derechos. No promover como activo comercial autorizado. La toma es de una exposición en Ciudad de México (2015), no de la fiesta patronal de Tancanhuitz; conservar ese contexto. |
| `wc-36732336` · Xantolo 16 | Elenats.93 | [Commons](https://commons.wikimedia.org/wiki/File:Xantolo_16.JPG) · CC BY-SA 4.0 | Registro SELECTED, atribución y derivado presentes; revisión 2026-10-06. El registro describe altar de 2014, sin personas. No demuestra vigencia de un evento actual. |

Los campos autor, fuente, URL, licencia, share-alike y reservas coinciden entre el registro aditivo y producción. Se comprobó trazabilidad documental, no titularidad legal mediante una nueva investigación. No se reescribió el registro de 85 ni se regeneraron imágenes desde raw. La página de créditos ahora explicita también las reservas individuales existentes para evitar que la nota general oculte textiles o señalética.

## Fotografías del hero

| Región / lugar | ID | Autor registrado | Licencia |
|---|---|---|---|
| Altiplano · Real de Catorce | `wc-69780780` | Rafael Saldaña | CC BY 2.0 |
| Centro · Loreto y Plaza de los Fundadores | `wc-63495269` | ProtoplasmaKid | CC BY-SA 4.0 |
| Zona Media · Media Luna | `wc-76389273` | Uriel Del Toro | CC BY-SA 4.0 |
| Huasteca · Cascada de Tamul | `wc-48806929` | Mauro Trejo | CC BY-SA 4.0 |

Se reutilizan WebP locales documentados. El hero enlaza cada fuente original, autor y licencia, e indica conversión/redimensionado/encuadre. Los originales no se presentan como fotografías producidas por el proyecto. Las obligaciones oficiales de [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) y [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) fueron consultadas: crédito, enlace a licencia, señalar modificaciones y, para adaptaciones SA, mantener licencia compatible con ShareAlike. La licencia fotográfica no garantiza derechos de imagen, marcas, acceso o filmación. No se crean composiciones generativas ni nuevos recursos ajenos.

## Cuatro clips que faltan

Todos permanecen **SIN_DATOS / SIN_ARCHIVO_AUTORIZADO**. La arquitectura preparada no acredita una entrega audiovisual terminada.

| Región | Toma requerida | Entrega necesaria |
|---|---|---|
| Altiplano | Real de Catorce, panorama y patrimonio entre la sierra | Plano estable, luz natural; sin personas identificables sin autorización |
| Centro | Patrimonio histórico de San Luis Potosí; Loreto/Plaza de los Fundadores | Plano estable de arquitectura; revisar derechos de obras, señalética y permisos de filmación |
| Zona Media | Manantial y canal de Media Luna | Agua y vegetación; permisos de acceso/filmación y protección del entorno |
| Huasteca | Cascada de Tamul desde un punto de acceso autorizado | Caída y cañón; sin maniobras de riesgo ni falsa garantía de nivel de agua |

Para cada clip: MP4/H.264 y WebM cuando exista codificación autorizada; loop sugerido 8–12 segundos, sin audio, poster autorizado, composición horizontal y vertical específica, zonas seguras para título/crédito. Registrar autor, URL/origen, fecha, licencia, autorización para adaptación/uso, permisos de terceros, dimensiones y peso. Revisar licencias antes de codificar derivados o publicar. No descargar referencias de YouTube/Vimeo/AirVuz; el manifiesto histórico de videos contiene slots pendientes, no metraje disponible.

## Verificación repetible sin raw

Comparar claves de `media.assets` contra `attributions[].asset_id`, resolver diferencia en `additions-pass4.assets`, cotejar metadatos y existencia de `src/assets/media/<id>.webp`, comprobar los anclajes `creditos/#<id>` en el build y ejecutar el verificador de enlaces. No ejecutar `media:build`: requiere originales/raw y no es necesario para reutilizar derivados existentes.
