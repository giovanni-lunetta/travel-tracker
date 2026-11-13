/**
 * Storage: everything lives in the browser's IndexedDB, on this device only.
 * There is no server and no account.
 */
import { openDB, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Place, type Settings } from '../types';

const SETTINGS_KEY = 'app';

export interface Repo {
  loadPlaces(): Promise<Place[]>;
  putPlace(p: Place): Promise<void>;
  putPlaces(ps: Place[]): Promise<void>;
  deletePlace(id: string): Promise<void>;
  /** Replaces everything (used by "Replace" import and "Erase all"). Atomic. */
  replaceAll(ps: Place[]): Promise<void>;
  loadSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  close(): void;
}

export async function createRepo(dbName = 'travel-tracker'): Promise<Repo> {
  const db: IDBPDatabase = await openDB(dbName, 1, {
    upgrade(d) {
      d.createObjectStore('places', { keyPath: 'id' });
      d.createObjectStore('settings');
    },
  });
  return {
    loadPlaces: () => db.getAll('places'),
    async putPlace(p) { await db.put('places', p); },
    async putPlaces(ps) {
      const tx = db.transaction('places', 'readwrite');
      await Promise.all([...ps.map((p) => tx.store.put(p)), tx.done]);
    },
    async deletePlace(id) { await db.delete('places', id); },
    async replaceAll(ps) {
      const tx = db.transaction('places', 'readwrite');
      await tx.store.clear();
      await Promise.all([...ps.map((p) => tx.store.put(p)), tx.done]);
    },
    async loadSettings() {
      return { ...DEFAULT_SETTINGS, ...((await db.get('settings', SETTINGS_KEY)) as Partial<Settings> | undefined) };
    },
    async saveSettings(s) { await db.put('settings', s, SETTINGS_KEY); },
    close: () => db.close(),
  };
}
