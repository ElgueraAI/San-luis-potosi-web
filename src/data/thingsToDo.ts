/**
 * "Qué hacer": the thematic discovery tree (categories → subcategories), used
 * by the hierarchical menu and by /que-hacer/ pages. Every subcategory is
 * resolved from data: researched destinations (by their editorial interest
 * tags or ids) and normalized entities (museums, venues, events, protected
 * areas, archaeology, food). A subcategory with no data is dropped, so the
 * menu never links to an empty page. Category lede lines describe the theme;
 * facts live in the items.
 */
import { destinations, gastronomyFor, type Destination, type RegionId } from './research';
import { museums, venues, events, protectedAreas, heritageDeclarations, cathedrals, archaeology, food, recreation, municipalities, type Entity } from './portal';

export type Sub = {
  id: string; label: string; intro: string;
  dests: Destination[]; items: Entity[];
  /** text blocks for subcategories that are knowledge, not places (regional dishes) */
  notes?: { title: string; region?: RegionId; text: string; source: string }[];
  more?: { label: string; route: 'museums' | 'food' | 'events' | 'archaeology' | 'municipalities'; query?: string };
};
export type Cat = { id: string; label: string; short: string; lede: string; image: string; tone: string; subs: Sub[] };

const tag = (...t: string[]) => (d: Destination) => d.tags.some((x) => t.includes(x));
const ids = (...i: string[]) => (d: Destination) => i.includes(d.id);
const kind = (re: RegExp) => (d: Destination) => re.test(d.kind) || re.test(d.name);
const D = (f: (d: Destination) => boolean) => destinations.filter(f);
const ev = (re: RegExp) => events.filter((e) => re.test(`${e.canonical_name} ${e.subcategory ?? ''}`));

