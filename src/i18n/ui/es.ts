/** Interface text, Spanish. Source of truth: en.ts must have exactly these keys. */
export const es = {
  'site.name': 'San Luis Potosí',
  'site.tagline': 'Cuatro mundos. Un San Luis Potosí.',
  'site.description':
    'Del desierto alto a la selva de la Huasteca, San Luis Potosí cambia de mundo cuatro veces. Descubre el Altiplano, el Centro, la Zona Media y la Huasteca.',

  'a11y.skip': 'Saltar al contenido',
  'a11y.mainNav': 'Navegación principal',
  'a11y.lineNav': 'Regiones a lo largo de la línea del terreno',
  'a11y.menuOpen': 'Abrir menú',
  'a11y.menuClose': 'Cerrar menú',
  'a11y.regionsOpen': 'Saltar a una región',
  'a11y.home': 'San Luis Potosí, inicio',

  'nav.regions': 'Regiones',
  'nav.experiences': 'Experiencias',
  'nav.map': 'Mapa',
  'nav.now': 'Ahora',
  'nav.stories': 'Historias',
  'nav.plan': 'Planea tu viaje',
  'nav.route': 'Mi ruta',
  'nav.lang.en': 'English',
  'nav.lang.enPending': 'Versión en inglés en preparación',
  'nav.soon': 'Próximamente',

  'menu.title': 'Explora San Luis Potosí',
  'menu.regions': 'Cuatro mundos',
  'menu.sections': 'Descubre y planea',

  'hero.title': 'Cuatro mundos. Un San Luis Potosí.',
  'hero.lede': 'Del desierto alto a la selva de la Huasteca, un mismo estado cambia de mundo cuatro veces.',

  'intro.title': 'No es un solo destino.',
  'intro.body': 'Es un descenso. Del desierto alto a la selva, cuatro mundos cambian uno tras otro a lo largo de una misma línea de tierra.',

  'descent.title': 'El descenso: cuatro mundos',
  'descent.altitude': 'Altitud',
  'descent.explore': 'Explora {region}',
  'descent.soon': 'Página regional en preparación',
  'descent.finale': 'Cuatro mundos. Un solo descenso.',
  'descent.finaleBody': 'Al final de la línea, el agua.',

  'fact.pending': 'pendiente',
  'fact.pendingTitle': 'Dato pendiente de verificación oficial',

  'placeholder.label': 'Espacio de medios',
  'placeholder.image': 'Imagen',
  'placeholder.video': 'Video',
  'placeholder.plane': 'Capa con transparencia',
  'placeholder.required': 'Requerido',
  'placeholder.legend': 'Escena por capas, recursos pendientes',

  'footer.note': 'Proyecto académico. Datos y medios en proceso de verificación.',
  'footer.demo': 'Contenido de demostración: ningún dato pendiente se presenta como información oficial.',
} as const;

export type UiKey = keyof typeof es;
