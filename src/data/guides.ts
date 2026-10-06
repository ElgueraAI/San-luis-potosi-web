/**
 * Guides & resources, grouped the way a visitor looks for them. Every external
 * item is an official resource from research/pdf-registry/resources.json or
 * research/source-registry/sources.json, linked (never mirrored). The site does
 * not republish brochures and does not copy the SECTUR guide directory.
 */
import { resources, getSource, type RegionId } from './research';

export type ResourceItem = {
  id: string; title: string; institution: string; region: RegionId | null; kind: string; url: string; external: boolean; note?: string; date?: string | null;
};
export type ResourceGroup = { id: string; title: string; intro: string; items: ResourceItem[] };

const fromRes = (id: string, kind: string, note?: string): ResourceItem | null => {
  const r = resources.find((x) => x.resource_id === id);
  if (!r || !r.url) return null;
  return { id, title: r.title.replace(' – ', ': '), institution: r.institution, region: (r.region || null) as RegionId | null, kind, url: r.url, external: true, note, date: r.publication_date ?? null };
};
const fromSrc = (id: string, kind: string, title?: string, note?: string): ResourceItem | null => {
  const s = getSource(id);
  if (!s || !s.url) return null;
  return { id, title: title ?? s.title, institution: s.institution, region: null, kind, url: s.url, external: true, note };
};
const internal = (id: string, title: string, url: string, note: string): ResourceItem => ({ id, title, institution: 'Este sitio', region: null, kind: 'Página', url, external: false, note });

