// Pure, offline integrity rules shared by the original builder and mission 03.
export const isValidMunicipalityId = (value) => typeof value === 'string' && /^24\d{3}$/.test(value) && value !== '24000';
export const validMunicipalityJoin = (left, right) => isValidMunicipalityId(left) && isValidMunicipalityId(right) && left === right;

export function coordinateIssues(latitude, longitude) {
  if (latitude == null && longitude == null) return [];
  if (latitude == null || longitude == null) return ['incomplete_coordinate_pair'];
  if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return ['invalid_coordinate'];
  if (latitude < 21.11 || latitude > 24.54 || longitude < -102.35 || longitude > -98.28) return ['outside_slp_bbox'];
  return [];
}

export function validateRows(rows, municipalityIds, sourceIds) {
  const frequency = new Map();
  for (const row of rows) if (row.id != null) frequency.set(row.id, (frequency.get(row.id) ?? 0) + 1);
  return rows.map((row, index) => {
    const reasons = [];
    if (typeof row.id !== 'string' || !row.id.trim()) reasons.push('missing_id');
    else if (frequency.get(row.id) > 1) reasons.push('duplicate_id');
    if (typeof row.canonical_name !== 'string' || !row.canonical_name.trim()) reasons.push('missing_name');
    if (!isValidMunicipalityId(row.municipality_id)) reasons.push('invalid_or_missing_municipality_id');
    else if (!municipalityIds.has(row.municipality_id)) reasons.push('unmatched_municipality_id');
    if (!Array.isArray(row.source_ids) || !row.source_ids.length) reasons.push('missing_source');
    for (const source of row.source_ids ?? []) {
      if (typeof source !== 'string' || !source.trim()) reasons.push('null_or_invalid_source_reference');
      else if (!sourceIds.has(source)) reasons.push('unresolved_source_reference');
    }
    for (const id of row.related_entities ?? []) if (!rows.some((candidate) => candidate.id === id)) reasons.push('unresolved_entity_reference');
    reasons.push(...coordinateIssues(row.latitude, row.longitude));
    if ((row.months ?? []).some((month) => !Number.isInteger(month) || month < 1 || month > 12)) reasons.push('invalid_month');
    const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    for (const field of ['last_verified', 'start_date', 'end_date']) if (row[field] != null && !validDate(row[field])) reasons.push(`invalid_${field}`);
    if (row.start_date && row.end_date && row.start_date > row.end_date) reasons.push('reversed_event_dates');
    return { index, reasons: [...new Set(reasons)] };
  });
}

export function aggregateMunicipalities(rows, municipalities) {
  return municipalities.map((municipality) => {
    const key = municipality.municipality_id;
    const members = rows.filter((row) => row.entity_type !== 'municipality' && validMunicipalityJoin(row.municipality_id, key));
    const count = (predicate) => isValidMunicipalityId(key) ? members.filter(predicate).length : null;
    const related_entities = members.filter((row) => row.entity_type === 'destination').map((row) => row.id);
    return {
      municipality_id: key, related_entities,
      counts: {
        destinations: count((row) => row.entity_type === 'destination'),
        museums: count((row) => row.entity_type === 'museum' && row.source_ids?.[0]?.startsWith('sic')),
        venues: count((row) => row.entity_type === 'cultural-venue'),
        archaeology: count((row) => row.entity_type === 'archaeological-site'),
        events: count((row) => row.entity_type === 'event'),
        seasonal: count((row) => row.entity_type === 'seasonal-experience'),
        lodging: count((row) => row.entity_type === 'lodging'),
        food: count((row) => ['food', 'cafe', 'drink'].includes(row.entity_type)),
        protected_areas: count((row) => row.entity_type === 'protected-area'),
      },
    };
  });
}
