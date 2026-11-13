/** Loads the bundled reference data (served from /data, cached by the service worker). */
import { buildIndex } from '../lib/search';
import { store, type AppData, type Target } from '../store';
import type { Catalog, CatalogCountry, CatalogState, CityRow } from '../types';

const base = import.meta.env.BASE_URL;

async function getJSON<T>(name: string): Promise<T> {
  const res = await fetch(`${base}data/${name}`);
  if (!res.ok) throw new Error(`Couldn't load ${name} (${res.status})`);
  return (await res.json()) as T;
}

/** Everything needed to show the map. ~1 MB, loaded at start. */
export async function loadCoreData(): Promise<AppData> {
  const [catalog, countries, states] = await Promise.all([
    getJSON<Catalog>('catalog.json'),
    getJSON<GeoJSON.FeatureCollection>('countries.geojson'),
    getJSON<GeoJSON.FeatureCollection>('states-us.geojson'),
  ]);
  return { catalog, countries, states };
}

let indexPromise: Promise<void> | null = null;

/** The ~70,000-city search index. Loaded on first use (or when idle) and then kept. */
export function ensureSearchIndex(): Promise<void> {
  if (store.searchIndex.value) return Promise.resolve();
  indexPromise ??= (async () => {
    const data = store.data.value;
    if (!data) throw new Error('Map data is not loaded yet');
    const [cities, admin1] = await Promise.all([
      getJSON<CityRow[]>('cities.json'),
      getJSON<Record<string, string>>('admin1.json'),
    ]);
    await new Promise((r) => setTimeout(r, 0)); // let the UI paint before the heavy work
    store.searchIndex.value = buildIndex(data.catalog, cities, admin1);
  })().catch((err) => { indexPromise = null; throw err; });
  return indexPromise;
}

/* ---- lookups by id, cached per catalog ---- */

interface Lookups { country: Map<string, CatalogCountry>; state: Map<string, CatalogState> }
const cache = new WeakMap<Catalog, Lookups>();

export function lookups(catalog: Catalog): Lookups {
  let l = cache.get(catalog);
  if (!l) {
    l = {
      country: new Map(catalog.countries.map((c) => [c.id, c])),
      state: new Map(catalog.states.map((s) => [s.id, s])),
    };
    cache.set(catalog, l);
  }
  return l;
}

export const countryTarget = (c: CatalogCountry): Target => ({
  kind: 'country', refId: c.id, name: c.name, countryId: c.id, admin1: null, lat: null, lon: null,
});
export const stateTarget = (s: CatalogState): Target => ({
  kind: 'state', refId: s.id, name: s.name, countryId: 'USA', admin1: s.id, lat: null, lon: null,
});
