/** Presentation only. Publication rules and M03 calculations remain in their adapters. */
import { getSource, sourceLabel, sourceUrl, MONTHS_ES, type Destination } from '@/data/research';
import { attractionsAll, muniById, REGION_LABEL, ACCESS, DATE_STATUS, type Entity } from '@/data/portal';
import { muniHref, regionHref } from '@/i18n/routes';
import { validMunicipalityKey } from './municipality';

export type FactState = 'OBSERVADO' | 'DERIVADO' | 'PENDIENTE DE VERIFICACIÓN' | 'NO DISPONIBLE';
export type FactIcon = 'pin' | 'compass' | 'landmark' | 'calendar' | 'clock' | 'route' | 'ticket' | 'info' | 'camera';
export interface FactSource { id: string; label: string; url: string | null; date: string | null }
export interface PlaceFact { key: string; label: string; value: string; icon: FactIcon; state: FactState; sources: FactSource[]; note?: string; valueHref?: string }
export interface PlaceFacts { id: string; name: string; fields: PlaceFact[]; sources: FactSource[]; limits: string[] }
type FieldEvidence = { source?: string; verifiedAt?: string; note?: string; status?: string };
type DestinationEvidence = { place_id: string; region?: FieldEvidence; municipality?: FieldEvidence; pueblo_magico?: FieldEvidence; description?: FieldEvidence; season?: FieldEvidence; facts?: Record<string, FieldEvidence>; coordinates?: { source_url?: string; coordinate_source?: string; precision?: string } };
// Only public normalized destination documents; never research/raw.
const evidence = Object.values(import.meta.glob<DestinationEvidence>('/research/destinations/[ACHM][0-9][0-9].json', { eager: true, import: 'default' }));
export const municipalityForDestination = (id: string) => {
  const key = attractionsAll.find((e) => e.id === id)?.municipality_id;
  return validMunicipalityKey(key) ? muniById.get(key) ?? null : null;
};
function source(id: string, date?: string | null, url?: string | null): FactSource {
  const s = getSource(id);
  return { id, label: sourceLabel(id) || id, url: url ?? sourceUrl(id), date: date ?? s?.retrieval_date ?? null };
}
const observed = (sources: FactSource[], explicit = false): FactState => explicit && sources.some((s) => s.url) ? 'OBSERVADO' : 'PENDIENTE DE VERIFICACIÓN';
const iconFor = (key: string): FactIcon => /hour|horario/.test(key) ? 'clock' : /price|admission/.test(key) ? 'ticket' : /since|date|founded/.test(key) ? 'calendar' : /access/.test(key) ? 'route' : /magico|heritage|histor/.test(key) ? 'landmark' : 'info';
const ENTITY_TYPE_LABEL: Readonly<Record<string, string>> = {
  'archaeological-site': 'Sitio arqueológico', cafe: 'Cafetería', 'cultural-venue': 'Recinto cultural',
  destination: 'Destino', drink: 'Bebidas', event: 'Evento', food: 'Gastronomía',
  'heritage-declaration': 'Declaratoria patrimonial', lodging: 'Hospedaje', mobility: 'Movilidad',
  municipality: 'Municipio', museum: 'Museo', nightlife: 'Vida nocturna', 'protected-area': 'Área natural protegida',
  recreation: 'Recreación', 'religious-landmark': 'Patrimonio religioso', 'route-set': 'Conjunto de rutas',
  'seasonal-experience': 'Experiencia de temporada', service: 'Servicio',
};

