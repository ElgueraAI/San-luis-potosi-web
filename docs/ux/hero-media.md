# Hero regional · fotografías y clips pendientes

La portada implementa una presentación de fotografías reales, sin imitar metraje. El título de marca permanece. `src/data/heroRegions.ts` contiene las cuatro fichas y cuatro slots de video explícitamente nulos. No se introdujeron videos, descargas ni autores o licencias nuevos.

| Región | Recurso local | Lugar y autor | Licencia del registro |
|---|---|---|---|
| Altiplano | `wc-69780780` | Real de Catorce · Rafael Saldaña | CC BY 2.0 |
| Centro | `wc-63495269` | Templo de Loreto, Plaza Fundadores · ProtoplasmaKid | CC BY-SA 4.0 |
| Zona Media | `wc-76389273` | Manantial de la Media Luna · Uriel Del Toro | CC BY-SA 4.0 |
| Huasteca | `wc-48806929` | Cascada de Tamul · Mauro Trejo | CC BY-SA 4.0 |

Se inspeccionaron las cuatro fotografías locales. Los originales y metadatos se enlazan desde el crédito de cada región usando `source_url`, `licence_url`, `subject` y `author` del catálogo existente. No se afirma que todos los archivos locales sean originales de cámara: el catálogo identifica derivados y rendiciones. Se informa conversión WebP, redimensionado y encuadre. La adaptación de cada foto BY-SA conserva su licencia; esto no atribuye esa licencia a toda la aplicación.

Se consultaron los términos oficiales [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) y [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/): crédito, vínculo de licencia, indicación de cambios y, en BY-SA, compartir las contribuciones al recurso adaptado bajo la misma licencia. Es una revisión de obligaciones y registros locales, no una nueva certificación de titularidad ni autorización de publicación. Derechos adicionales y revisión previa a publicar se detallan en `media-rights-review.md`.

## Funcionamiento

- La primera fotografía es HTML inmediato y conserva el srcset del preload actual. Las otras tres se alojan en `template` y se montan sólo al seleccionar o rotar a esa región. No se aplica zoom ni falso movimiento de cámara.
- M04A.2 sustituye la presentación temporizada de M04A: las fotografías sólo cambian por selección manual. No hay carrusel automático. Los controles de pausa, progreso y reintento se muestran cuando existe video; segundo plano y salida del viewport suspenden la reproducción. Se conserva el poster ante cualquier error.
- Movimiento reducido, tier de recursos limitado y Save-Data permiten selección manual y bloquean autoplay. La preferencia reducida se vuelve a consultar si cambia durante la sesión. Sin JavaScript se conserva fotografía y ficha de Altiplano, además de enlaces a las cuatro regiones.
- El video futuro requiere `rightsReviewed: true`, metadatos de crédito y fuentes MP4 y/o WebM locales. El componente ofrece `autoplay`, `muted`, `loop`, `playsinline`, poster y capa fotográfica. Las fuentes usan `data-src` hasta activación; salir de región aborta la transferencia, y un error de `play()` o `error` conserva la foto con aviso. No hay requests a nombres de clips inventados.

## Cuatro clips que faltan

1. Altiplano: Real de Catorce y Sierra de Catorce.
2. Centro: patrimonio histórico de la capital (plazas y arquitectura).
3. Zona Media: Manantial de la Media Luna.
4. Huasteca: Cascada de Tamul y cañón del Tampaón.

Antes de activarlos se necesitan archivos autorizados, autor/titular, fuente y alcance de licencia, revisión de derechos de terceros y de derivados, encuadres desktop/móvil y comprobación real de reproducción, peso y fallback. El hero audiovisual sigue pendiente hasta disponer de esos clips y probarlos; las pruebas con fallos simulados sólo validan el mecanismo.
