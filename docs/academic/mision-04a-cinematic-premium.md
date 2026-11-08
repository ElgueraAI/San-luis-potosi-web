# Misión 04A.2 · experiencia cinematográfica premium

**Actualización posterior:** la portada usa ahora el archivo original Full HD de 1920×1080 y 2:29, sin recodificar, en sustitución del montaje descrito como antecedente. Véase [archivo original Full HD](../ux/original-full-hd.md).

Fecha de trabajo: 2026-11-07 (America/Mexico_City). Rama `codex/mision-04a-ux-premium`; referencia M03 `3fe53fcec7e77a074dc8ecaa5a20a1c24f7e7306`. Se conservan los cambios locales de M04A sin commits ni publicación.

## Dirección y referencias

El objetivo es una portada con video real cuando exista archivo autorizado y una secuencia editorial coherente en toda la home. La fotografía estática es el fallback explícito; no se usa rotación fotográfica automática para imitar metraje.

La [revisión de referencias](../ux/cinematic-reference-review.md) registra la consulta de Switzerland Tourism, la imposibilidad de inspeccionar ambos enlaces YouTube, la investigación de alternativas y la propuesta de montaje de 20 segundos. No se copiaron identidad, textos, código ni medios del sitio de referencia.

## Estado audiovisual

**Actualización del 8 de noviembre:** el usuario proporcionó un MP4 y confirmó su autoría con «ES MIO». Se produjo un reel real de 20 segundos, sin audio, con MP4/WebM y encuadre móvil, integrado como fondo inicial. Véase [integración del video del propietario](../ux/owned-video-integration.md) para autorización, hashes, transformaciones y QA. Permanece pendiente atribuir capítulos de video verificables a las cuatro regiones. El estado sin archivo descrito en el resto del reporte corresponde al cierre anterior del 7 de noviembre; queda superado para el reel general. No se extrajeron los enlaces YouTube.

El [registro audiovisual](../ux/video-rights-register.json) conserva los cuatro slots regionales con campos desconocidos nulos y añade el reel del propietario con permiso directo, transformaciones, rutas, tamaños y hashes. Sólo el reel general está habilitado para integración; no se inventa una licencia abierta ni se autoriza automáticamente cada lugar como capítulo.

La diferencia 85/89 quedó resuelta en M04A: cuatro registros aditivos documentados. Se conserva [la auditoría de derechos](../ux/media-rights-review.md); no se repite ni se transforma una reserva editorial en permiso comercial. FFmpeg/ffprobe no se encontraron en PATH; no se instalaron servicios o paquetes de pago.

## Implementación y validación

Implementado y comprobado visualmente: hero sin carrusel automático, selección regional manual, CTA a destinos y Descubre, overlay más ligero; introducción, invitación editorial a recomendaciones, mosaico asimétrico de experiencias y cierre. Se conservan regiones, destinos destacados, mapa, temporadas y planificación. La sección de guías reutiliza una foto local de patrimonio, sin atribuirla a un guía o una actividad no documentada. Se simplifica el header; Descubre resume preferencias e Inteligencia añade «Sin datos». No se modifican algoritmos ni cifras.

Archivos: `src/components/home/{HomeHero,Intro,DiscoverBand,Experiences,Close}.astro`, `src/components/chrome/{SiteHeader,SiteFooter}.astro`, `src/components/intel/ChapterHero.astro`, `src/pages/{index,descubre}.astro`, `src/scripts/hero.ts`, `src/scripts/intel/discover.ts` y `scripts/verify/premium-visual.mjs`. Se reutilizan `Regions`, `Photo`, `BaseLayout`, tokens y módulos de mapas. Se actualiza el contrato técnico `docs/ux/hero-media.md`; la entrega anterior M04A conserva su carácter histórico.

