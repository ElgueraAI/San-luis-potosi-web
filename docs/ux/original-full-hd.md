# Portada con el archivo Full HD original · 2026-11-08

El usuario pidió máxima calidad original, sin el montaje de 20 segundos, y proporcionó «San Luis Potosí, CHINGON.mp4» como versión Full HD. Se sustituyó la fuente activa por una copia exacta, sin edición, recorte de archivo, cambio de bitrate, reducción de resolución ni recodificación.

- Fuente activa: `public/media/hero-original-1080p.mp4`.
- Resolución comprobada: **1920×1080**, H.264 High, 23,98 fps, aproximadamente 4059 kb/s de video.
- Duración: aproximadamente **149,54 segundos**; tamaño: **78 331 246 bytes**.
- SHA-256 del archivo proporcionado y de la copia: `bdddcb29b3d0ddcd3d804e32ccfac0d5e57a2b9dc26af1a3b81c8888c95eca96`.
- El audio AAC original permanece en el archivo; el navegador reproduce con `muted`, sin iniciar sonido.
- Poster PNG de 1920×1080 extraído a los 75 segundos, sin reducción de dimensiones ni compresión con pérdida. Se actualizó el preload.

Se dejó de servir el MP4 anterior de 640×360 y las variantes recortadas/recomprimidas MP4/WebM. Los archivos anteriores se conservan como antecedentes; no son sources del banner. El archivo original en la carpeta del usuario permanece intacto.

La decisión de servir el archivo completo de 78 MB prioriza la solicitud explícita de calidad original frente al presupuesto anterior del reel. Se mantienen carga diferida, poster inmediato, pausa, regiones, reintento y bloqueo de transferencia automática con Save-Data o movimiento reducido. El CSS usa `object-fit: cover` para llenar el banner: puede ocultar parte del encuadre según la relación de aspecto, pero no cambia los bytes ni la resolución del video.

La prueba `scripts/verify/hero-video.mjs` comprueba hash exacto, `videoWidth=1920`, `videoHeight=1080`, duración completa y URL del original. Se retiró la prueba de fallback entre formatos porque sólo se sirve el archivo MP4 original; permanecen las comprobaciones de fallo de red y autoplay.

Validación: **11/11** comprobaciones en Edge sobre 390, 1440 y 1920 px, con decodificación real de 1920×1080 y duración completa. Hash original/copia idéntico, pausa/reanudación, selección regional y regreso al video, error de red, rechazo de autoplay y cero transferencias bajo Save-Data/reduced-motion. Capturas en `reports/m04a2/owned-video/`, log `reports/m04a2/full-hd-video-qa.log`. Check: cero errores/cero warnings, 11 hints previos; build: 309 páginas. Sin commit, push ni deploy; vista previa local actualizada.
