import { getCollection, type CollectionEntry } from 'astro:content';
import { profile, type Boundary } from '@/data/geo';

export type Region = CollectionEntry<'regions'>['data'];
export type RegionWithBounds = Region & { bounds: Boundary };

/** All four regions in line order (west to east, high to low). */
export async function getRegions(): Promise<RegionWithBounds[]> {
  const entries = await getCollection('regions');
  return entries
    .map((e) => e.data)
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      const bounds = profile.boundaries.find((b) => b.region === r.id);
      if (!bounds) throw new Error(`No profile boundary for region "${r.id}"`);
      return { ...r, bounds };
    });
}
