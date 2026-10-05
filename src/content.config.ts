import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { fact } from './lib/fact';

/** Spanish is required everywhere; English is filled in later. */
export const l10n = z.object({ es: z.string().min(1), en: z.string().min(1).optional() });

export const regionIds = ['altiplano', 'centro', 'zona-media', 'huasteca'] as const;
export const regionId = z.enum(regionIds);

const sources = defineCollection({
  loader: file('src/content/sources.yaml'),
  schema: z.object({
    id: z.string(),
    institution: z.string(),
    document: z.string(),
    url: z.url().optional(),
    retrievedAt: z.string().optional(),
    status: z.enum(['requested', 'received', 'approved']),
  }),
});

const regions = defineCollection({
  loader: glob({ pattern: '*.yaml', base: 'src/content/regions' }),
  schema: z.object({
    id: regionId,
    order: z.number().int().min(1).max(4),
    published: z.boolean(),
    name: l10n,
    nameInSentence: l10n,
    officialName: l10n,
    keywords: z.array(l10n).min(3),
    ground: z.enum(['dark', 'light']),
    transition: z.enum(['shadow', 'arch', 'waterline', 'curtain']),
    light: l10n,
    anchor: z.enum(['lead', 'trail', 'center', 'split']),
    descent: z.object({
      lede: l10n,
      fill: z.string(),
    }),
    altitudeRange: fact(z.tuple([z.number(), z.number()])),
    municipalities: fact(z.array(z.string())),
  }),
});

const mediaRegion = z.enum([...regionIds, 'global']);

const media = defineCollection({
  loader: file('src/content/media.yaml'),
  schema: z
    .object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      kind: z.enum(['image', 'video', 'plane']),
      region: mediaRegion,
      role: z.string(),
      aspect: z.object({ desktop: z.string(), mobile: z.string().optional() }),
      focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).default({ x: 0.5, y: 0.5 }),
      subject: l10n,
      alt: l10n.optional(),
      decorative: z.boolean().default(false),
      src: z.object({ desktop: z.string().nullable(), mobile: z.string().nullable().optional() }),
      credit: z.string().optional(),
      license: z.string().optional(),
      status: z.enum(['placeholder', 'provided', 'approved']),
    })
    .refine((m) => m.status !== 'approved' || ((m.decorative || !!m.alt) && !!m.credit && !!m.license), {
      message: 'An approved slot needs Spanish alt text (unless decorative), a credit and a license.',
    })
    .refine((m) => m.status === 'placeholder' || m.src.desktop !== null, {
      message: 'A provided or approved slot needs src.desktop.',
    }),
});

export const collections = { sources, regions, media };
