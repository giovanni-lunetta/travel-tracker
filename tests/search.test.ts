import { beforeAll, describe, expect, test } from 'vitest';
import { buildIndex, fold, nearestCity, search, type SearchIndex } from '../src/lib/search';
import { loadData } from './helpers';

let index: SearchIndex;
beforeAll(() => {
  const { catalog, cities, admin1 } = loadData();
  index = buildIndex(catalog, cities, admin1);
});
const top = (q: string) => search(index, q, 5)[0];

describe('fold', () => {
  test('removes accents, case, apostrophes, periods and hyphens', () => {
    expect(fold("Côte d'Ivoire")).toBe('cote divoire');
    expect(fold('St. Kitts-Nevis')).toBe('st kitts nevis');
    expect(fold('  São   Paulo ')).toBe('sao paulo');
  });
});

describe('search: multiple spellings of countries', () => {
  test.each([
    ['czech republic', 'CZE'], ['czechia', 'CZE'], ['burma', 'MMR'], ['myanmar', 'MMR'],
    ['ivory coast', 'CIV'], ["côte d'ivoire", 'CIV'], ['swaziland', 'SWZ'], ['eswatini', 'SWZ'],
    ['cape verde', 'CPV'], ['east timor', 'TLS'], ['turkey', 'TUR'], ['turkiye', 'TUR'],
    ['uk', 'GBR'], ['england', 'GBR'], ['usa', 'USA'], ['america', 'USA'],
    ['vatican', 'VAT'], ['holy see', 'VAT'], ['drc', 'COD'], ['saint kitts', 'KNA'], ['st kitts', 'KNA'],
    ['holland', 'NLD'], ['china', 'CHN'], ['the bahamas', 'BHS'], ['the gambia', 'GMB'], ['south korea', 'KOR'], ['macedonia', 'MKD'], ['uae', 'ARE'],
  ])('"%s" finds country %s first', (q, id) => {
    const hit = top(q);
    expect(hit.type).toBe('country');
    expect(hit.id).toBe(id);
  });
});

describe('search: states, cities and ranking', () => {
  test('"ny" finds New York state first (postal code)', () => {
    expect(top('ny')).toMatchObject({ type: 'state', id: 'US-NY' });
  });
  test('"new york" returns both the state and the city near the top', () => {
    const ids = search(index, 'new york', 5).map((h) => `${h.type}:${h.id}`);
    expect(ids).toContain('state:US-NY');
    expect(ids).toContain('city:5128581');
  });
  test('"paris" prefers Paris, France over Paris, Canada (population)', () => {
    expect(top('paris')).toMatchObject({ type: 'city', id: '2988507', countryId: 'FRA' });
  });
  test('same-name cities are told apart by their region/country label', () => {
    const labels = search(index, 'paris', 10).filter((h) => h.name === 'Paris').map((h) => h.sub);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.some((l) => l.includes('France'))).toBe(true);
  });
  test('native-language names work (Wien, München, Firenze)', () => {
    expect(top('wien')).toMatchObject({ type: 'city', id: '2761369' });
    expect(top('munchen')).toMatchObject({ type: 'city', id: '2867714' });
    expect(top('firenze').name).toBe('Florence');
  });
  test('accents in the query are optional', () => {
    expect(top('zurich').name).toMatch(/Z.rich/);
    expect(top('sao paulo').name).toBe('São Paulo');
  });
  test('empty or whitespace query returns nothing', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
  });
  test('respects the limit', () => {
    expect(search(index, 'san', 7).length).toBe(7);
  });
  test('hits carry coordinates for flying the map there', () => {
    expect(top('paris').lat).toBeCloseTo(48.853, 1);
  });
});

describe('nearestCity (names a dropped pin)', () => {
  test('finds Paris from a point in central Paris', () => {
    expect(nearestCity(index, 48.8566, 2.3522, 10)).toMatchObject({ id: '2988507', name: 'Paris', countryId: 'FRA' });
  });
  test('reports how far away it is', () => {
    const hit = nearestCity(index, 48.9, 2.35, 20)!;
    expect(hit.distKm).toBeGreaterThan(0);
    expect(hit.distKm).toBeLessThan(20);
  });
  test('returns null when nothing is within range (open ocean)', () => {
    expect(nearestCity(index, 0, -30, 50)).toBeNull();
  });
});
