# Integración del video del propietario · 2026-11-08

**Actualización posterior:** la portada usa ahora el archivo original Full HD de 1920×1080 y 2:29, sin recodificar, en sustitución del montaje descrito como antecedente. Véase [archivo original Full HD](original-full-hd.md).

El usuario proporcionó el archivo «Descubre las maravillas de San Luis Potosí.mp4» y respondió **«ES MIO»** a la confirmación de autoría y permiso de edición/uso como fondo del portal. La autorización se documenta en [el registro audiovisual](video-rights-register.json). No se atribuye una licencia Creative Commons ni se publica el sitio. El crédito visible dice «Material del propietario».

Se inspeccionó el original con Edge y FFmpeg: H.264, 640×360, 23,98 fps, 60,07 segundos, audio AAC, 5 027 736 bytes. SHA-256 original `6bcb7dbec0c42868a210f62752db48d4d07b9ef5d55d7adb34f2530afda24f82`. El original permanece intacto en la ubicación indicada por el usuario; no se copia al repositorio.

Se preparó un reel de 20 segundos con los intervalos 6–11, 18–23, 25–30 y 39–44. Se eliminaron audio y barras negras mediante recorte 640×264 (y=46). MP4 H.264 con faststart, más WebM VP9. La versión móvil utiliza centro 148×264 y salida 180×320; se comprobó su encuadre en navegador. La resolución baja del original limita la nitidez; no se presenta como metraje HD/4K ni se inventan detalles mediante IA. Los cortes son limpios; no se certifica una unión de loop imperceptible.

| Variante | Dimensiones | MP4 | WebM |
|---|---|---|---|
| Escritorio | 640×264 | 2 790 517 bytes | 2 460 824 bytes |
| Móvil | 180×320 | 752 641 bytes | 662 851 bytes |

Poster WebP: 46 364 bytes, derivado del reel sin controles de reproductor. Archivos en `public/media/hero-reel-*`; cada variante queda por debajo de los presupuestos propuestos. El codificador portátil se obtuvo mediante `npm pack @ffmpeg-installer/win32-x64`, en el directorio ignorado `reports/m04a2/encoder`, sin cambiar package.json/lockfile ni instalar software global. No se usó extracción de YouTube.

El reel ocupa el fondo de la primera pantalla, con autoplay silenciado, loop, playsinline, poster inmediato, progreso, pausa/reanudación y reintento. Sólo se conectan sources de la variante correspondiente al viewport. Las cuatro regiones siguen siendo selecciones fotográficas independientes con créditos y enlaces correctos: seleccionar una pausa y descarga el reel; «Volver al video» lo reanuda. No se etiqueta todo el montaje como una sola región ni se inventan capítulos geográficos. La representación audiovisual verificable de las cuatro regiones continúa pendiente.

Se ejecutaron 19/19 comprobaciones en Edge: reproducción y metadatos reales en 360, 390, 430, 768, 1366, 1440 y 1920 px; progreso, pausa/reanudación, selección de fotografías y regreso al reel; cero transferencias con reduced-motion o Save-Data; error de red conservando poster, fallback WebM→MP4 y rechazo de autoplay con reintento. Se inspeccionaron capturas móvil y escritorio (`reports/m04a2/owned-video/`). Script reproducible: `node scripts/verify/hero-video.mjs`.

La QA independiente confirmó la gestión de errores individuales de sources, invalidez de intentos antiguos y límite de carga de 15 segundos. Se corrigió también el caso de pausar y reanudar una promesa de reproducción bloqueada, que debe conservar un deadline y ofrecer reintento. Las simulaciones de error se distinguen de la reproducción real observada.

La suite visual completa adaptada al reel pasó **33/33**. El build con el prefijo `/san-luis-potosi-web/` se generó y se verificó reproducción real móvil, poster y enlace regional bajo esa base. Datos, fórmulas y lockfile permanecen sin cambios. El hash original se volvió a comprobar y es idéntico. No se realizó commit, push ni deploy.

Cierre después de la protección adicional de deadline: `check` con cero errores/cero warnings (11 hints, incluidos diagnósticos de QA temporal), build de 309 páginas y smoke final **7/7** con video real, modos limitados, red, fallback de formato y autoplay. La vista previa conserva el reel en `http://127.0.0.1:4321/`.
