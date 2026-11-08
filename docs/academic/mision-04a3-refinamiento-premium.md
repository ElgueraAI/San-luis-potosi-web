# Misión 04A.3 — Refinamiento premium

Implementación local del 8 de noviembre de 2026 en `C:\Users\jerry\Projects\san-luis-potosi-web-m04a`, rama `codex/mision-04a-ux-premium`. Se conservó el trabajo audiovisual y visual sin confirmar. Sin commit, push, merge ni publicación.

## Resultado implementado

El hero muestra únicamente «Cuatro mundos. Un San Luis Potosí.» como contenido editorial principal. Se eliminaron del plano audiovisual el antetítulo, párrafos, bloque derecho y grandes CTA. La navegación general conserva los accesos a destinos y planeación. El menú compacto de regiones permite seleccionar fotografías manualmente y explorar sus páginas. Hay pausa/reanudación, regreso al video y créditos desplegables. Escape devuelve el foco al control; la interacción exterior cierra los desplegables.

Se mantuvieron las fuentes serif/sans originales y la paleta marfil/carbón. El titular usa tamaño fluido; los degradados se concentran en título y cabecera. Las fotografías regionales se cargan al seleccionarlas, sin carrusel automático. Se preservaron poster, reproducción silenciosa, loop, playsinline, recuperación ante errores y controles para movimiento reducido y ahorro de datos.

El archivo activo es el original completo `public/media/hero-original-1080p.mp4`: H.264, 1920 × 1080, aproximadamente 149,54 segundos y 78.331.246 bytes. SHA-256: `bdddcb29b3d0ddcd3d804e32ccfac0d5e57a2b9dc26af1a3b81c8888c95eca96`. El propietario confirmó su autoría en el chat. No se recodificó, recortó, reescaló ni borraron marcas. La imagen usa cover: en pantallas verticales existe recorte lateral del encuadre, sin modificar el archivo.

## Evidencia visual local

Las imágenes de `reports/` son evidencia local ignorada por Git, no recursos publicados. Antes/después del hero usan el mismo fotograma a los 15 segundos y viewport de 1440 × 900.

| Vista | Antes | Después |
| --- | --- | --- |
| Hero | [captura](../../reports/m04a3/before/home.png) | [captura](../../reports/m04a3/after/home.png) |
| Real de Catorce | [ficha anterior](../../reports/m04a3/before/catorce-facts.png) | [ficha final](../../reports/m04a3/after/catorce-final.png) |
| Móvil | Referencias aportadas por el usuario | [hero 390 px](../../reports/m04a3/after/hero-390.png), [ficha 390 px](../../reports/m04a3/after/catorce-facts-390.png) |

La captura móvil de la ficha corresponde a la revisión previa a eliminar «Tipo de lugar» cuando repetía «Pueblo Mágico». La captura final de escritorio documenta los cuatro campos distintos: región, municipio, distinción y año.

## Arquitectura y cobertura

`PlaceFacts.astro`, `place-facts.ts`, `render-place-facts.ts` y `place-facts.css` comparten modelo, adaptadores, SVG semánticos, renderizado escapado y estilos. Se muestran cuatro campos disponibles y un despliegue nativo «Ver información completa». Los enlaces de fuente y estados acompañan cada campo; el panel ampliado contiene información adicional, procedencia y límites. En móviles estrechos se usa una columna; en espacios amplios, dos.

| Tipo de página individual | Páginas con componente |
| --- | ---: |
| Municipios | 59 |
| Destinos, incluidos Pueblos Mágicos y lugares naturales/históricos | 52 |
| Eventos documentados | 145 |
| Arqueología | 3 |
| Experiencias | 12 |

La compilación contiene 309 páginas HTML en total. Museos, recintos, hospedaje, gastronomía, recreación y áreas protegidas también usan la ficha en catálogos y/o páginas municipales. Hay 2.099 modelos JSON públicos de presentación (9.663.200 bytes totales), cargados individualmente al abrir un detalle de catálogo; no se transfieren todos al entrar a la página. No se crearon páginas individuales ficticias.

`place-links.ts` resuelve IDs exactos a páginas existentes o al catálogo `?place=ID#place-ID`. Descubre, mapa y Mi Ruta reciben esos enlaces desde las tarjetas compartidas. Los catálogos abren el registro seleccionado por ID; los monumentos religiosos y lugares municipales enlazan a su ancla real. Se conservaron añadir a Mi Ruta, mapa, galería, clima, temporada, visita y recursos.

## Datos, fuentes y límites

Los adaptadores consumen exclusivamente los catálogos públicos normalizados existentes y la evidencia documental por campo de los destinos. No modifican fuentes, valores, puntajes ni algoritmos. Se presentan, según el esquema, región, municipio, categoría, distinciones, fechas, descripción, población censal, coordenadas, patrimonio, accesos, contacto, horarios, costos y otros atributos disponibles. No se rellenan valores ausentes.

