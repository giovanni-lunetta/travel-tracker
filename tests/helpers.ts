import fs from 'node:fs';
import path from 'node:path';
import type { Catalog, CityRow, Place } from '../src/types';

const dataDir = path.resolve(__dirname, '..', 'public', 'data');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));

/** Loads the real bundled data so tests exercise what actually ships. */
export function loadData() {
  return {
    catalog: read('catalog.json') as Catalog,
    cities: read('cities.json') as CityRow[],
    admin1: read('admin1.json') as Record<string, string>,
    countries: read('countries.geojson') as GeoJSON.FeatureCollection,
    states: read('states-us.geojson') as GeoJSON.FeatureCollection,
  };
}

/** Builds a Place with sensible defaults for tests. */
export function place(over: Partial<Place> = {}): Place {
  return {
    id: 'country:FRA', kind: 'country', refId: 'FRA', name: 'France', countryId: 'FRA',
    admin1: null, lat: null, lon: null, status: 'visited', visits: [], notes: '',
    rating: null, tags: [], createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
    ...over,
  };
}
