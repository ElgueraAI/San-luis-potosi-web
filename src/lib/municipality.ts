/** Syntax guard only: catalogue membership and temporal compatibility require ETL validation. */
export const validMunicipalityKey = (value: unknown): value is string =>
  typeof value === 'string' && /^24\d{3}$/.test(value) && value !== '24000';

/** Unknown keys never establish territorial membership, even when both are null. */
export const sameMunicipality = (left: unknown, right: unknown): boolean =>
  validMunicipalityKey(left) && validMunicipalityKey(right) && left === right;

/** Published destinations inherit membership only from their keyed source row. */
export function municipalDestinations<T extends { id: string }>(
  destinations: T[], sourceRows: { id: string; municipality_id?: string | null }[], municipalityId: unknown,
): T[] {
  const keys = new Map(sourceRows.map((row) => [row.id, row.municipality_id]));
  return destinations.filter((destination) => sameMunicipality(keys.get(destination.id), municipalityId));
}
