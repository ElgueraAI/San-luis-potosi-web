/**
 * "Qué hacer ahora" view model. Official recommendations come only from
 * seasonal-calendar.json records (each sourced); climate is attached
 * separately as modelled context and never turns into a recommendation.
 * The research notes on some records are English working notes, so the
 * visitor-facing line for each record is written here, in Spanish, from the
 * same sourced content.
 */
import { events as portalEvents, eventById, fmtConfirmed, STATUS_RANK, startDay } from './portal';
import { months, seasonRecords, getDestination, placeName, clean, SEASONS, MONTHS_ES, gastronomyFor, mapPlaces, seasonLocalities, hasMedia, type RegionId, type MapPlace } from './research';

const LINE: Record<string, { what: string; title?: string; photo?: string; nature?: string }> = {
  'se-tamul': { what: 'Temporada para apreciar la Cascada de Tamul: visita en panga y kayak por el río Tampaón.' },
  'se-el-naranjo': { what: 'Buena temporada para las cascadas de El Naranjo: natación, paddle, kayak, rapel, campismo y observación de fauna.' },
  'se-el-salto': { what: 'La Cascada El Salto es de temporada: corre en lluvias y en Semana Santa.' },
  'se-media-luna': { what: 'Media Luna: corrientes tranquilas, segura todo el año para nadar y bucear; también se puede acampar.' },
  'se-golondrinas': { what: 'Sótano de las Golondrinas y Hoya de las Huahuas: espeleología, senderismo y aves todo el año.', photo: 'La salida y entrada de las aves al amanecer y al atardecer.', nature: 'Loros y vencejos, sobre todo al amanecer y al caer la tarde.' },
  'se-procesion': { what: 'Semana Santa: la Procesión del Silencio inicia y termina en la Plaza del Carmen el Viernes Santo.', photo: 'Procesión nocturna en el Centro Histórico.' },
  'se-fenapo': { what: 'Feria Nacional Potosina (FENAPO) en la capital.' },
  'se-lila-lopez': { what: 'Festival Internacional de Danza Contemporánea Lila López, en la capital y otros municipios.' },
  'se-xantolo': { what: 'Xantolo, el Día de Muertos de la Huasteca: altares, comparsas y danzas tének y nahuas.' },
  'se-catorce-oct': { what: 'Real de Catorce: cada 4 de octubre, peregrinos veneran a San Francisco de Asís.' },
  'se-altiplano-clima': { what: 'Altiplano: verano muy soleado, caluroso y seco; invierno de frío extremo. Prepárate para el clima.' },
  'se-tlaxcala': { what: 'Barrio de Tlaxcala: fiestas de la Virgen de la Asunción.' },
  'se-tancanhuitz': { what: 'Tancanhuitz: fiestas patronales de San Miguel Arcángel.' },
  'se-xiiui': { what: "Ciudad del Maíz: Semana Santa indígena xi'iui." },
  'se-cerritos': { what: 'Cerritos: fiesta de San Juan Bautista y feria regional.' },
  'se-tolentino': { what: 'San Nicolás Tolentino: fiesta patronal.' },
  'se-tierra-nueva': { what: 'Tierra Nueva: jaripeos y bailes.' },
  'se-navidad-verde': { what: 'Navidad Verde: agenda navideña del Gobierno del Estado en plazas y templos del Centro Histórico de la capital.' },
  'se-la-taza': { what: '' },
};

export type RecView = {
  id: string; region: RegionId; what: string; title?: string; photo?: string; nature?: string; source: string;
  places: { id: string; name: string; slug: string | null; image: string | null; alt: string | null }[];
  months: number[];
};
export type EventView = { id: string; name: string; where: string; when: string; date2026: string | null; region: RegionId; slug: string; dest: string | null; months: number[]; status: string };

export const recViews: RecView[] = seasonRecords
  .filter((r) => r.verification_status === 'verified' && LINE[r.record_id]?.what)
  .map((r) => ({
    id: r.record_id,
    region: r.region as RegionId,
    ...LINE[r.record_id],
    source: r.source_id,
    months: r.months,
    places: String(r.destination).split('|').map((id) => {
      const d = getDestination(id);
      const card = d?.media.card ?? null;
      // a second photograph of the same place, used when the card repeats the stage
      const alt = [d?.media.experience, d?.media.detail, d?.media.hero, ...(d?.media.gallery ?? [])].find((g) => g && g !== card) ?? null;
      return { id, name: d?.name ?? placeName(id), slug: d?.slug ?? null, image: card, alt };
    }),
  }));