export function resourceGroups(BASE: { routes: string; plan: string; map: string; seasons: string; museums: string; events: string; lodging: string }): ResourceGroup[] {
  const groups: ResourceGroup[] = [
    {
      id: 'folletos',
      title: 'Folletos y guías oficiales',
      intro: 'Los folletos regionales de la Secretaría de Turismo del Estado: atractivos, distancias y recomendaciones.',
      items: [
        fromRes('pdf-brochure-altiplano', 'PDF'),
        fromRes('pdf-brochure-centro', 'PDF'),
        fromRes('pdf-brochure-media', 'PDF'),
        fromRes('pdf-brochure-huasteca', 'PDF'),
      ].filter((x): x is ResourceItem => !!x),
    },
    {
      id: 'mapas',
      title: 'Mapas',
      intro: 'Mapas turísticos oficiales del estado, de cada región y de la capital.',
      items: [
        fromRes('map-general-2026', 'Imagen'),
        fromRes('map-altiplano', 'Imagen'),
        fromRes('map-centro', 'Imagen'),
        fromRes('map-media', 'Imagen'),
        fromRes('map-huasteca', 'Imagen'),
        fromRes('pdf-brochure-capital', 'PDF'),
      ].filter((x): x is ResourceItem => !!x),
    },
    {
      id: 'guias-turisticos',
      title: 'Guías de turistas acreditados',
      intro: 'Los folletos oficiales recomiendan contratar guías certificados. Verifica la acreditación directamente en el directorio de SECTUR, que puede filtrarse por San Luis Potosí, municipio, tipo de guía e idioma.',
      items: [
        fromSrc('sectur-guias-directorio', 'Directorio oficial', 'Directorio nacional de guías de turistas acreditados', 'Consulta en el sitio de SECTUR. Este proyecto no copia datos personales del directorio.'),
        fromSrc('sectur-guias-acreditacion', 'Programa', 'Acreditación de guías de turistas', 'Tipos de guía: general, especializado en temas culturales y especializado en naturaleza y aventura.'),
        fromRes('sectur-nom-08-tur-2002', 'PDF', 'Norma que regula a los guías generales y especializados.'),
      ].filter((x): x is ResourceItem => !!x),
    },
    {
      id: 'arqueologia',
      title: 'Guías arqueológicas',
      intro: 'Fichas y guías del INAH sobre las zonas abiertas al público.',
      items: [
        fromRes('inah-guia-tamtoc', 'Guía'),
        fromRes('inah-lugar-tamtoc', 'Ficha'),
        { id: 'inah-tamohi', title: 'Tamohí (El Consuelo): ficha INAH', institution: 'INAH', region: 'huasteca', kind: 'Ficha', url: 'https://lugares.inah.gob.mx/es/node/4527', external: true, note: 'Horario, costo y descripción oficiales.' },
        fromSrc('inah-datos-zonas-arqueologicas', 'Datos abiertos', 'Zonas arqueológicas abiertas al público (INAH)', 'CSV de actualización trimestral.'),
      ].filter((x): x is ResourceItem => !!x),
    },
    {
      id: 'cultura',
      title: 'Guías culturales',
      intro: 'Directorio cultural nacional: museos, teatros, centros culturales, festivales y patrimonio de San Luis Potosí.',
      items: [
        { id: 'sic-slp', title: 'Sistema de Información Cultural: San Luis Potosí', institution: 'Secretaría de Cultura', region: null, kind: 'Directorio', url: 'https://sic.cultura.gob.mx/datos.php', external: true, note: 'Datos abiertos de libre uso con atribución.' },
        internal('museos', 'Museos y recintos culturales', BASE.museums, 'El catálogo del SIC con filtros por municipio y tipo.'),
        internal('eventos', 'Festividades y eventos', BASE.events, 'Calendario con el estado de cada fecha.'),
      ].filter((x): x is ResourceItem => !!x),
    },
    {
      id: 'directorios',
      title: 'Directorios oficiales',
      intro: 'Directorios públicos de servicios turísticos y establecimientos.',
      items: [
        fromSrc('estadia-visitaslp', 'Directorio oficial', 'Estadía: hospedaje y restaurantes', 'Secretaría de Turismo de San Luis Potosí.'),
        fromSrc('inegi-denue', 'Registro estadístico', 'DENUE: unidades económicas de San Luis Potosí', 'Registro de INEGI; no confirma operación actual.'),
        internal('hospedaje', 'Hospedaje por municipio', BASE.lodging, 'Directorio oficial y DENUE con filtros.'),
      ].filter((x): x is ResourceItem => !!x),
    },
    {
      id: 'descargas',
      title: 'Datos descargables',
      intro: 'Conjuntos de datos oficiales usados por este proyecto.',
      items: [
        fromRes('inegi-iter-2020-slp', 'CSV'),
        fromRes('inegi-denue-slp', 'CSV'),
        fromRes('inegi-cem3-r90-slp', 'Ráster'),
        fromRes('ped-slp-2021-2027', 'PDF'),
        fromSrc('sectur-estadisticas-2022', 'PDF', 'El Sector Turismo en San Luis Potosí (2022)', 'Contexto histórico; no describe la oferta actual.'),
      ].filter((x): x is ResourceItem => !!x),
    },
    {
      id: 'practica',
      title: 'Información práctica',
      intro: 'Recomendaciones oficiales, contacto de la Secretaría de Turismo y qué llevar.',
      items: [internal('planea', 'Planea tu viaje', BASE.plan, 'Recomendaciones de los folletos, contacto oficial, qué llevar y clima en vivo.'), internal('temporadas', 'Qué hacer ahora', BASE.seasons, 'Recomendaciones oficiales por mes y temporada, con contexto climático.')],
    },
    {
      id: 'movilidad',
      title: 'Movilidad y distancias',
      intro: 'Distancias y tiempos aproximados por carretera, según las tablas de los folletos oficiales.',
      items: [internal('distancias', 'Tablas de distancias', `${BASE.plan}#movilidad`, 'Desde Matehuala, la capital, Rioverde y Ciudad Valles.'), internal('mapa', 'Mapa interactivo', BASE.map, 'Destinos con ubicación verificada o aproximada, filtros y clima.')],
    },
    {
      id: 'rutas',
      title: 'Rutas',
      intro: 'Itinerarios sugeridos con destinos verificados.',
      items: [internal('rutas', 'Rutas e itinerarios', BASE.routes, 'Fin de semana, 2, 3 y 5 días, y road trip por las cuatro regiones.')],
    },
  ];
  return groups.filter((g) => g.items.length);
}
