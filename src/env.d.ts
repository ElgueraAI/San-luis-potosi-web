/// <reference types="astro/client" />

interface ScrollCraftInstance {
  destroy?: () => void;
  layout?: () => void;
}

interface Window {
  ScrollCraft?: {
    mount: (root?: Element | Document | string, opts?: { lerp?: number }) => ScrollCraftInstance;
    reduce: boolean;
    instances: ScrollCraftInstance[];
  };
}

interface Navigator {
  connection?: { saveData?: boolean; effectiveType?: string };
  deviceMemory?: number;
}

type SlpTier = 'full' | 'lite' | 'static';

interface SlpPositionDetail {
  /** Fraction of the transect, 0 (west) to 1 (east). */
  x: number;
  /** Region id under the marker. */
  region: string;
}

interface WindowEventMap {
  'slp:position': CustomEvent<SlpPositionDetail>;
}