- **OBSERVADO:** evidencia explícita de campo/registro estable con fuente resoluble; describe su alcance documental, sin garantizar vigencia actual.
- **DERIVADO:** presentación o clasificación editorial a partir del catálogo.
- **PENDIENTE DE VERIFICACIÓN:** existe el valor pero falta acreditación suficiente por campo, precisión o actualidad. La procedencia general del registro no convierte todos sus atributos en verificados.
- **NO DISPONIBLE:** limitación explícita, por ejemplo ausencia de horarios o coordenadas; no equivale a cero.

Las referencias conservan identificador, enlace disponible y fecha documentada. Esta fecha no se presenta como fecha de publicación ni prueba de vigencia. Horarios, costos, accesos, actividades y ediciones de eventos requieren confirmación actual. Las fechas históricas de eventos se etiquetan como documentadas; no se anuncian como próximas.

Villa de Pozos mantiene ID/clave comparable nulos en la fuente. Su identificador de presentación permite renderizar la ficha, pero no se usa para unir indicadores. Se informa expresamente que hay 59 páginas municipales y 58 claves comparables. No hay agregación por coincidencia de nombres o por claves nulas.

Casos comprobados: `denue-10004641`, sin horario y con campos pendientes; `estadia-104`, sin coordenadas; Villa de Pozos, sin clave comparable; campos editoriales sin referencia de campo se mantienen derivados o pendientes. No se inventó un registro sin fuentes para aparentar cobertura de prueba.

La comparación con la compilación anterior conserva íntegros los atributos de `intel.json`, `places.json` y `route-context.json` después de normalizar únicamente URLs de presentación, BASE_PATH y sufijos de imágenes de compilación. Las URLs cambiaron deliberadamente para llegar al detalle exacto. No se afirma igualdad binaria de esos JSON. Sin cambios en `src/lib/intel`, datos de investigación, datos generados canónicos o lockfile.

## Validación ejecutada

| Comprobación | Resultado |
| --- | --- |
| Astro check final | 0 errores, 0 advertencias, 7 hints |
| Build raíz y BASE_PATH `/san-luis-potosi-web/` | 309 páginas en ambos |
| Geografía / inteligencia / integridad pública | 42/42, 78/78, 7/7 |
| Navegador: Descubre, mapa y Mi Ruta | 134/134 |
| Video original, metadatos y fallbacks | 11/11, incluidas anchuras 360, 768 y 1920 px |
| Hero, navegación y responsive general | 33/33 |
| Fichas, cuatro regiones, municipios y catálogos | 48/48 |
| Detalle por ID, Catorce y anclas de catedrales | 4/4 en raíz y 4/4 con BASE_PATH |
| Estados audiovisuales con BASE_PATH | 8/8 |
| Enlaces internos raíz y BASE_PATH | 309 páginas, 91.756 referencias por compilación; ninguno roto |

La última modificación sólo eliminó el campo redundante de clasificación en Pueblos Mágicos; se recompilaron ambas variantes y se volvió a comprobar la ficha resultante y los detalles por ID. La verificación completa de enlaces anterior a esa eliminación sigue siendo aplicable porque no modificó rutas ni enlaces.

Se verificaron 360, 390, 430, 768, 1366, 1440 y 1920 px en la suite general; fichas en 360, 390, 768, 1440 y 1920 px. Sin desbordamiento horizontal ni errores JavaScript en los casos comprobados. Teclado, Escape, foco, expansión nativa, nombres accesibles, reduced-motion y Save-Data tienen comprobaciones específicas. Las solicitudes externas estuvieron bloqueadas: estos resultados no acreditan disponibilidad de servicios remotos. Los reportes y capturas están en `reports/m04a3/`; los scripts de laboratorio, en `scrollcraft/lab/`.

Un primer intento del nuevo test del selector comprobaba aria-pressed antes de terminar `image.decode()`: se corrigió la espera y las 48 comprobaciones pasaron. El servidor local se reinició tras detectar que no estaba escuchando; el smoke final pasó. No quedan pruebas finales fallidas conocidas. La QA independiente estática confirmó las correcciones de las anclas de catedrales y la eliminación de duplicados, sin bloqueadores.

## Pendientes reales

El MP4 contiene «México», títulos como «EL NARANJO»/«CASCADA EL MECO» y subtítulos ingleses incrustados. Permanecen visibles porque el usuario pidió conservar el original. Para una película sin textos se necesita una versión limpia autorizada; CSS no puede retirarlos. El archivo original pesa aproximadamente 78 MB y no tiene variantes adaptativas por decisión de conservar su calidad exacta; Save-Data y movimiento reducido evitan la transferencia automática.

Se revisó visualmente legibilidad en capturas y estados representativos; no se certifica contraste WCAG en cada fotograma de toda la película ni se ejecutó una auditoría completa con lector de pantalla real. La revisión editorial de vigencia de cada fuente sigue pendiente. No se ejecutó ETL con raw privado ni se copiaron datos privados al worktree.

La web queda para revisión local en `http://127.0.0.1:4321/`. Sin publicación ni commit.
