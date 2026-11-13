import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { createRepo } from '../src/lib/db';
import { DEFAULT_SETTINGS } from '../src/types';
import { place } from './helpers';

let n = 0;
let dbName: string;
beforeEach(() => { dbName = 'test-db-' + n++; });

describe('IndexedDB repo', () => {
  test('starts empty with default settings', async () => {
    const repo = await createRepo(dbName);
    expect(await repo.loadPlaces()).toEqual([]);
    expect(await repo.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
  test('saves and loads places, and survives closing and reopening', async () => {
    const repo = await createRepo(dbName);
    await repo.putPlace(place({ notes: 'persisted' }));
    repo.close();
    const again = await createRepo(dbName);
    expect((await again.loadPlaces())[0].notes).toBe('persisted');
  });
  test('putPlace overwrites the same id (no duplicates)', async () => {
    const repo = await createRepo(dbName);
    await repo.putPlace(place({ notes: 'a' }));
    await repo.putPlace(place({ notes: 'b' }));
    const all = await repo.loadPlaces();
    expect(all).toHaveLength(1);
    expect(all[0].notes).toBe('b');
  });
  test('putPlaces writes many at once and deletePlace removes one', async () => {
    const repo = await createRepo(dbName);
    await repo.putPlaces([place(), place({ id: 'country:ITA', refId: 'ITA' })]);
    await repo.deletePlace('country:FRA');
    expect((await repo.loadPlaces()).map((p) => p.id)).toEqual(['country:ITA']);
  });
  test('replaceAll removes everything not in the new list', async () => {
    const repo = await createRepo(dbName);
    await repo.putPlaces([place(), place({ id: 'country:ITA', refId: 'ITA' })]);
    await repo.replaceAll([place({ id: 'country:ESP', refId: 'ESP' })]);
    expect((await repo.loadPlaces()).map((p) => p.id)).toEqual(['country:ESP']);
  });
  test('settings persist and merge over defaults', async () => {
    const repo = await createRepo(dbName);
    await repo.saveSettings({ ...DEFAULT_SETTINGS, countMode: 'un193', lastExportedAt: '2025-01-01T00:00:00.000Z' });
    repo.close();
    const again = await createRepo(dbName);
    expect(await again.loadSettings()).toMatchObject({ countMode: 'un193', lastExportedAt: '2025-01-01T00:00:00.000Z', streets: false });
  });
});
