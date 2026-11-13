import { backupOverdue, exportBackup } from './actions';
import { store } from '../store';

/** A gentle reminder: data lives only on this device, so back it up now and then. */
export function BackupNudge() {
  void store.places.value; void store.settings.value;
  if (!backupOverdue()) return null;
  const last = store.settings.value.lastExportedAt;
  const days = last ? Math.floor((Date.now() - Date.parse(last)) / 86_400_000) : null;
  return (
    <div class="nudge" role="note">
      <span>{days === null ? 'Your places are only on this device.' : `Last backup was ${days} days ago.`} Save a copy so they can't get lost.</span>
      <button class="btn small" onClick={() => void exportBackup()}>Export backup</button>
    </div>
  );
}
