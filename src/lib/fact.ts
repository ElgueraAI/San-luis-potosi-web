import { z } from 'astro/zod';

/**
 * The Fact system.
 *
 * Every geographic, temporal, official or numeric claim on the site is a Fact:
 * a value plus its verification status. Only `verified` facts (with a source
 * and a date) may ever render as information. `pending` facts show a visible
 * "pendiente" badge in development and are suppressed in production builds.
 */
export const factStatus = z.enum(['pending', 'verified']);
export type FactStatus = z.infer<typeof factStatus>;

export type Fact<T> = {
  value: T | null;
  status: FactStatus;
  source?: string;
  verifiedAt?: string;
  note?: string;
};

export function fact<T extends z.ZodType>(value: T) {
  return z
    .object({
      value: value.nullable(),
      status: factStatus,
      source: z.string().optional(),
      verifiedAt: z.string().optional(),
      note: z.string().optional(),
    })
    .refine((f) => f.status !== 'verified' || ((f as unknown as { value: unknown }).value !== null && !!f.source && !!f.verifiedAt), {
      message: 'A verified fact needs a value, a source id and a verifiedAt date.',
    });
}

/** True in `astro dev`. Pending facts are only ever visible here. */
export const SHOW_PENDING = import.meta.env.DEV;

export type FactView<T> =
  | { kind: 'verified'; value: T; source: string }
  | { kind: 'pending'; value: T | null; note?: string }
  | { kind: 'hidden' };

/** Decides what a fact may show in the current build. */
export function viewFact<T>(f: Fact<T> | undefined | null): FactView<T> {
  if (!f) return { kind: 'hidden' };
  if (f.status === 'verified' && f.value !== null && f.source) {
    return { kind: 'verified', value: f.value, source: f.source };
  }
  return SHOW_PENDING ? { kind: 'pending', value: f.value, note: f.note } : { kind: 'hidden' };
}