// Events come from the single normalized dataset (research/entities/events via portal.ts):
// the same records the Eventos calendar and the municipality pages use.
export const eventViews: EventView[] = portalEvents.map((e) => ({
  id: e.id,
  name: e.canonical_name,
  where: e.municipality ?? 'Varios municipios',
  when: e.date_pattern ?? '',
  date2026: e.date_status === 'CONFIRMED_CURRENT_YEAR' ? fmtConfirmed(e.confirmed_dates) : null,
  region: (e.region ?? 'centro') as RegionId,
  slug: e.slug!,
  dest: e.related_entities.find((id) => getDestination(id)) ?? null,
  months: e.months ?? [],
  status: e.date_status ?? 'DATE_PENDING',
}));

/**
 * Month storytelling. The theme of each month is decided by the audit in
 * docs/temporadas-auditoria.md (the source of truth for this table): the best
 * supported, most month-specific official record leads, and the photograph
 * follows that record. Every `rec` must be one of the month's verified
 * records, every image must be in the production set and no two months share
 * a photograph. `text` restates the record's sourced content in Spanish; dates
 * of a past edition are labelled as such. `points` are researched places or
 * INEGI localities; nothing is plotted without a stored coordinate.
 */
export type Confidence = 'VERIFIED' | 'PARTIAL' | 'NEEDS_RESEARCH';
/**
 * `tone` names the month's atmosphere (palette in SeasonModule): the story's
 * own colours, e.g. Xantolo marigold and ochre, December burgundy, pine and gold.
 */
