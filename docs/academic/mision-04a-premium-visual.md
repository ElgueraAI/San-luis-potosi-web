# Misión 04A · implementación visual premium

Fecha: 2026-11-07, America/Mexico_City. Entrega local para revisión, sin commit, push, merge ni deploy.

## Preparación y alcance

Se verificó el worktree `san-luis-potosi-web-m04a`, rama `codex/mision-04a-ux-premium`, HEAD `3fe53fcec7e77a074dc8ecaa5a20a1c24f7e7306`, inicialmente limpio. Se consultaron en el repositorio original las instrucciones generales y las propuestas UX, consolidado y campaña de Misión 02, exclusivamente en lectura. Se creó y revisó un `AGENTS.md` mínimo para este worktree; no se copiaron configuraciones privadas, raw ni archivos académicos del original.

`npm ci` terminó correctamente con las versiones fijadas. El primer intento en sandbox falló por DNS; la instalación con red autorizada resolvió el bloqueo sin cambiar `package-lock.json`. Baseline: `npm run check`, cero errores/cero warnings y 10 hints; `npm run build`, 309 páginas. La implementación utilizó un agente acotado al hero y una revisión QA independiente posterior, además de integración y pruebas del coordinador.

## Cambios implementados

- **Portada:** adaptación de `HomeHero` con cuatro fotografías locales: Real de Catorce, patrimonio de Loreto/Plaza Fundadores, Media Luna y Tamul. Conserva «Cuatro mundos. Un San Luis Potosí.». Selector manual, enlaces regionales, créditos desplegables, transición de opacidad, pausa y composición móvil específica. La selección manual conserva la región; foco, hover, pestaña oculta y salida del viewport suspenden actividad.
- **Medios:** primera fotografía inmediata con preload/srcset existente; otras tres en templates, sin descarga hasta activarlas. Los controles reservan espacio desde HTML y permanecen inertes hasta la inicialización. Reduced-motion y Save-Data usan selección manual. Video futuro con poster, sources diferidos MP4/WebM, autoplay/muted/loop/playsinline, sólo medio activo y fallback ante error. Los cuatro slots siguen nulos: **el hero audiovisual no está terminado**.
- **Inteligencia:** portada bosque con fotografía y guía observado/derivado/simulado, jerarquía de KPI, superficies de gráficas y panel del mapa más legibles. Se preservaron mapas, tablas alternativas, leyendas, calendario y escenarios. Los tooltips ahora se asocian mediante `aria-describedby`, responden a teclado/tacto y se mantienen al desplazar el foco; Escape los cierra.
- **Descubre:** recorrido «elige / compara / guarda», formulario con filtros identificados, acceso directo a resultados, tarjetas uniformes de imagen 16:10 y botones Mi Ruta visibles. Se mantienen puntaje, explicación por factor, pesos, evidencia, fuentes y mensajes de información ausente. Error del dataset ofrece recarga/directorio; sin JavaScript se ofrece alternativa editorial.
- **Navegación:** acceso directo a Inteligencia en desktop, menú y footer; Descubre en header cuando cabe, menú y footer. En 320 px se priorizan marca, Mi Ruta y menú; el hero conserva su CTA a Descubre. Panel Destinos con scroll en pantallas bajas, cierre al salir el foco o cambiar a móvil; header visible al recibir foco; menú con scroll de fondo bloqueado y foco restaurado. Controles principales de al menos 44 px de alto y botón móvil de menú de 44 px de ancho.

## Corrección editorial y contrato M03

Se sustituyó «La visita se concentra; la oferta no» y su párrafo por «Más posibilidades para descubrir San Luis Potosí»: la base documenta oferta y diferencias de cobertura, sin medir visitas ni probar concentración. El hallazgo ya aparecía en Misión 02. Se preservan las hipótesis de redistribución como preguntas y escenarios, no como efectos medidos.

No se modificaron `src/lib`, datasets de producción, fuentes, fórmulas, pesos, umbrales, algoritmos ni resultados del escenario. El contrato `campaign-data-v1.0.0` permanece intacto. Se compararon antes/después los JSON generados del build raíz:

