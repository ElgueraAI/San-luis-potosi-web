import { getEntry, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

export type MediaSlot = CollectionEntry<'media'>['data'];

/** Every optimizable image under src/assets/media, keyed by its path there. */
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/media/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

export function resolveImage(path: string | null | undefined): ImageMetadata | null {
  if (!path) return null;
  const key = `/src/assets/media/${path.replace(/^\//, '')}`;
  const mod = images[key];
  if (!mod) throw new Error(`Media file not found: ${key}. Check src in src/content/media.yaml.`);
  return mod.default;
}

export async function getSlot(id: string): Promise<MediaSlot> {
  const entry = await getEntry('media', id);
  if (!entry) throw new Error(`Unknown media slot "${id}". Add it to src/content/media.yaml.`);
  return entry.data;
}
