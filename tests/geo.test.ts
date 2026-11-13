import { describe, expect, test } from 'vitest';
import { haversineKm, locate } from '../src/lib/geo';
import { loadData } from './helpers';

const { countries, states } = loadData();

describe('haversineKm', () => {
  test('Paris to London is about 344 km', () => {
    expect(haversineKm(2.3522, 48.8566, -0.1276, 51.5072)).toBeGreaterThan(340);
    expect(haversineKm(2.3522, 48.8566, -0.1276, 51.5072)).toBeLessThan(348);
  });
  test('same point is zero', () => {
    expect(haversineKm(10, 10, 10, 10)).toBe(0);
  });
});

describe('locate (offline point-in-polygon)', () => {
  test.each([
    ['Paris', 2.3522, 48.8566, 'FRA'],
    ['Berlin', 13.405, 52.52, 'DEU'],
    ['Monaco', 7.4246, 43.7384, 'MCO'],
    ['Vatican City', 12.4534, 41.9029, 'VAT'],
    ['Puerto Rico (a US territory, its own entry)', -66.1057, 18.4663, 'PRI'],
  ])('%s is in %s', (_n, lon, lat, id) => {
    expect(locate(lon, lat, countries, states).countryId).toBe(id);
  });

  test('New York City is in the USA and New York state', () => {
    const r = locate(-74.006, 40.7128, countries, states);
    expect(r).toEqual({ countryId: 'USA', stateId: 'US-NY' });
  });
  test('Honolulu is in Hawaii (island polygons, hole-free)', () => {
    expect(locate(-157.8583, 21.3069, countries, states)).toEqual({ countryId: 'USA', stateId: 'US-HI' });
  });
  test('Anchorage is in Alaska', () => {
    expect(locate(-149.9, 61.2181, countries, states).stateId).toBe('US-AK');
  });
  test('a non-US place has no state', () => {
    expect(locate(2.3522, 48.8566, countries, states).stateId).toBeNull();
  });
  test('coastal point just offshore snaps to the nearest country (Sydney Opera House)', () => {
    expect(locate(151.2153, -33.8568, countries, states).countryId).toBe('AUS');
  });
  test('open ocean has no country', () => {
    expect(locate(-30, 30, countries, states)).toEqual({ countryId: null, stateId: null });
  });
  test('selecting Cuba finds Guantanamo Bay as Cuba (leases are merged into the parent)', () => {
    expect(locate(-75.1, 19.9, countries, states).countryId).toBe('CUB');
  });
});
