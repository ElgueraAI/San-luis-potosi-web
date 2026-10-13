/**
 * Smart tourism intelligence layer: shared models.
 *
 * Everything under src/lib/intel is pure TypeScript (no DOM, no Astro, no
 * network), so the same code runs at build time (src/data/intel.ts), in the
 * browser (src/scripts/intel) and in node tests (tests/intel).
 *
 * Coordinates follow GeoJSON order everywhere: [longitude, latitude].
 * A missing value is null. Nothing here fills a gap with a guess.
 */
export type RegionId = 'altiplano' | 'centro' | 'zona-media' | 'huasteca';
export type Coord = [lon: number, lat: number];

/** The twelve interests of the visitor profile (docs/recommendation-engine.md § Taxonomy). */
export type ProfileInterest =
  | 'naturaleza' | 'agua' | 'aventura' | 'cultura' | 'historia' | 'arqueologia'
  | 'gastronomia' | 'pueblos-magicos' | 'arte' | 'fotografia' | 'relajacion' | 'familia';

export type IntelKind =
  | 'destination' | 'archaeology' | 'museum' | 'protected-area' | 'religious-landmark'
  | 'heritage' | 'gallery' | 'craft' | 'recreation';

/**
 * How much a value can be trusted.
 *  verified     read in an official source and cross-checked
 *  official     published by an official source (register, directory, open data)
 *  derived      computed by this project from other fields (rules, formulas)
 *  approximate  a real value of limited precision (OSM point, municipal seat)
 *  unknown      no value
 */
export type Confidence = 'verified' | 'official' | 'derived' | 'approximate' | 'unknown';
export type EvidenceLevel = 'alta' | 'media' | 'baja';

export interface Provenance {
  source_id: string;
  source_name: string | null;
  source_url: string | null;
  /** 'official' | 'open-data' | 'community' | 'unknown' (from the source registry). */
  source_type: 'official' | 'open-data' | 'community' | 'unknown';
  retrieved_at: string | null;
  licence: string | null;
}

/** One normalized tourism asset the engines can score. */
export interface IntelPlace {
  id: string;
  name: string;
  kind: IntelKind;
  /** Short visitor-facing type ("Cascada", "Museo", "Área natural protegida"). */
  label: string;
  region: RegionId | null;
  municipality: string | null;
  municipality_id: string | null;
  coord: Coord | null;
  coord_confidence: Confidence;
  /** Interests stated by the research layer (editorial tags) or implied by the official type. */
  interests: ProfileInterest[];
  /** Subset of `interests` that this project inferred by rule (shown as "derivado"). */
  derived_interests: ProfileInterest[];
  /** Months (1–12) an official source recommends; null = no official statement (never penalised). */
  recommended_months: number[] | null;
  season_source: string | null;
  /** Months for which an official source states a climate caution (not a recommendation). */
  caution_months: number[] | null;
  caution_note: string | null;
  /** Mostly outdoors: used only to decide whether rain matters. null = unknown. */
  outdoor: boolean | null;
  pueblo_magico: boolean;
  /** Editorial planning priority of the research workbook ('A' = flagship). Destinations only. */
  priority: 'A' | 'B' | 'C' | null;
  description: string | null;
  url: string | null;
  image: string | null;
  official_url: string | null;
  source_ids: string[];
  /** Best source class behind the record. */
  source_confidence: Confidence;
  evidence: EvidenceLevel;
  /** Place id usable with «Añadir a Mi Ruta» (present in /data/places.json), or null. */
  route_id: string | null;
}

/** Municipality features (feature engineering over observed counts). */
export interface MuniFeatures {
  id: string;
  name: string;
  slug: string | null;
  region: RegionId | null;
  coord: Coord | null;
  population: number | null;
  /** Observed counts from research/entities. */
  counts: {
    destinations: number; museums: number; venues: number; archaeology: number; events: number;
    lodging: number; food: number; protected_areas: number; flagship: number; pueblo_magico: number;
  };
  /** Scorable assets in the municipality (destinations + museums + archaeology + protected areas). */
  assets: number;
  /** Share of the state's scorable assets (0–1). */
  asset_share: number;
  /** Derived, 0–1: lodging and food establishments on a log scale (supply-side proxy). */
  infrastructure_index: number;
  /** Derived, 0–1: relative exposure proxy (lodging share, flagship destinations, Pueblo Mágico). NOT visitors. */
  exposure_proxy: number;
  /** Derived, 0–1: assets and infrastructure present, exposure low. */
  diversification_potential: number;
  /** Derived, 0–1: how much of the expected record types the municipality has. */
  coverage_index: number;
}

export interface IntelEvent {
  id: string;
  name: string;
  municipality_id: string | null;
  municipality: string | null;
  region: RegionId | null;
  months: number[];
  date_status: string | null;
  /** 'confirmed' (current-year date), 'pattern' (official recurrence), 'past' (last known edition), 'unknown'. */
  date_confidence: 'confirmed' | 'pattern' | 'past' | 'unknown';
  url: string | null;
}

export type Duration = 'half-day' | 'day' | 'two-days' | 'weekend' | 'long';
export type Budget = 'economico' | 'medio' | 'flexible';
export type TravelMode = 'car' | 'foot' | 'bike';

/** The whole visitor profile. No personal data: nothing here identifies a person. */
export interface TouristProfile {
  interests: ProfileInterest[];
  duration: Duration;
  mode: TravelMode;
  budget: Budget;
}

export interface IntelDataset {
  generated: string;
  places: IntelPlace[];
  municipalities: MuniFeatures[];
  events: IntelEvent[];
  /** Monthly modelled climate per region (Open-Meteo reanalysis 2016–2025): rain days, max temperature. */
  climate: Record<string, { rain_days: number; tmax: number; tmin: number }[]>;
  /** Source registry rows cited by the places: id to display name and URL. */
  sources: Record<string, { name: string; url: string | null }>;
}
