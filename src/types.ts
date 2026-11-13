/**
 * Shared types. These describe both what is stored in IndexedDB and what is
 * written to the JSON export file, so changing them means bumping
 * SCHEMA_VERSION (src/lib/importExport.ts) and adding a migration.
 */

/** What level of the world a Place describes. */
export type Kind = 'country' | 'state' | 'city' | 'pin';

/** Where the user stands with a place. */
export type Status = 'visited' | 'wishlist';

/**
 * How "% of world" is counted (Settings -> Counting):
 *  un195 = 193 UN members + 2 observers (Vatican, Palestine)  [default]
 *  un193 = UN members only
 *  all   = every country, territory and disputed place on the map
 */
export type CountMode = 'un195' | 'un193' | 'all';

/** A single trip to a place. Dates may be partial: "2019", "2019-07", "2019-07-04". */
export interface Visit {
  start: string;
  end?: string;
  note?: string;
}

export interface Place {
  /** Deterministic for countries/states/cities ("country:FRA"), uuid-based for pins. */
  id: string;
  kind: Kind;
  /** Natural Earth A3 code, "US-NY", or GeoNames id; null for free pins. */
  refId: string | null;
  name: string;
  /** Natural Earth A3 code of the country this place is in (null if unknown). */
  countryId: string | null;
  /** State id such as "US-NY" when known. */
  admin1: string | null;
  lat: number | null;
  lon: number | null;
  status: Status;
  visits: Visit[];
  notes: string;
  /** 1-5, or null when not rated. */
  rating: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  countMode: CountMode;
  /** ISO timestamp of the last JSON export, used for the backup reminder. */
  lastExportedAt: string | null;
  /** Show the optional OpenFreeMap street layer when online. */
  streets: boolean;
  /** Show place names on the map (fonts load from OpenFreeMap, then work offline). */
  labels: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  countMode: 'un195',
  lastExportedAt: null,
  streets: false,
  labels: true,
};

/* ---------- Bundled reference data (built by scripts/build-data.mjs) ---------- */

export type CountryKind = 'un' | 'observer' | 'partial' | 'territory';

export interface CatalogCountry {
  id: string;
  name: string;
  iso2: string;
  kind: CountryKind;
  cont: string;
  lon: number;
  lat: number;
  tiny: boolean;
  /** Natural Earth label rank: smaller = more important (wins on a crowded map). */
  rank: number;
  sov: string;
  aliases: string[];
}

export interface CatalogState {
  id: string;
  name: string;
  country: string;
  postal: string;
  aliases: string[];
  lon: number;
  lat: number;
}

export interface Catalog {
  countries: CatalogCountry[];
  states: CatalogState[];
}

/** [geonameid, name, lat, lon, countryIso2, admin1Code, population, "alt|names"] */
export type CityRow = [number, string, number, number, string, string, number, string];

export interface ExportFile {
  app: 'travel-tracker';
  schemaVersion: number;
  exportedAt: string;
  places: Place[];
  settings: Settings;
}
