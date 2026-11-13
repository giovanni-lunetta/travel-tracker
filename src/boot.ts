/** Starts the app: opens the database and loads the map data in parallel. */
import { signal } from '@preact/signals';
import { ensureSearchIndex, loadCoreData } from './data/load';
import { createRepo } from './lib/db';
import { store } from './store';

export const bootError = signal<string | null>(null);

export async function boot(): Promise<void> {
  bootError.value = null;
  try {
    const [repo, data] = await Promise.all([createRepo(), loadCoreData()]);
    store.data.value = data;
    await store.init(repo);
    // Ask the browser not to clear our data under storage pressure (best effort; iOS may ignore it).
    void navigator.storage?.persist?.();
    // Warm the city index (and the service-worker cache) shortly after start so search works offline.
    window.setTimeout(() => { void ensureSearchIndex().catch(() => {}); }, 4000);
  } catch (err) {
    console.error(err);
    bootError.value = err instanceof Error ? err.message : String(err);
  }
}