export type Story = {
  tone: string; rec: string; image: string; focal?: string; caption: string;
  title: string; text: string; kind: string; where: string;
  points: string[]; confidence: Confidence;
};
export const STORY: Record<string, Story> = {
  m1: { tone: 'emerald', rec: 'se-tamul', image: 'px-11775031', caption: 'Pangas al pie de la Cascada de Tamul', confidence: 'VERIFIED',
    title: 'Tamul, en su mejor temporada', kind: 'Naturaleza · río y cascada', where: 'Aquismón', points: ['H01'],
    text: 'El folleto oficial de la Huasteca señala de noviembre a marzo como la mejor temporada para apreciar la Cascada de Tamul. Se llega en panga o en kayak por el río Tampaón.' },
  m2: { tone: 'turquoise', rec: 'se-el-naranjo', image: 'wc-98007105', focal: '50% 40%', caption: 'Cascada de Minas Viejas, El Naranjo', confidence: 'VERIFIED',
    title: 'Las cascadas de El Naranjo', kind: 'Naturaleza · agua', where: 'El Naranjo', points: ['H13', 'H14', 'H15'],
    text: 'De noviembre a marzo es buena temporada para Minas Viejas, El Meco y El Salto: natación, paddle, kayak, rapel, campismo y observación de fauna, según el folleto oficial de la Huasteca.' },
  m3: { tone: 'maiz', rec: 'se-xiiui', image: 'wc-72476536', caption: 'Iglesia del pueblo, Ciudad del Maíz', confidence: 'PARTIAL',
    title: "Semana Santa xi'iui en Ciudad del Maíz", kind: 'Tradición indígena', where: 'Ciudad del Maíz', points: ['M09'],
    text: 'Al mediodía, en el barrio de San José; por la tarde, la escenificación de la crucifixión (folleto oficial de la Zona Media). Cae en marzo o en abril, según la fecha de la Semana Santa.' },
  m4: { tone: 'procesion', rec: 'se-procesion', image: 'wc-21525467', caption: 'Plaza del Carmen, San Luis Potosí', confidence: 'VERIFIED',
    title: 'La Procesión del Silencio', kind: 'Tradición religiosa · nocturna', where: 'San Luis Potosí (capital)', points: ['C03'],
    text: 'El Viernes Santo por la noche, la procesión inicia y termina en la Plaza del Carmen, en el Centro Histórico. En 2026 fue el 3 de abril (Secretaría de Cultura del Estado).' },
  m5: { tone: 'manantial', rec: 'se-media-luna', image: 'wc-76389273', caption: 'Laguna de la Media Luna', confidence: 'PARTIAL',
    title: 'Agua clara en la Media Luna', kind: 'Naturaleza · manantial', where: 'Rioverde', points: ['M01'],
    text: 'Corrientes tranquilas, seguras todo el año para nadar y bucear; también se puede acampar (folleto oficial de la Zona Media). Las fuentes consultadas no señalan un evento propio de mayo.' },
  m6: { tone: 'feria-sol', rec: 'se-cerritos', image: 'wc-43676810', caption: 'Parroquia de San Juan Bautista, Cerritos', confidence: 'VERIFIED',
    title: 'San Juan Bautista en Cerritos', kind: 'Fiesta patronal y feria', where: 'Cerritos', points: ['MUN-CERRITOS'],
    text: 'Cada 24 de junio, fiesta patronal y feria regional: charrería, juegos mecánicos, pabellón gastronómico, carreras de caballos y exposición ganadera (folleto oficial de la Zona Media).' },
  m7: { tone: 'escena', rec: 'se-lila-lopez', image: 'wc-41833060', caption: 'Teatro de la Paz, San Luis Potosí', confidence: 'VERIFIED',
    title: 'Festival de Danza Lila López', kind: 'Festival cultural', where: 'San Luis Potosí y otros cinco municipios', points: ['C01'],
    text: 'Festival Internacional de Danza Contemporánea en la capital y en Matehuala, Santa María del Río, Soledad, Villa de Pozos y Villa de Reyes. La edición 46 fue del 24 de julio al 2 de agosto de 2026.' },
  m8: { tone: 'feria', rec: 'se-fenapo', image: 'wc-198070643', focal: '50% 60%', caption: 'Entrada a la Feria Nacional Potosina', confidence: 'VERIFIED',
    title: 'Feria Nacional Potosina', kind: 'Feria', where: 'San Luis Potosí (capital)', points: ['C01', 'C09'],
    text: 'La FENAPO, la feria del estado, en la capital; en 2026 fue del 7 al 30 de agosto. El mismo mes, el Barrio de Tlaxcala celebra a la Virgen de la Asunción.' },
  m9: { tone: 'textil', rec: 'se-tancanhuitz', image: 'wc-44351463', caption: 'Bordados de Tancanhuitz, Expo de los Pueblos Indígenas (Ciudad de México, 2015)', confidence: 'PARTIAL',
    title: 'San Miguel Arcángel en Tancanhuitz', kind: 'Fiesta patronal', where: 'Tancanhuitz', points: ['MUN-TANCANHUITZ', 'C13'],
    text: 'Fiestas patronales de septiembre en Tancanhuitz, en la Huasteca (folleto oficial). También en septiembre, jaripeos y bailes en Tierra Nueva, en el Centro.' },
  m10: { tone: 'desierto', rec: 'se-catorce-oct', image: 'wc-119874344', caption: 'Real de Catorce', confidence: 'VERIFIED',
    title: 'San Francisco en Real de Catorce', kind: 'Peregrinación', where: 'Catorce', points: ['A01'],
    text: 'Cada 4 de octubre, cientos de peregrinos veneran a San Francisco de Asís en Real de Catorce (Secretaría de Turismo). A fin de mes empieza el Xantolo en la Huasteca.' },
  m11: { tone: 'xantolo', rec: 'se-xantolo', image: 'wc-36732336', caption: 'Altar de Xantolo, Huasteca Potosina', confidence: 'VERIFIED',
    title: 'Xantolo, el Día de Muertos huasteco', kind: 'Tradición · patrimonio vivo', where: 'Huasteca (varios municipios)', points: ['MUN-TANCANHUITZ'],
    text: 'Altares, comparsas y danzas tének y nahuas. En 2025 fue del 29 de octubre al 2 de noviembre (Gobierno del Estado); las fechas de 2026 aún no son oficiales. El folleto de la Huasteca lo destaca en Tancanhuitz.' },
  m12: { tone: 'navidad', rec: 'se-navidad-verde', image: 'wc-50604762', caption: 'Catedral Metropolitana, una de las sedes', confidence: 'VERIFIED',
    title: 'Navidad Verde en el Centro Histórico', kind: 'Festival cultural · Navidad', where: 'San Luis Potosí (capital)', points: ['C01'],
    text: 'Agenda navideña del Gobierno del Estado: encendido del árbol, Nacimiento, pastorelas, conciertos y videomapping en plazas y templos del Centro Histórico. La edición 2025 fue del 1 de diciembre al 6 de enero; las fechas de 2026 aún no se anuncian.' },
};
// Seasons reuse a month's story with their own photograph, so a season never
// shows a month's image.
const SEASON_STORY: Record<string, { from: string; image: string; caption: string; tone: string }> = {
  's-primavera': { tone: 'spring', from: 'm4', image: 'wc-77789645', caption: 'Templo del Carmen, San Luis Potosí' },
  's-verano': { tone: 'summer', from: 'm7', image: 'wc-30504652', caption: 'Teatro de la Paz, San Luis Potosí' },
  's-otoño': { tone: 'desierto', from: 'm10', image: 'wc-119874435', caption: 'Real de Catorce desde el Pueblo Fantasma' },
  's-invierno': { tone: 'emerald', from: 'm1', image: 'wc-48806929', caption: 'Cascada de Tamul vista desde abajo' },
};

