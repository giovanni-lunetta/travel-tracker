import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { createRepo } from '../src/lib/db';
import { Store, type Target } from '../src/store';
import { place } from './helpers';

let n = 0;
let store: Store;
let repo: Awaited<ReturnType<typeof createRepo>>;
const FRANCE: Target = { kind: 'country', refId: 'FRA', name: 'France', countryId: 'FRA', admin1: null, lat: null, lon: null };

beforeEach(async () => {
  repo = await createRepo('store-test-' + n++);
  store = new Store();
  await store.init(repo);
});

describe('Store.tap (the one-tap toggle)', () => {
  test('first tap marks the place visited and saves it to the database', async () => {
    await store.tap(FRANCE);
    expect(store.places.value.get('country:FRA')?.status).toBe('visited');
    expect((await repo.loadPlaces()).map((p) => p.id)).toEqual(['country:FRA']);
  });
  test('shows a confirmation toast with Undo and Details actions', async () => {
    await store.tap(FRANCE);
    expect(store.toast.value?.message).toBe('France marked visited');
    expect(store.toast.value?.actions.map((a) => a.label)).toEqual(['Undo', 'Details']);
  });
  test('second tap removes it again', async () => {
    await store.tap(FRANCE);
    await store.tap(FRANCE);
    expect(store.places.value.size).toBe(0);
    expect(await repo.loadPlaces()).toEqual([]);
  });
  test('Undo after removing brings the place back, details and all', async () => {
    await store.tap(FRANCE);
    await store.tap(FRANCE);
    await store.toast.value!.actions[0].run();
    expect(store.places.value.get('country:FRA')?.status).toBe('visited');
    expect((await repo.loadPlaces())).toHaveLength(1);
  });
  test('tapping a want-to-go place marks it visited', async () => {
    await store.save(place({ status: 'wishlist', notes: 'someday' }));
    await store.tap(FRANCE);
    expect(store.places.value.get('country:FRA')).toMatchObject({ status: 'visited', notes: 'someday' });
  });
  test('tapping a visited place that has notes asks first instead of deleting them', async () => {
    await store.save(place({ notes: 'best croissants' }));
    await store.tap(FRANCE);
    expect(store.places.value.has('country:FRA')).toBe(true);
    expect(store.confirm.value?.title).toBe('Remove France?');
    await store.confirm.value!.onConfirm();
    expect(store.places.value.has('country:FRA')).toBe(false);
    expect(store.confirm.value).toBeNull();
  });
  test('cancelling that confirmation keeps everything', async () => {
    await store.save(place({ notes: 'keep me' }));
    await store.tap(FRANCE);
    store.confirm.value!.onCancel();
    expect(store.places.value.get('country:FRA')?.notes).toBe('keep me');
    expect(store.confirm.value).toBeNull();
  });
});

describe('Store.requestRemove (remove button in the sheet)', () => {
  test('removes a bare place right away, with Undo', async () => {
    await store.save(place({ status: 'wishlist' }));
    await store.requestRemove('country:FRA');
    expect(store.places.value.size).toBe(0);
    expect(store.toast.value?.message).toBe('France removed');
  });
  test('asks first when the place has details', async () => {
    await store.save(place({ tags: ['food'] }));
    await store.requestRemove('country:FRA');
    expect(store.places.value.size).toBe(1);
    expect(store.confirm.value?.title).toBe('Remove France?');
  });
  test('an unknown id does nothing', async () => {
    await store.requestRemove('country:NOPE');
    expect(store.confirm.value).toBeNull();
  });
});

describe('Store persistence', () => {
  test('places survive a restart (new Store on the same database)', async () => {
    await store.tap(FRANCE);
    const again = new Store();
    await again.init(repo);
    expect(again.places.value.has('country:FRA')).toBe(true);
  });
  test('settings are saved', async () => {
    await store.updateSettings({ countMode: 'all' });
    const again = new Store();
    await again.init(repo);
    expect(again.settings.value.countMode).toBe('all');
  });
  test('erase all clears the database', async () => {
    await store.tap(FRANCE);
    await store.eraseAll();
    expect(await repo.loadPlaces()).toEqual([]);
  });
});

describe('Store derived data for the map', () => {
  test('lists visited and want-to-go ids per level', async () => {
    await store.tap(FRANCE);
    await store.save(place({ id: 'country:ITA', refId: 'ITA', name: 'Italy', status: 'wishlist' }));
    await store.save(place({ id: 'state:US-NY', kind: 'state', refId: 'US-NY', name: 'New York' }));
    expect(store.mapIds.value).toEqual({
      countries: { visited: ['FRA'], wishlist: ['ITA'] },
      states: { visited: ['US-NY'], wishlist: [] },
    });
  });
});

describe('Store.savePin (dropping a pin)', () => {
  const pin = { name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, countryId: 'FRA', admin1: null };
  test('saves a new pin', async () => {
    const r = await store.savePin(pin, 'visited');
    expect(r.kind).toBe('saved');
    expect([...store.places.value.values()].filter((p) => p.kind === 'pin')).toHaveLength(1);
  });
  test('reports a duplicate instead of creating a second pin', async () => {
    await store.savePin(pin, 'visited');
    const r = await store.savePin({ ...pin, lat: 48.8586 }, 'visited');
    expect(r.kind).toBe('duplicate');
    expect([...store.places.value.values()].filter((p) => p.kind === 'pin')).toHaveLength(1);
  });
  test('"add a visit instead" adds a dated visit to the existing pin', async () => {
    await store.savePin(pin, 'visited');
    const r = await store.savePin({ ...pin, lat: 48.8586 }, 'visited');
    if (r.kind !== 'duplicate') throw new Error('expected duplicate');
    await store.addVisitTo(r.existing.id, '2025-06');
    expect(store.places.value.get(r.existing.id)?.visits).toEqual([{ start: '2025-06' }]);
  });
  test('force-saving keeps both pins', async () => {
    await store.savePin(pin, 'visited');
    await store.savePin({ ...pin, lat: 48.8586 }, 'visited', { force: true });
    expect([...store.places.value.values()].filter((p) => p.kind === 'pin')).toHaveLength(2);
  });
});

describe('Store.importPlaces', () => {
  test('merge keeps what you have and adds the file', async () => {
    await store.tap(FRANCE);
    await store.importPlaces([place({ id: 'country:ITA', refId: 'ITA', name: 'Italy' })], 'merge');
    expect([...store.places.value.keys()].sort()).toEqual(['country:FRA', 'country:ITA']);
    expect((await repo.loadPlaces())).toHaveLength(2);
  });
  test('replace swaps everything', async () => {
    await store.tap(FRANCE);
    await store.importPlaces([place({ id: 'country:ITA', refId: 'ITA', name: 'Italy' })], 'replace');
    expect([...store.places.value.keys()]).toEqual(['country:ITA']);
    expect((await repo.loadPlaces()).map((p) => p.id)).toEqual(['country:ITA']);
  });
});
