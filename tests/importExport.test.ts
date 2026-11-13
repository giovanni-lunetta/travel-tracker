import { describe, expect, test } from 'vitest';
import { buildExport, mergeImport, parseExport, SCHEMA_VERSION } from '../src/lib/importExport';
import { DEFAULT_SETTINGS } from '../src/types';
import { place } from './helpers';

const NOW = '2025-05-05T12:00:00.000Z';

describe('export / parse round trip', () => {
  test('keeps every field', () => {
    const p = place({ notes: 'great', rating: 5, tags: ['food'], visits: [{ start: '2019-07', end: '2019-08', note: 'summer' }] });
    const file = buildExport([p], { ...DEFAULT_SETTINGS, countMode: 'all' }, NOW);
    expect(file).toMatchObject({ app: 'travel-tracker', schemaVersion: SCHEMA_VERSION, exportedAt: NOW });
    const back = parseExport(JSON.stringify(file));
    expect(back.places).toEqual([p]);
    expect(back.settings.countMode).toBe('all');
    expect(back.skipped).toBe(0);
  });
});

describe('parseExport rejects bad files with a readable message', () => {
  test('not JSON', () => expect(() => parseExport('hello')).toThrow(/not a valid JSON/i));
  test('JSON from another app', () => expect(() => parseExport('{"app":"other","places":[]}')).toThrow(/Travel Tracker/));
  test('a newer schema than this app understands', () => {
    expect(() => parseExport(JSON.stringify({ app: 'travel-tracker', schemaVersion: SCHEMA_VERSION + 1, places: [] }))).toThrow(/newer/i);
  });
  test('places missing', () => {
    expect(() => parseExport(JSON.stringify({ app: 'travel-tracker', schemaVersion: 1 }))).toThrow(/places/i);
  });
});

describe('parseExport cleans individual rows instead of failing the whole file', () => {
  const file = (places: unknown[]) => JSON.stringify({ app: 'travel-tracker', schemaVersion: 1, places });
  test('drops rows with no id, kind or name and counts them', () => {
    const r = parseExport(file([place(), { kind: 'pin' }, { id: 'x', kind: 'planet', name: 'Mars' }, 42, null]));
    expect(r.places).toHaveLength(1);
    expect(r.skipped).toBe(4);
  });
  test('coerces bad ratings, bad visit dates and duplicate tags', () => {
    const r = parseExport(file([{ ...place(), rating: 9, tags: [' Food', 'food', '', 'beach'], visits: [{ start: '2019-02-30' }, { start: '2020-01' }] }]));
    expect(r.places[0].rating).toBeNull();
    expect(r.places[0].tags).toEqual(['Food', 'beach']);
    expect(r.places[0].visits).toEqual([{ start: '2020-01' }]);
  });
  test('drops pins with impossible coordinates', () => {
    const r = parseExport(file([{ ...place({ id: 'pin:1', kind: 'pin', refId: null }), lat: 123, lon: 5 }]));
    expect(r.places).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });
  test('keeps the labels setting and ignores a non-boolean value', () => {
    const f = (labels: unknown) => JSON.stringify({ app: 'travel-tracker', schemaVersion: 1, places: [], settings: { labels } });
    expect(parseExport(f(false)).settings.labels).toBe(false);
    expect(parseExport(f('yes')).settings.labels).toBe(DEFAULT_SETTINGS.labels);
  });
  test('missing settings fall back to defaults', () => {
    expect(parseExport(file([])).settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('mergeImport', () => {
  test('adds new places', () => {
    const r = mergeImport([place()], [place({ id: 'country:ITA', refId: 'ITA', name: 'Italy' })], 'merge');
    expect(r.places).toHaveLength(2);
    expect(r.summary).toMatchObject({ added: 1, updated: 0, unchanged: 1, merged: 0 });
  });
  test('identical data changes nothing', () => {
    const r = mergeImport([place()], [place()], 'merge');
    expect(r.summary).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });
  test('the newer copy wins for notes/status/rating', () => {
    const old = place({ notes: 'old', updatedAt: '2024-01-01T00:00:00.000Z' });
    const newer = place({ notes: 'new', rating: 4, updatedAt: '2025-01-01T00:00:00.000Z' });
    const r = mergeImport([old], [newer], 'merge');
    expect(r.places[0]).toMatchObject({ notes: 'new', rating: 4 });
    expect(r.summary.updated).toBe(1);
  });
  test('an older incoming copy does not overwrite, but its extra visits and tags are kept', () => {
    const mine = place({ notes: 'mine', updatedAt: '2025-01-01T00:00:00.000Z', visits: [{ start: '2020' }], tags: ['a'] });
    const theirs = place({ notes: 'theirs', updatedAt: '2023-01-01T00:00:00.000Z', visits: [{ start: '2020' }, { start: '2018' }], tags: ['b'] });
    const r = mergeImport([mine], [theirs], 'merge');
    expect(r.places[0].notes).toBe('mine');
    expect(r.places[0].visits).toEqual([{ start: '2018' }, { start: '2020' }]);
    expect(r.places[0].tags.sort()).toEqual(['a', 'b']);
    expect(r.summary.updated).toBe(1);
  });
  test('a duplicate pin with a different id merges into the existing pin', () => {
    const mine = place({ id: 'pin:a', kind: 'pin', refId: null, name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, visits: [{ start: '2020' }] });
    const theirs = place({ id: 'pin:zzz', kind: 'pin', refId: null, name: 'Eiffel Tower', lat: 48.85841, lon: 2.29451, visits: [{ start: '2022' }] });
    const r = mergeImport([mine], [theirs], 'merge');
    expect(r.places).toHaveLength(1);
    expect(r.places[0].id).toBe('pin:a');
    expect(r.places[0].visits).toEqual([{ start: '2020' }, { start: '2022' }]);
    expect(r.summary.merged).toBe(1);
  });
  test('two different pins far apart are both kept', () => {
    const a = place({ id: 'pin:a', kind: 'pin', refId: null, name: 'Cafe', lat: 48.85, lon: 2.29 });
    const b = place({ id: 'pin:b', kind: 'pin', refId: null, name: 'Cafe', lat: 40.7, lon: -74 });
    expect(mergeImport([a], [b], 'merge').places).toHaveLength(2);
  });
  test('replace mode returns only the imported places', () => {
    const r = mergeImport([place(), place({ id: 'country:ITA', refId: 'ITA', name: 'Italy' })], [place({ id: 'country:ESP', refId: 'ESP', name: 'Spain' })], 'replace');
    expect(r.places.map((p) => p.id)).toEqual(['country:ESP']);
    expect(r.summary).toMatchObject({ added: 1, removed: 2 });
  });
  test('does not mutate its inputs', () => {
    const mine = [place({ visits: [{ start: '2020' }] })];
    const copy = structuredClone(mine);
    mergeImport(mine, [place({ visits: [{ start: '2018' }], updatedAt: '2026-01-01T00:00:00.000Z' })], 'merge');
    expect(mine).toEqual(copy);
  });
});
