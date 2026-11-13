import { describe, expect, test } from 'vitest';
import { loadData } from './helpers';

const { catalog, cities, countries, states, admin1 } = loadData();

describe('bundled data sanity (guards against a bad data rebuild)', () => {
  test('exactly 193 UN members and 2 observers', () => {
    expect(catalog.countries.filter((c) => c.kind === 'un')).toHaveLength(193);
    expect(catalog.countries.filter((c) => c.kind === 'observer').map((c) => c.id).sort()).toEqual(['PSX', 'VAT']);
  });
  test('well-known partial/disputed places are tagged, not counted as UN members', () => {
    const kind = (id: string) => catalog.countries.find((c) => c.id === id)?.kind;
    expect(kind('TWN')).toBe('partial');
    expect(kind('KOS')).toBe('partial');
    expect(kind('SAH')).toBe('partial');
    expect(kind('PRI')).toBe('territory');
    expect(kind('GRL')).toBe('territory');
    expect(kind('HKG')).toBe('territory');
    expect(kind('ISR')).toBe('un');
  });
  test('every selectable shape has a catalog entry and every catalog entry has a shape', () => {
    const ids = new Set(catalog.countries.map((c) => c.id));
    const shapeIds = new Set(countries.features.filter((f) => f.properties!.sel === 1).map((f) => f.properties!.id as string));
    for (const id of shapeIds) expect(ids.has(id), `shape ${id} has no catalog entry`).toBe(true);
    for (const id of ids) expect(shapeIds.has(id), `catalog ${id} has no shape`).toBe(true);
  });
  test('every country has a numeric label rank (used to decide which names win on a crowded map)', () => {
    for (const c of catalog.countries) expect(typeof (c as unknown as { rank: number }).rank, c.id).toBe('number');
  });
  test('the 195 sit on six real continents with the right totals (island nations are not lost to "open ocean")', () => {
    const counted = catalog.countries.filter((c) => c.kind === 'un' || c.kind === 'observer');
    const by: Record<string, number> = {};
    for (const c of counted) by[c.cont] = (by[c.cont] ?? 0) + 1;
    expect(Object.keys(by).sort()).toEqual(['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America']);
    expect(by.Africa).toBe(54);
    expect(by.Oceania).toBe(14);
    expect(by['South America']).toBe(12);
    expect(by['North America']).toBe(23);
    expect(Object.values(by).reduce((a, b) => a + b, 0)).toBe(195);
  });
  test('display names are the ones people use', () => {
    const name = (id: string) => catalog.countries.find((c) => c.id === id)?.name;
    expect(name('CHN')).toBe('China');
    expect(name('BHS')).toBe('Bahamas');
    expect(name('GMB')).toBe('Gambia');
    expect(name('CYN')).toBe('Northern Cyprus');
  });
  test('country ids are unique and iso2 codes are unique when set', () => {
    const ids = catalog.countries.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const iso = catalog.countries.map((c) => c.iso2).filter(Boolean);
    expect(new Set(iso).size).toBe(iso.length);
  });
  test('microstates exist and are flagged tiny (so they get map markers)', () => {
    for (const id of ['VAT', 'MCO', 'SMR', 'LIE', 'TUV', 'NRU']) {
      expect(catalog.countries.find((c) => c.id === id)?.tiny, id).toBe(true);
    }
  });
  test('50 states + DC with unique ids', () => {
    expect(states.features).toHaveLength(51);
    expect(catalog.states).toHaveLength(51);
    expect(new Set(catalog.states.map((s) => s.id)).size).toBe(51);
    expect(catalog.states.find((s) => s.id === 'US-DC')?.aliases).toContain('Washington DC');
  });
  test('every city country code maps to a catalog country (so searches can be labelled)', () => {
    const iso = new Set(catalog.countries.map((c) => c.iso2).filter(Boolean));
    const missing = new Set(cities.map((r) => r[4]).filter((cc) => !iso.has(cc)));
    // Natural Earth folds a few GeoNames codes into other entries; the list must stay tiny.
    expect(missing.size, [...missing].join(',')).toBeLessThan(15);
  });
  test('city table is large and its admin1 lookup is populated', () => {
    expect(cities.length).toBeGreaterThan(60000);
    expect(admin1['US.NY']).toBe('New York');
  });
});
