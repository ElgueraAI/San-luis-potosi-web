/** Loads /data/intel.json once per page (the dataset is fetched only where the engines run). */
import type { IntelDataset } from '@/lib/intel/types';

let promise: Promise<IntelDataset> | null = null;
export function loadIntel(url: string): Promise<IntelDataset> {
  promise ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error(`intel ${r.status}`);
    return r.json() as Promise<IntelDataset>;
  });
  promise.catch(() => { promise = null; }); // allow a retry after a failure
  return promise;
}