| Archivo | SHA-256 idéntico |
|---|---|
| `data/intel.json` | `e966ea670ac2d930503918db743d8f8d5abc7f5fe3e2e1ce6754102b11988e1a` |
| `data/places.json` | `bc9a56363619941f6d7a3f215fb4820bd797031ce1342845b5d0556e0349b45a` |
| `data/route-context.json` | `ca2396d6764bbef9206a77bb43b5e8a0a8ed0024da22c69cbaf379f09efa0f54` |

## Archivos de implementación

| Área | Archivos |
|---|---|
| Hero | `src/components/home/HomeHero.astro`, `src/scripts/hero.ts`, nuevo `src/data/heroRegions.ts` |
| Dashboard | `src/components/intel/ChapterHero.astro`, `src/pages/inteligencia-turistica/index.astro`, `src/styles/dashboard.css`, `src/scripts/intel/dashboard.ts` |
| Descubre | `src/pages/descubre.astro`, `src/styles/intel.css`, `src/scripts/intel/discover.ts` (sólo recuperación de carga) |
| Chrome y accesibilidad | `src/components/chrome/{SiteHeader,MenuSheet,SiteFooter}.astro`, `src/scripts/{site,menu}.ts`, `src/styles/base.css` |
| Derechos | `src/pages/creditos.astro`, nuevos `docs/ux/media-rights-review.md` y `docs/ux/hero-media.md` |
| QA / entrega | nuevo `scripts/verify/premium-visual.mjs`, `scripts/verify/links.mjs` (acepta `--dir`), `AGENTS.md` y este reporte |

## Medios, licencias y pendientes

La [revisión de derechos](../ux/media-rights-review.md) identifica los cuatro IDs adicionales: `wc-43676810`, `wc-198070643`, `wc-44351463`, `wc-36732336`. Son incorporaciones de `additions-pass4.json`, con atribuciones conservadas en producción y créditos, no cuatro archivos sin autor. Se hizo visible la reserva individual de derechos de terceros en Créditos. Señalética de FENAPO y diseños tradicionales de textiles necesitan revisión adicional para uso promocional; la fotografía de textiles corresponde a una exposición en Ciudad de México.

Las fotos del hero tienen autor/fuente/licencia documentados. Se consultaron las obligaciones oficiales CC BY 2.0 y CC BY-SA 4.0; el crédito señala modificaciones y continuidad de SA en la fotografía adaptada. Esta revisión no certifica titularidad ni autoriza publicación. No se descargó material nuevo ni se inventaron licencias.

Faltan cuatro clips autorizados: **Real de Catorce, patrimonio histórico del Centro, Media Luna y Cascada de Tamul**. El [contrato técnico](../ux/hero-media.md) y la auditoría de derechos detallan archivos, créditos, permisos, formatos y encuadres requeridos antes de activarlos.

## QA y evidencia local

Los logs, JSON y capturas quedan en `reports/m04a/` (ignorado por Git). Las pruebas de navegador utilizan Edge mediante Playwright: clima/routing con fixtures de la suite existente y bloqueo del resto de servicios externos. No se enviaron ubicaciones reales ni solicitudes de QA a proveedores turísticos. El primer lanzamiento del navegador en sandbox falló; la ejecución local autorizada permitió capturas y pruebas reales.

| Comprobación | Resultado |
|---|---|
| Check y build iniciales | OK; 0 errores, 0 warnings, 10 hints; 309 páginas |
| Check y build finales | OK; 0 errores, 0 warnings, mismos 10 hints; 309 páginas |
| `npm run test:geo` | 42/42 |
| `npm run test:intel` | 78/78 |
| `npm run test:signals` | 35/35 |
| `node --test tests/data-integrity/integrity.test.mjs` | 7/7 |
| Suite existente `scripts/verify/intel.mjs` | 133/134 inicialmente; fallo de tooltip por foco corregido y las 13 interacciones relacionadas repetidas: 13/13. El resto pasó, incluyendo recomendaciones, Mi Ruta, optimización, mapas sin basemap y responsive. |
| QA premium final | 29/29; evidencia en `reports/m04a/visual/report.json` |
| Enlaces internos raíz | 309 páginas, 88 254 referencias; sin enlaces internos rotos |
| Build y enlaces con `/san-luis-potosi-web/` | Build OK; 309 páginas, 88 254 referencias; sin enlaces internos rotos |
| Navegación real bajo base path | OK: seis rutas HTTP 200, enlace regional, Descubre → guardar → Mi Ruta, panel municipal y ausencia de excepciones; `reports/m04a/base-smoke.json` |
| Revisión independiente y `git diff --check` | Sin hallazgos bloqueantes / limpio |