export function destinationFacts(d: Destination): PlaceFacts {
  const raw = evidence.find((e) => e.place_id === d.id);
  const fields: PlaceFact[] = [];
  const add = (key: string, label: string, value: string | null, icon: FactIcon, ev?: FieldEvidence, editorial = false) => {
    if (!value) return;
    const sources = ev?.source ? [source(ev.source, ev.verifiedAt)] : [];
    fields.push({ key, label, value, icon, sources, state: editorial ? 'DERIVADO' : observed(sources, ev?.status === 'verified'), note: ev?.note });
  };
  add('region', 'Región', REGION_LABEL[d.region], 'compass', raw?.region);
  add('municipality', 'Municipio', d.municipality, 'pin', raw?.municipality);
  if (!d.puebloMagico) add('kind', 'Tipo de lugar', d.kind, 'camera', undefined, true);
  if (d.puebloMagico) add('distinction', 'Distinción', 'Pueblo Mágico', 'landmark', raw?.pueblo_magico);
  for (const f of d.facts) add(f.key, f.label, f.value, iconFor(f.key), { ...raw?.facts?.[f.key], source: f.source });
  add('description', 'Descripción', d.description, 'info', d.descriptionSource === 'neutral' ? undefined : { ...raw?.description, source: d.descriptionSource }, d.descriptionSource === 'neutral');
  add('season', 'Temporada documentada', d.season?.value ?? null, 'calendar', raw?.season);
  d.access.forEach((a, i) => add(`access-${i}`, 'Visita documentada', a.value, 'route', { source: a.source }, false));
  if (d.gastronomy.length) add('gastronomy', 'Gastronomía documentada', d.gastronomy.join(', '), 'info', raw?.facts?.gastronomy);
  const regionField = fields.find((f) => f.key === 'region'); if (regionField) regionField.valueHref = regionHref(d.region);
  const municipalField = fields.find((f) => f.key === 'municipality'); const municipality = municipalityForDestination(d.id);
  if (municipalField && municipality?.slug) municipalField.valueHref = muniHref(municipality.slug);
  if (d.coords) {
    const ev = raw?.coordinates;
    fields.push({ key: 'coordinates', label: 'Coordenadas', value: `${d.coords[1]}, ${d.coords[0]}`, icon: 'pin', state: 'PENDIENTE DE VERIFICACIÓN', sources: ev?.source_url ? [{ id: 'coordinates', label: ev.coordinate_source ?? 'Fuente de coordenadas', url: ev.source_url, date: null }] : [], note: `${d.mapStatus === 'ready' ? 'Punto oficial publicado' : 'Punto aproximado'}${ev?.precision ? ` · precisión: ${ev.precision}` : ''}; no representa un acceso ni una ruta de manejo.` });
  }
  return { id: d.id, name: d.name, fields, sources: d.officialSources.map((id) => source(id)), limits: [...d.disputed, ...(d.ethics ? [d.ethics] : []), 'La documentación describe lo consultado; horarios, precios, actividades y accesos requieren confirmación actual antes de viajar.', ...(!d.coords ? ['No hay coordenadas publicables para este lugar.'] : [])] };
}

