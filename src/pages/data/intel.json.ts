/**
 * Intelligence dataset for the client (recommender, route-aware suggestions,
 * redistribution): normalized places, municipality features, events and the
 * monthly climate context. Built at compile time by src/data/intel.ts and
 * loaded only on the pages that need it.
 */
import type { APIRoute } from 'astro';
import { intelDataset } from '@/data/intel';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await intelDataset()), { headers: { 'Content-Type': 'application/json' } });