const CATS: Cat[] = [
  {
    id: 'naturaleza', label: 'Naturaleza y aire libre', short: 'Naturaleza', tone: 'huasteca', image: 'px-14842050',
    lede: 'Cascadas turquesa, sótanos, manantiales, sierras y desierto: el estado de punta a punta, del nivel del mar casi a los tres mil metros.',
    subs: [
      { id: 'cascadas', label: 'Cascadas y agua', intro: 'Cascadas, ríos y pozas, sobre todo en la Huasteca.', dests: D(tag('cascadas')), items: [] },
      { id: 'senderismo', label: 'Senderismo', intro: 'Caminos de sierra y paisaje señalados por las fuentes oficiales.', dests: D(tag('senderismo')), items: [] },
      { id: 'sierras', label: 'Sierras y montañas', intro: 'Sierras con declaratoria de protección y paisajes de montaña.', dests: D(ids('A04', 'C14')), items: protectedAreas.filter((p) => /Sierra|Potos[ií]|Abra/i.test(p.canonical_name)) },
      { id: 'cuevas', label: 'Cuevas y sótanos', intro: 'Simas, grutas y cuevas, de los sótanos de Aquismón a las grutas del Altiplano.', dests: D((d) => tag('cuevas', 'espeleologia')(d) || kind(/cueva|gruta|s[óo]tano|sima/i)(d)), items: protectedAreas.filter((p) => /S[óo]tano|Hoya|Cuevas/i.test(p.canonical_name)) },
      { id: 'parques', label: 'Parques y áreas protegidas', intro: 'Áreas naturales protegidas, parques estatales y monumentos naturales registrados por la Secretaría de Cultura (SIC).', dests: [], items: protectedAreas },
      { id: 'observacion', label: 'Observación de naturaleza', intro: 'Aves, fauna y paisaje.', dests: D(tag('aves', 'paisaje', 'desierto')), items: [] },
      { id: 'manantiales', label: 'Manantiales', intro: 'Agua clara para nadar y bucear, sobre todo en la Zona Media.', dests: D((d) => kind(/manantial|cenote|poza|taza/i)(d) || tag('buceo', 'natacion')(d)), items: [] },
      { id: 'aventura', label: 'Aventura', intro: 'Kayak, rapel, escalada, cabalgata y bicicleta.', dests: D(tag('aventura', 'kayak', 'rafting', 'escalada', 'cabalgata', 'ciclismo', 'paddle')), items: [] },
    ],
  },
  {
    id: 'cultura', label: 'Cultura y tradición', short: 'Cultura', tone: 'heritage', image: 'wc-21612508',
    lede: 'Pueblos tének, nahuas y xi’iui, fiestas patronales, Xantolo y oficios que siguen vivos.',
    subs: [
      { id: 'indigenas', label: 'Tradiciones indígenas', intro: 'Prácticas de los pueblos originarios registradas por la Secretaría de Cultura y los folletos oficiales.', dests: D(tag('cultura-teenek', 'xi-iuy')), items: ev(/xi.?\s?[uú]i|t[ée]nek|Wirikuta|Chichimeca|Mijca/i) },
      { id: 'xantolo', label: 'Xantolo', intro: 'El Día de Muertos de la Huasteca: altares, comparsas y danzas.', dests: D(tag('xantolo')), items: ev(/Xantolo|Todos Santos/i) },
      { id: 'artesanias', label: 'Artesanías', intro: 'Talleres y casas de artesanía.', dests: D(tag('artesania')), items: venues.filter((v) => /artesan/i.test(v.subcategory ?? '')) },
      { id: 'rebozo', label: 'Rebozo', intro: 'El rebozo de seda de Santa María del Río.', dests: D(tag('textiles')), items: [] },
      { id: 'musica-danza', label: 'Música y danza', intro: 'Festivales y teatros donde se presentan.', dests: D(tag('artes-escenicas')), items: [...ev(/Danza|Jazz|M[úu]sica|[ÓO]pera|Flamenco/i), ...venues.filter((v) => v.subcategory === 'Teatro').slice(0, 12)] },
      { id: 'fiestas', label: 'Fiestas tradicionales', intro: 'Fiestas patronales, ferias y peregrinaciones con fuente oficial.', dests: [], items: ev(/Fiesta|Feria|Peregrin|Veneraci|Jaripeo|Procesi/i) },
      { id: 'patrimonio-vivo', label: 'Patrimonio vivo', intro: 'Declaratorias de patrimonio cultural registradas en el SIC.', dests: D(tag('cultura-viva')), items: heritageDeclarations },
    ],
  },
  {
    id: 'gastronomia', label: 'Gastronomía', short: 'Gastronomía', tone: 'sand', image: 'wc-105308560',
    lede: 'Zacahuil y enchiladas huastecas, cabrito del Altiplano, enchiladas potosinas: cada región en la mesa.',
    subs: [
      ...(['huasteca', 'altiplano', 'zona-media', 'centro'] as RegionId[]).map((r) => ({
        id: `cocina-${r}`, label: `Cocina ${r === 'zona-media' ? 'de la Zona Media' : r === 'centro' ? 'del Centro' : r === 'altiplano' ? 'del Altiplano' : 'huasteca'}`,
        intro: 'Platillos que el folleto oficial de la región asocia a sus destinos.',
        dests: D((d) => d.region === r && tag('gastronomia')(d)), items: [],
        notes: gastronomyFor(r).filter((g) => g.dishes.length).map((g) => ({ title: g.place ?? 'Región', region: r, text: g.dishes.join(', '), source: 'Folleto oficial, Secretaría de Turismo de SLP' })),
      })),
      { id: 'cafe', label: 'Café', intro: 'Cafeterías registradas (DENUE y directorio oficial) y destinos ligados al café.', dests: D(tag('cafe')), items: food.filter((f) => f.entity_type === 'cafe').slice(0, 12), more: { label: 'Todas las cafeterías', route: 'food', query: 'tipo=cafe' } },
      { id: 'mezcal', label: 'Mezcal y bebidas', intro: 'Rutas del mezcal y productores de bebidas tradicionales registrados en DENUE.', dests: D(ids('A12')), items: food.filter((f) => f.entity_type === 'drink') },
      { id: 'restaurantes', label: 'Restaurantes', intro: 'Directorio por municipio: listados oficiales primero; registros DENUE como referencia.', dests: [], items: food.filter((f) => f.official_directory && f.entity_type === 'food').slice(0, 12), more: { label: 'Directorio de gastronomía', route: 'food' } },
    ],
  },
  {
    id: 'arte-museos', label: 'Arte y museos', short: 'Arte', tone: 'heritage', image: 'wc-79606411',
    lede: 'Del surrealismo de Edward James y Leonora Carrington a museos en todo el estado.',
    subs: [
      { id: 'museos', label: 'Museos', intro: `${museums.length} museos registrados por la Secretaría de Cultura en el estado.`, dests: D(tag('museos')), items: museums.slice(0, 12), more: { label: 'Catálogo de museos', route: 'museums' } },
      { id: 'arte-contemporaneo', label: 'Arte contemporáneo', intro: 'Museos y centros de arte.', dests: D(ids('C07')), items: museums.filter((m) => /Arte/i.test(m.subcategory ?? '')) },
      { id: 'leonora-carrington', label: 'Leonora Carrington y el surrealismo', intro: 'Las Pozas en Xilitla y los museos dedicados a Leonora Carrington.', dests: D(tag('surrealismo')), items: museums.filter((m) => /Carrington/i.test(m.canonical_name)) },
      { id: 'arquitectura', label: 'Arquitectura', intro: 'Cantera, barroco y arquitectura civil.', dests: D(tag('arquitectura', 'barroco')), items: [] },
      { id: 'galerias', label: 'Galerías', intro: 'Galerías registradas en el SIC.', dests: [], items: venues.filter((v) => v.subcategory === 'Galería') },
      { id: 'centros-culturales', label: 'Centros culturales', intro: 'Centros culturales registrados en el SIC.', dests: [], items: venues.filter((v) => v.subcategory === 'Centro cultural') },
    ],
  },
  {
    id: 'historia', label: 'Historia y patrimonio', short: 'Historia', tone: 'stone', image: 'wc-12418759',
    lede: 'Reales de minas, haciendas, centros históricos y templos de cantera.',
    subs: [
      { id: 'centros-historicos', label: 'Centros históricos', intro: 'Centros de ciudades y pueblos con patrimonio edificado.', dests: D(kind(/Centro Hist[óo]rico|Centro –|– Centro/i)), items: [] },
      { id: 'mineria', label: 'Minería', intro: 'Reales de minas y pueblos mineros.', dests: D(tag('mineria')), items: [] },
      { id: 'haciendas', label: 'Haciendas', intro: 'Haciendas históricas.', dests: D(tag('haciendas')), items: [] },
      { id: 'arquitectura-religiosa', label: 'Arquitectura religiosa', intro: 'Catedrales, templos y santuarios.', dests: D((d) => tag('fe')(d) || kind(/religios|Templo|Catedral|Convento|Santuario|Parroquia/i)(d)), items: cathedrals },
      { id: 'monumentos', label: 'Monumentos y patrimonio', intro: 'Sitios de patrimonio histórico.', dests: D(tag('patrimonio', 'historia')), items: [] },
    ],
  },
  {
    id: 'arqueologia', label: 'Arqueología', short: 'Arqueología', tone: 'heritage', image: 'wc-60066386',
    lede: 'La Huasteca prehispánica: Tamtoc y Tamohí, abiertas al público según el INAH, y sitios documentados.',
    subs: [
      { id: 'zonas', label: 'Zonas arqueológicas', intro: 'Estado de acceso según el INAH; un sitio documentado no se presenta como visitable.', dests: D(tag('arqueologia')), items: archaeology, more: { label: 'Arqueología en San Luis Potosí', route: 'archaeology' } },
    ],
  },
  {
    id: 'pueblos-ciudades', label: 'Pueblos y ciudades', short: 'Pueblos', tone: 'stone', image: 'wc-58118619',
    lede: 'Pueblos Mágicos, ciudades base y los 59 municipios del estado.',
    subs: [
      { id: 'pueblos-magicos', label: 'Pueblos Mágicos', intro: 'Destinos con nombramiento de Pueblo Mágico verificado en la investigación.', dests: destinations.filter((d) => d.puebloMagico), items: [] },
      { id: 'ciudades', label: 'Ciudades', intro: 'Municipios con más de 50 mil habitantes (INEGI, Censo 2020).', dests: D(tag('ciudad-base')), items: municipalities.filter((m) => (m.population_2020 ?? 0) > 50000).sort((a, b) => (b.population_2020 ?? 0) - (a.population_2020 ?? 0)), more: { label: 'Los 59 municipios', route: 'municipalities' } },
    ],
  },
  {
    id: 'descanso', label: 'Relax y descanso', short: 'Descanso', tone: 'mist', image: 'wc-76389273',
    lede: 'Manantiales, aguas termales y balnearios para bajar el ritmo.',
    subs: [
      { id: 'manantiales-y-termales', label: 'Manantiales y aguas termales', intro: 'Agua tranquila para nadar.', dests: D((d) => tag('aguas-termales', 'natacion', 'buceo')(d) || kind(/manantial|taza/i)(d)), items: [] },
      { id: 'balnearios', label: 'Balnearios y parques acuáticos', intro: 'Registrados en DENUE (INEGI). No es una recomendación: confirma antes de viajar.', dests: [], items: recreation.filter((r) => /balneario|acu[áa]tico/i.test(r.subcategory ?? '')) },
    ],
  },
  {
    id: 'vida-nocturna', label: 'Vida nocturna', short: 'Noche', tone: 'night', image: 'wc-50604762',
    lede: 'Bares, cantinas y centros nocturnos registrados. Sin calificaciones: solo datos públicos.',
    subs: [
      { id: 'bares', label: 'Bares y centros nocturnos', intro: 'Listados oficiales (Estadía) y registros DENUE de 6 o más empleados. No es una recomendación.', dests: [], items: food.filter((f) => f.entity_type === 'nightlife').sort((a, b) => Number(!!b.official_directory) - Number(!!a.official_directory)).slice(0, 18), more: { label: 'Directorio completo', route: 'food', query: 'tipo=nightlife' } },
    ],
  },
  {
    id: 'destacados', label: 'Destacados', short: 'Destacados', tone: 'neutral', image: 'wc-69780780',
    lede: 'Los destinos prioritarios de la investigación, uno o más por región.',
    subs: [
      { id: 'imperdibles', label: 'Imperdibles', intro: 'Destinos de prioridad A en la investigación.', dests: destinations.filter((d) => d.priority === 'A'), items: [] },
    ],
  },
];

export const THINGS: Cat[] = CATS.map((c) => ({ ...c, subs: c.subs.filter((s) => s.dests.length || s.items.length || s.notes?.length) }));
export const thingCat = (id: string) => THINGS.find((c) => c.id === id) ?? null;