export function entityFacts(e: Entity): PlaceFacts {
  const sources = (e.source_ids ?? []).filter((id): id is string => typeof id === 'string' && !!id.trim()).map((id) => source(id, e.last_verified));
  const fields: PlaceFact[] = [];
  const add = (key: string, label: string, value: unknown, icon: FactIcon = iconFor(key), ids?: string[], stable = false) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return;
    const refs = ids ? ids.map((id) => source(id, e.last_verified)) : sources;
    fields.push({ key, label, value: Array.isArray(value) ? value.join(' · ') : typeof value === 'boolean' ? value ? 'Sí' : 'No' : String(value), icon, sources: refs, state: observed(refs, stable && e.verification_status === 'verified'), note: stable ? undefined : 'Procedencia del registro; la fuente no acredita por sí sola la vigencia de este campo.' });
  };
  const municipal = e.entity_type === 'municipality';
  if (e.region) add('region', 'Región', REGION_LABEL[e.region], 'compass', municipal ? ['pdu-slp'] : undefined, municipal);
  const key = municipal ? e.id : e.municipality_id;
  const municipality = validMunicipalityKey(key) ? muniById.get(key) : null;
  add('municipality', 'Municipio', municipality?.canonical_name ?? e.municipality, 'pin');
  add('category', 'Categoría del catálogo', e.subcategory ?? ENTITY_TYPE_LABEL[e.entity_type] ?? e.entity_type, 'camera');
  if (validMunicipalityKey(key)) add('municipality-key', 'Clave municipal', key, 'pin');
  add('seat', 'Cabecera', e.seat?.name, 'pin', ['inegi-iter-2020'], true);
  add('population', 'Población · Censo 2020', e.population_2020?.toLocaleString('es-MX'), 'info', ['inegi-iter-2020'], true);
  add('altitude', 'Altitud de la cabecera', e.seat?.altitude_m != null ? `${e.seat.altitude_m} m` : null, 'pin', ['inegi-iter-2020'], true);
  add('alternate', 'Otros nombres registrados', e.alternate_names);
  add('locality', 'Localidad', e.locality, 'pin');
  add('description', 'Descripción', e.short_description);
  const extended = e as Entity & { seasonality?: string | null; long_description?: string | null; activities?: string[]; accessibility?: string | null; recommended_duration?: string | null };
  add('seasonality', 'Temporada documentada', extended.seasonality, 'calendar');
  add('long-description', 'Información ampliada', extended.long_description);
  add('activities', 'Actividades documentadas', extended.activities, 'camera');
  add('accessibility', 'Accesibilidad documentada · confirmar vigencia', extended.accessibility, 'route');
  add('duration', 'Duración documentada', extended.recommended_duration, 'clock');
  add('history', 'Contexto histórico', e.historical_context, 'landmark');
  add('access', 'Acceso documentado', e.access_status ? ACCESS[e.access_status] ?? e.access_status : null, 'route');
  add('opening_hours', 'Horario documentado · confirmar vigencia', e.opening_hours, 'clock');
  add('price', 'Costo documentado · confirmar vigencia', e.price, 'ticket');
  add('date-status', 'Estado de las fechas', e.date_status ? DATE_STATUS[e.date_status]?.label ?? e.date_status : null, 'calendar');
  add('dates', 'Fechas de la edición documentada', e.confirmed_dates, 'calendar');
  add('pattern', 'Patrón documental · no confirma próxima edición', e.date_pattern, 'calendar');
  add('months', 'Meses registrados', e.months?.map((m) => MONTHS_ES[m - 1]), 'calendar');
  add('start', 'Inicio documentado', e.start_date, 'calendar');
  add('end', 'Fin documentado', e.end_date, 'calendar');
  add('recurrence', 'Recurrencia documentada', e.recurrence_rule, 'calendar');
  add('season', 'Ventana estacional', e.seasonal_window?.label, 'calendar');
  add('venue', 'Sede', e.venue, 'pin');
  add('culture', 'Contexto cultural', e.cultural_context, 'landmark');
  add('services', 'Servicios documentados', e.services);
  add('site-museum', 'Museo de sitio', e.site_museum, 'landmark');
  add('address', 'Dirección publicada', e.official_contact?.address, 'pin');
  add('phone', 'Teléfono publicado', e.official_contact?.phone);
  add('responsible', 'Responsable publicado', e.official_contact?.responsible);
  add('operator', 'Operador', e.operator);
  add('founded', 'Fundación', e.founded, 'calendar');
  add('capacity', 'Capacidad documentada', e.capacity);
  add('travel', 'Notas de visita', e.travel_notes);
  add('notes', 'Limitaciones documentales', e.notes);
  if (e.denue) { add('registry', 'Registro DENUE', e.denue.id); add('activity', 'Actividad registrada', e.denue.activity); add('registered', 'Fecha de registro', e.denue.registered, 'calendar'); add('staff', 'Estrato de personal', e.denue.staff); }
  if (Number.isFinite(e.latitude) && Number.isFinite(e.longitude)) add('coordinates', `Coordenadas · ${e.coordinate_status}`, `${e.latitude}, ${e.longitude}`, 'pin');
  const regionField = fields.find((f) => f.key === 'region'); if (regionField && e.region) regionField.valueHref = regionHref(e.region);
  const municipalField = fields.find((f) => f.key === 'municipality'); if (municipalField && municipality?.slug && !municipal) municipalField.valueHref = muniHref(municipality.slug);
  return { id: e.id ?? `municipality-${e.slug}`, name: e.canonical_name, fields, sources: e.official_url ? [...sources, { id: 'record-url', label: 'Página oficial del registro', url: e.official_url, date: e.last_verified }] : sources, limits: [municipal && !validMunicipalityKey(e.id) ? 'Sin clave comparable del universo M03: no se atribuyen indicadores ni registros mediante claves nulas. Existen 59 páginas municipales y 58 claves comparables.' : 'El inventario documental no representa afluencia ni confirma operación actual.', ...(!sources.some((s) => s.url) ? ['Procedencia sin enlace resoluble: pendiente de verificación.'] : []), ...(!e.opening_hours && !municipal ? ['[NO DISPONIBLE] Horario: no disponible en el registro.'] : []), ...(!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude) ? ['[NO DISPONIBLE] Coordenadas: no disponibles.'] : [])] };
}
