/** Actions that touch the outside world (files, install prompt). */
import { signal } from '@preact/signals';
import { buildExport } from '../lib/importExport';
import { readFileText, saveTextFile, todayStamp } from '../lib/download';
import { parseExport, type ParsedExport } from '../lib/importExport';
import { store } from '../store';

/** Saves a backup file and remembers when. */
export async function exportBackup(): Promise<void> {
  const file = buildExport([...store.places.value.values()], store.settings.value);
  const name = `travel-tracker-${todayStamp()}.json`;
  const result = await saveTextFile(name, JSON.stringify(file, null, 2));
  if (result === 'cancelled') return;
  await store.updateSettings({ lastExportedAt: new Date().toISOString() });
  store.showToast(result === 'downloaded' ? `Saved ${name} to your downloads` : 'Backup saved');
}

/** Reads and validates a chosen file. Throws an Error with a readable message. */
export async function readBackup(file: File): Promise<ParsedExport> {
  return parseExport(await readFileText(file));
}

/** True when a backup is worth nagging about: you have data and haven't saved it lately. */
export function backupOverdue(): boolean {
  if (store.places.value.size < 3) return false;
  const last = store.settings.value.lastExportedAt;
  if (!last) return true;
  return Date.now() - Date.parse(last) > 30 * 86_400_000;
}

/* ---- "Add to Home Screen" (Chrome/Android gives us a prompt to trigger) ---- */
interface InstallEvent extends Event { prompt(): Promise<void> }
export const installPrompt = signal<InstallEvent | null>(null);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt.value = e as InstallEvent; });
window.addEventListener('appinstalled', () => { installPrompt.value = null; });

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
