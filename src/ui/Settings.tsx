/** Settings: backup, how things are counted, map options, install help, about. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { mergeImport, type MergeSummary, type ParsedExport } from '../lib/importExport';
import { store } from '../store';
import type { CountMode } from '../types';
import pkg from '../../package.json';
import { exportBackup, installPrompt, isIOS, isStandalone, readBackup } from './actions';
import { BackupNudge } from './BackupNudge';
import { Icon } from './icons';

const MODES: { id: CountMode; title: string; body: string }[] = [
  { id: 'un195', title: '195 countries', body: '193 UN member states plus the Vatican and Palestine (UN observers). Territories you visit are shown separately.' },
  { id: 'un193', title: '193 countries', body: 'UN member states only.' },
  { id: 'all', title: 'Everything on the map', body: 'Every country, territory and disputed place (about 245). Good if you count places like Greenland or Hong Kong.' },
];

/* ---------------------------------- import --------------------------------- */

function ImportDialog({ parsed, onClose }: { parsed: ParsedExport; onClose: () => void }) {
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const existing = [...store.places.value.values()];
  const summary: MergeSummary = mergeImport(existing, parsed.places, mode).summary;

  const apply = async () => {
    const run = async () => {
      const s = await store.importPlaces(parsed.places, mode);
      store.showToast(mode === 'replace' ? `Replaced with ${s.added} places` : `Imported: ${s.added} new, ${s.updated} updated${s.merged ? `, ${s.merged} duplicate ${s.merged === 1 ? 'pin' : 'pins'} merged` : ''}`);
      onClose();
    };
    if (mode === 'replace' && existing.length > 0) {
      onClose();
      store.ask('Replace everything?', `Your ${existing.length} current places will be swapped for the ${parsed.places.length} in the file. Export a backup first if you might want them.`, 'Replace', run);
    } else await run();
  };

  return (
    <div class="modal-scrim" onClick={onClose}>
      <div class="modal" role="dialog" aria-labelledby="imp-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="imp-title">Import {parsed.places.length} places?</h2>
        {parsed.skipped > 0 && <p class="muted small">{parsed.skipped} unreadable {parsed.skipped === 1 ? 'row was' : 'rows were'} skipped.</p>}
        <div class="choice-list">
          <label class="choice"><input type="radio" name="imp" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            <span><strong>Merge</strong><span class="muted small">Keep what you have and add the file. Newer notes win; trips and tags from both are kept.</span></span></label>
          <label class="choice"><input type="radio" name="imp" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            <span><strong>Replace</strong><span class="muted small">Your places become exactly what’s in the file.</span></span></label>
        </div>
        <p class="preview" aria-live="polite">
          {mode === 'merge'
            ? `${summary.added} new · ${summary.updated} updated · ${summary.unchanged} unchanged${summary.merged ? ` · ${summary.merged} duplicate ${summary.merged === 1 ? 'pin' : 'pins'} merged` : ''}`
            : `${summary.added} places · ${summary.removed} of yours removed`}
        </p>
        <div class="btn-row">
          <button class="btn" onClick={onClose}>Cancel</button>
          <button class="btn primary" onClick={() => void apply()}>{mode === 'merge' ? 'Merge' : 'Replace'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- screen ---------------------------------- */

export function Settings() {
  const s = store.settings.value;
  const n = store.places.value.size;
  const [parsed, setParsed] = useState<ParsedExport | null>(null);
  const [error, setError] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState('');
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1_048_576).toFixed(1)} MB used on this device`)).catch(() => {});
  }, []);

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try { setError(''); setParsed(await readBackup(f)); }
    catch (err) { setError((err as Error).message); }
  }

  const last = s.lastExportedAt ? new Date(s.lastExportedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
  const prompt = installPrompt.value;

  return (
    <section class="screen scroll" aria-label="Settings">
      <header class="screen-head"><h1>Settings</h1></header>
      <BackupNudge />

      <div class="group">
        <h2>Your data</h2>
        <p class="muted">Everything is stored on this device only. There’s no account and nothing is uploaded. Save a backup file now and then, and use it to move to a new phone.</p>
        <div class="btn-row">
          <button class="btn primary" onClick={() => void exportBackup()} disabled={n === 0}><Icon name="download" size={18} /> Export backup</button>
          <button class="btn" onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Import…</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
        {error && <p class="error" role="alert">{error}</p>}
        <p class="muted small">{last ? `Last backup: ${last}.` : 'No backup yet.'} {n} {n === 1 ? 'place' : 'places'} tracked.</p>
        <p class="muted small">
          {persisted === true ? 'Storage is protected from automatic cleanup. ' : persisted === false ? 'The browser may clear this data if the device runs low on space. ' : ''}
          {usage}
          {persisted === false && (
            <> <button class="text-btn" onClick={async () => setPersisted(await navigator.storage.persist())}>Ask the browser to protect it</button></>
          )}
        </p>
      </div>

      <div class="group">
        <h2>Counting</h2>
        <div class="choice-list">
          {MODES.map((m) => (
            <label class="choice">
              <input type="radio" name="mode" checked={s.countMode === m.id} onChange={() => void store.updateSettings({ countMode: m.id })} />
              <span><strong>{m.title}</strong><span class="muted small">{m.body}</span></span>
            </label>
          ))}
        </div>
      </div>

      <div class="group">
        <h2>Map</h2>
        <label class="switch">
          <input type="checkbox" checked={s.labels} onChange={(e) => void store.updateSettings({ labels: e.currentTarget.checked })} />
          <span><strong>Place names</strong><span class="muted small">Loads map fonts from OpenFreeMap the first time you’re online, then they work offline. Turn off to make no network requests at all.</span></span>
        </label>
        <label class="switch">
          <input type="checkbox" checked={s.streets} onChange={(e) => void store.updateSettings({ streets: e.currentTarget.checked })} />
          <span><strong>Street map when online</strong><span class="muted small">Adds roads and towns when you zoom in, from OpenFreeMap (free). Needs internet; the offline map is used otherwise.</span></span>
        </label>
      </div>

      <div class="group">
        <h2>Install on your phone</h2>
        {isStandalone() ? <p class="muted">Installed. You’re using it as an app.</p>
          : prompt ? <button class="btn primary" onClick={() => void prompt.prompt()}>Install app</button>
          : isIOS() ? <p class="muted">In Safari, tap the Share button, then <strong>Add to Home Screen</strong>. Installing also protects your data from Safari’s 7-day cleanup.</p>
          : <p class="muted">In Chrome, open the menu and choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</p>}
      </div>

      <div class="group">
        <h2>How places are counted</h2>
        <ul class="notes">
          <li><strong>Countries</strong> follow the UN list (193 members) plus two observers. Taiwan, Kosovo, Western Sahara, Somaliland and Northern Cyprus are marked as disputed or partly recognised and count as “extra”, not toward the 195, unless you choose “Everything on the map”.</li>
          <li><strong>Territories</strong> such as Puerto Rico, Greenland, Hong Kong and Guam are tracked separately and shown as extra. Tap them like any country.</li>
          <li><strong>Borders</strong> are drawn by who actually controls the land (Natural Earth’s default). Showing a border is not a political statement.</li>
          <li><strong>Pins</strong> within about 150 m of an existing pin, or about 1 km with a similar name, are treated as duplicates and you’re asked first.</li>
        </ul>
      </div>

      <div class="group">
        <h2>About</h2>
        <p class="muted">Travel Tracker {pkg.version}. Free, private, no ads. Your places never leave this device.</p>
        <p class="muted small">Map shapes: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> (public domain). City names: <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a> (CC BY 4.0). Optional labels and streets: <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>, OpenMapTiles and © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors. Map engine: <a href="https://maplibre.org/" target="_blank" rel="noopener">MapLibre</a> (BSD-3).</p>
      </div>

      <div class="group">
        <h2>Erase</h2>
        <button class="btn danger" disabled={n === 0} onClick={() => store.ask('Erase everything?', `This deletes all ${n} places from this device. Export a backup first if you might want them back.`, 'Erase everything', async () => { await store.eraseAll(); store.showToast('Everything was erased'); })}>
          <Icon name="trash" size={18} /> Erase all my places
        </button>
      </div>

      {parsed && <ImportDialog parsed={parsed} onClose={() => setParsed(null)} />}
    </section>
  );
}
