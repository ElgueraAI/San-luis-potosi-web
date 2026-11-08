/** Separate presentation endpoint: no changes to M03 datasets or contracts. */
import type { APIRoute } from 'astro';
import { museums, venues, lodging, food, recreation, protectedAreas } from '@/data/portal';
import { entityFacts } from '@/lib/place-facts';
const entries = [...new Map([...museums, ...venues, ...lodging, ...food, ...recreation, ...protectedAreas].map((e) => [e.id, e])).values()];
export const getStaticPaths = () => entries.map((e) => ({ params: { id: e.id }, props: { e } }));
export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(entityFacts(props.e)), { headers: { 'Content-Type': 'application/json' } });
