import { describe, expect, test } from 'vitest';
import { computeStats } from '../src/lib/stats';
import type { Catalog, CatalogCountry } from '../src/types';
import { place } from './helpers';

const c = (id: string, kind: CatalogCountry['kind'], cont: string): CatalogCountry =>
  ({ id, name: id, iso2: '', kind, cont, lon: 0, lat: 0, tiny: false, rank: 1, sov: id, aliases: [] });
const catalog: Catalog = {
  countries: [c('AAA', 'un', 'Europe'), c('BBB', 'un', 'Asia'), c('CCC', 'observer', 'Europe'), c('DDD', 'partial', 'Asia'), c('EEE', 'territory', 'Europe')],
  states: Array.from({ length: 51 }, (_, i) => ({ id: 'US-' + i, name: 'S' + i, country: 'USA', postal: 'S' + i, aliases: [], lon: 0, lat: 0 })),
};
const country = (id: string, status: 'visited' | 'wishlist' = 'visited', over = {}) =>
  place({ id: 'country:' + id, kind: 'country', refId: id, name: id, countryId: id, status, ...over });

describe('computeStats', () => {
  test('empty data is all zeros', () => {
    expect(computeStats([], catalog, 'un195')).toMatchObject({
      countriesVisited: 0, worldTotal: 3, percent: 0, extraVisited: 0, statesVisited: 0, statesTotal: 51,
      cities: 0, pins: 0, wishlist: 0, firstVisit: null, latestVisit: null,
    });
  });
  test('un195 counts UN members + observers; others are shown as "extra"', () => {
    const s = computeStats([country('AAA'), country('DDD'), country('EEE')], catalog, 'un195');
    expect(s).toMatchObject({ countriesVisited: 1, worldTotal: 3, extraVisited: 2, percent: 33.3 });
  });
  test('un193 counts UN members only: an observer becomes "extra"', () => {
    const s = computeStats([country('AAA'), country('CCC')], catalog, 'un193');
    expect(s).toMatchObject({ countriesVisited: 1, worldTotal: 2, extraVisited: 1, percent: 50 });
  });
  test('all mode counts everything, no extras', () => {
    const s = computeStats([country('AAA'), country('DDD'), country('EEE')], catalog, 'all');
    expect(s).toMatchObject({ countriesVisited: 3, worldTotal: 5, extraVisited: 0, percent: 60 });
  });
  test('percent rounds to one decimal', () => {
    expect(computeStats([country('AAA')], { ...catalog, countries: catalog.countries.slice(0, 2) }, 'un195').percent).toBe(50);
    const three = { ...catalog, countries: [c('A', 'un', 'Europe'), c('B', 'un', 'Europe'), c('C', 'un', 'Europe')] };
    expect(computeStats([country('A')], three, 'un195').percent).toBe(33.3);
  });
  test('want-to-go places are not counted as visited', () => {
    const s = computeStats([country('AAA', 'wishlist')], catalog, 'un195');
    expect(s.countriesVisited).toBe(0);
    expect(s.wishlist).toBe(1);
  });
  test('states, cities and pins are counted separately; wishlist pins excluded', () => {
    const s = computeStats([
      place({ id: 'state:US-1', kind: 'state', refId: 'US-1' }),
      place({ id: 'state:US-2', kind: 'state', refId: 'US-2', status: 'wishlist' }),
      place({ id: 'city:1', kind: 'city', refId: '1' }),
      place({ id: 'city:2', kind: 'city', refId: '2' }),
      place({ id: 'pin:1', kind: 'pin', refId: null }),
      place({ id: 'pin:2', kind: 'pin', refId: null, status: 'wishlist' }),
    ], catalog, 'un195');
    expect(s).toMatchObject({ statesVisited: 1, cities: 2, pins: 1, wishlist: 2 });
  });
  test('per-continent progress only counts the chosen set', () => {
    const s = computeStats([country('AAA'), country('EEE')], catalog, 'un195');
    expect(s.continents.Europe).toEqual({ visited: 1, total: 2 });
    expect(s.continents.Asia).toEqual({ visited: 0, total: 1 });
  });
  test('first and latest visit come from visit dates of visited places', () => {
    const s = computeStats([
      country('AAA', 'visited', { visits: [{ start: '2021-03' }, { start: '2015' }] }),
      country('BBB', 'visited', { visits: [{ start: '2023-07-04', end: '2023-07-09' }] }),
      country('CCC', 'wishlist', { visits: [{ start: '1999' }] }),
    ], catalog, 'un195');
    expect(s.firstVisit).toBe('2015');
    expect(s.latestVisit).toBe('2023-07-04');
  });
});