export type StoryView = Story & { recView: RecView; focus: MapPlace[] };
export type Panel = {
  key: string; title: string; months: number[]; recs: RecView[]; events: EventView[];
  /** the lead story: its record, photograph, copy and map points */
  story: StoryView | null;
  /** every plotted place named by this panel's records and events */
  places: MapPlace[];
  climate: { region: RegionId; tmax: number; tmin: number; precip: number; rainDays: number }[];
  dishes: { region: RegionId; dishes: string[] }[];
};

const REGIONS: RegionId[] = ['altiplano', 'centro', 'zona-media', 'huasteca'];
// researched places and INEGI localities, by id and (for localities) by name
const placeById = new Map<string, MapPlace>([
  ...mapPlaces.map((p) => [p.id, p] as [string, MapPlace]),
  ...seasonLocalities.flatMap((p) => [[p.id, p], [p.name, p]] as [string, MapPlace][]),
]);
export const plotted = (id: string): MapPlace | null => placeById.get(id) ?? null;

/** A record told as a story when no curated one applies (region pages). */
export function storyFromRec(r: RecView): StoryView {
  return {
    tone: r.region, rec: r.id, image: r.places.find((p) => p.image)?.image ?? '', caption: '', title: r.title ?? r.places[0]?.name ?? '',
    text: r.what, kind: '', where: '', points: r.places.map((p) => p.id), confidence: 'VERIFIED',
    recView: r, focus: r.places.map((p) => plotted(p.id)).filter((p): p is MapPlace => !!p),
  };
}

function panelFor(key: string, title: string, ms: number[]): Panel {
  const recIds = new Set(ms.flatMap((m) => months[m - 1].records));
  // most specific first: a record for one month says more about it than a year-round one
  const recs = recViews.filter((r) => recIds.has(r.id)).sort((a, b) => a.months.length - b.months.length);
  // confirmed first, then official patterns, history, pending; chronological inside each
  const evs = eventViews.filter((e) => e.months.some((m) => ms.includes(m)))
    .sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || startDay(eventById.get(a.id)!, ms[0]) - startDay(eventById.get(b.id)!, ms[0]));
  const climate = REGIONS.map((region) => {
    const cs = ms.map((m) => (months[m - 1].climate as Record<string, { tmax_mean_c: number; tmin_mean_c: number; precip_mm: number; rain_days: number }>)[region]);
    return {
      region,
      tmax: Math.max(...cs.map((c) => c.tmax_mean_c)),
      tmin: Math.min(...cs.map((c) => c.tmin_mean_c)),
      precip: Math.round(cs.reduce((a, c) => a + c.precip_mm, 0)),
      rainDays: Math.round(cs.reduce((a, c) => a + c.rain_days, 0)),
    };
  });
  const regionsWithRecs = [...new Set(recs.map((r) => r.region))];
  const dishes = regionsWithRecs
    .map((region) => ({ region, dishes: [...new Set(gastronomyFor(region).flatMap((g) => g.dishes))].slice(0, 6) }))
    .filter((d) => d.dishes.length);

  const ss = SEASON_STORY[key];
  const base: Story | undefined = ss ? { ...STORY[ss.from], image: ss.image, caption: ss.caption, tone: ss.tone, focal: undefined } : STORY[key];
  let story: StoryView | null = null;
  if (base) {
    const recView = recs.find((r) => r.id === base.rec);
    if (!recView) throw new Error(`seasons: ${key} leads with ${base.rec}, which is not one of its records`);
    if (!hasMedia(base.image)) throw new Error(`seasons: ${key} image ${base.image} is not in the production set`);
    const focus = base.points.map(plotted).filter((p): p is MapPlace => !!p);
    if (focus.length !== base.points.length) throw new Error(`seasons: ${key} names a point with no stored coordinate`);
    story = { ...base, recView, focus };
  }
  const ids = [...new Set([...recs.flatMap((r) => r.places.map((p) => p.id)), ...evs.map((e) => e.dest).filter((x): x is string => !!x)])];
  const places = ids.map(plotted).filter((p): p is MapPlace => !!p);
  return { key, title, months: ms, recs, events: evs, climate, dishes, story, places };
}

export const monthPanels: Panel[] = MONTHS_ES.map((name, i) => panelFor(`m${i + 1}`, name[0].toUpperCase() + name.slice(1), [i + 1]));
export const seasonPanels: Panel[] = SEASONS.map((s) => panelFor(`s-${s.id}`, s.label, [...s.months]));

// twelve months, twelve photographs
{
  const imgs = monthPanels.map((p) => p.story?.image);
  const dup = imgs.find((x, i) => x && imgs.indexOf(x) !== i);
  if (dup) throw new Error(`seasons: photograph ${dup} leads more than one month`);
}