La matriz premium cubre 320, 390, 768, 1024, 1440 y 1920 px, las tres vistas prioritarias, imágenes locales, elementos recortados, tablas de puntuación abiertas, créditos y enlaces regionales. Añade selección rápida, fallo de fotografía, rotación/pausa, video ausente y rechazo de reproducción simulado, reduced-motion, Save-Data, sin JavaScript, menú por teclado y error del dataset. Se corrigieron recortes que el `scrollWidth` global no detectaba, sin ocultarlos con CSS nuevo. El fallo inicial de la prueba sin JavaScript contaba KPI de dos secciones; se acotó a Radiografía sin alterar datos.

Capturas representativas disponibles:

- [Portada desktop](../../reports/m04a/visual/home-1440.png) y [móvil](../../reports/m04a/visual/home-390.png).
- [Inteligencia](../../reports/m04a/visual/inteligencia-1440.png) y [KPI](../../reports/m04a/visual/dashboard-1440.png).
- [Descubre](../../reports/m04a/visual/descubre-1440.png) y [resultados](../../reports/m04a/visual/descubre-results-1440.png).
- [Fallback ante rechazo de video](../../reports/m04a/visual/hero-video-failure.png). Es una prueba inyectada; no metraje incorporado al producto.
- Referencia inicial en `reports/m04a/before/`; cada región en `reports/m04a/visual/hero-region-*.png`.

## Rendimiento y accesibilidad

No se añadieron dependencias, servicios ni analítica. Las imágenes conservan dimensiones intrínsecas y WebP responsive; el JS del hero se importa sólo en la home. El mapa conserva su carga diferida. El hero montó una sola foto inicial y cero videos en ambas muestras locales.

Muestra local única, sin throttling, con movimiento reducido y servicios externos bloqueados (`reports/m04a/performance.json`): a 390 px, LCP 1136 ms y CLS 0,00049; a 1440 px, LCP 748 ms y CLS 0,00168. Transferencia local inicial observada: 271 317 / 643 625 bytes respectivamente. No son Core Web Vitals de campo ni una puntuación Lighthouse; los tiempos dependen del equipo/caché. Reservar el espacio del selector redujo la inestabilidad de la muestra anterior.

Se verificaron foco visible, retorno de foco, Escape, objetivos táctiles, controles nativos, información redundante al color, tablas alternativas y modos de movimiento reducido/ahorro. El contraste del texto usa tokens existentes y fondos oscuros reforzados en créditos; no se afirma certificación WCAG completa ni auditoría con lector de pantalla.

## Límites y riesgos pendientes

- No se ejecutó `npm test` completo ni `test:data`/ETL real: incluyen reproducción que requiere raw privado ignorado. Se ejecutó el archivo de integridad independiente; no se desactivó ninguna prueba ni se fabricaron insumos. La ausencia de raw no constituye fallo del portal.
- No se verificaron clips reales, audio/video decodificado, cobertura remota de teselas ni disponibilidad de APIs externas. El rechazo de video se simuló para comprobar el fallback.
- Quedan pendientes permisos específicos de medios, revisión humana antes de publicar, lector de pantalla y métricas de campo. Se conserva la geografía y cobertura declaradas por M03, sin certificar límites municipales actuales.
- Las fotos de lugares sin fotografía verificada siguen siendo placeholders explícitos, sin atribuirles imágenes de otros destinos. Los puntajes orientan el orden y no prometen afluencia, calidad, seguridad ni disponibilidad.

El resultado se conserva local para revisión. No se publica ni se transfiere al repositorio original.