Implementado con comprobación simulada, sin metraje real: video activo excluyente, poster, progreso por `timeupdate`, carga/error, rechazo de autoplay, reintento, pausa y reanudación, reduced-motion y Save-Data. La revisión QA detectó y se corrigió una carrera al reanudar antes de finalizar un `play()` interrumpido. Un harness independiente sobre el TypeScript real comprobó seis casos: reanudación, pausa definitiva, AbortError aislado, NotAllowedError, ocultar/revelar y ausencia de bucle de reintentos. Esto no prueba decodificación de un clip real.

QA de navegador real con Edge/Playwright y servicios externos bloqueados: **32/32** comprobaciones premium, en 360, 390, 430, 768, 1366, 1440 y 1920 px; imágenes, recortes, regiones, créditos, poster sin timer, error de foto/video, reintento, teclado, menú, estados vacíos/error y sin JavaScript. Suite existente de recomendaciones, Mi Ruta, mapas, calendario, escenarios y dashboard: **134/134**. Check/build finales tras el arreglo: cero errores/cero warnings, 10 hints previos y 309 páginas; repetición de los siete casos de hero: **7/7**. No se ejecuta ETL ni se desactivan pruebas por ausencia de raw.

Build adicional con `/san-luis-potosi-web/`: 309 páginas. Diez verificaciones de navegación sobre ese build aprobadas (seis rutas HTTP 200, enlace regional con prefijo, guardar desde Descubre y abrir Mi Ruta, panel municipal y ausencia de excepciones). Los tres hashes de `intel.json`, `places.json` y `route-context.json` son idénticos a los anteriores; `src/lib`, datos generados, research y lockfile no tienen cambios de esta misión. Logs en `reports/m04a2/`, excluidos de Git. La vista previa raíz se mantiene activa para revisión en `http://127.0.0.1:4321/`.

Barridos de enlaces raíz y GitHub Pages: 309 páginas y 87 951 referencias internas en cada build, sin enlaces internos rotos. Se generaron 58 capturas nuevas; la revisión independiente no dejó defectos confirmados pendientes. No hubo commit, push, merge ni deploy.

Capturas antes/después: `reports/m04a2/before/` y `reports/m04a2/visual/`. Se inspeccionaron imágenes del hero, regiones móviles, invitación y experiencias. Ejemplos: [hero](../../reports/m04a2/visual/home-1440.png), [invitación](../../reports/m04a2/visual/home-invitacion-1440.png), [experiencias](../../reports/m04a2/visual/home-experiencias-1440.png), [regiones móvil](../../reports/m04a2/visual/home-regiones-390.png). No se afirma una auditoría completa con lector de pantalla o certificación WCAG.

Comparación local sin throttling, movimiento reducido, una muestra por ancho (antes → después): a 390 px LCP 1136 → 1504 ms, CLS 0,000495 → 0,000496 y transferencia inicial 271317 → 271726 bytes; a 1440 px LCP 748 → 1132 ms, CLS 0,001678 → 0,001579 y 643625 → 644034 bytes. El incremento de 409 bytes no es un presupuesto de video; los tiempos están influidos por concurrencia/caché y no acreditan regresión estadística ni mejora de campo. Se monta una foto inicial y cero videos. No hubo nuevas dependencias. Metas de 6–8 MB escritorio y 2–4 MB móvil siguen siendo propuestas hasta contar con archivos.

Propuestas no implementadas: reel maestro de 20 segundos y cortes verticales, montaje cromático/loop y embed YouTube. Pendiente audiovisual definitivo: los cuatro clips con derechos y reproducción real. Registro de derechos y las limitaciones se conservan explícitos, sin presentar la misión audiovisual como completa.

## Evidencia inicial

Capturas previas en `reports/m04a2/before/`; muestra local anterior en `reports/m04a2/performance-before.json`. No equivale a medición de campo ni Lighthouse. Hashes iniciales de los endpoints M03 conservados en `reports/m04a2/data-hashes-before.json` para comprobar regresión sin raw.

## Límites

No se copian datos privados ni se ejecuta ETL dependiente de raw ausente. La validación de mapas/proveedores utiliza fixtures o bloqueo de servicios remotos. No se afirma certificación WCAG completa ni reproducción audiovisual real a partir de simulaciones de errores.
