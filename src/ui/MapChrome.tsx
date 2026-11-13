/** Floating controls over the map: search, the Countries / US states / Places switch. */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { countryTarget, ensureSearchIndex, lookups, stateTarget } from '../data/load';
import { search, type SearchHit } from '../lib/search';
import { store, type Level, type Target } from '../store';
import { getMap, fitMap } from './MapView';
import { Icon } from './icons';

function SearchBar() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');      // debounced copy of q
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const index = store.searchIndex.value;

  useEffect(() => { const id = window.setTimeout(() => setQuery(q), 60); return () => window.clearTimeout(id); }, [q]);
  useEffect(() => { if (open) ensureSearchIndex().catch(() => setFailed(true)); }, [open]);
  const hits = useMemo(() => (index ? search(index, query, 25) : []), [index, query]);

  const close = () => { setOpen(false); setQ(''); input.current?.blur(); };

  function pick(hit: SearchHit) {
    const data = store.data.value!;
    const { country, state } = lookups(data.catalog);
    let target: Target | null = null;
    if (hit.type === 'country') {
      const c = country.get(hit.id)!;
      target = countryTarget(c);
      store.level.value = 'countries';
      store.fly(c.lon, c.lat, c.tiny ? 6 : 3.2);
    } else if (hit.type === 'state') {
      target = stateTarget(state.get(hit.id)!);
      store.level.value = 'states';
      store.fly(hit.lon, hit.lat, 5);
    } else {
      target = { kind: 'city', refId: hit.id, name: hit.name, countryId: hit.countryId, admin1: hit.admin1, lat: hit.lat, lon: hit.lon };
      store.fly(hit.lon, hit.lat, 9);
    }
    const existing = store.placeFor(target.kind, target.refId);
    store.sheet.value = existing ? { type: 'place', id: existing.id } : { type: 'target', target, sub: hit.sub };
    close();
  }

  return (
    <>
      <div class="searchbar">
        <Icon name="search" size={20} />
        <input ref={input} type="search" value={q} placeholder="Search countries, states, cities" enterkeyhint="search"
          aria-label="Search places" autocomplete="off" autocapitalize="off" spellcheck={false}
          onFocus={() => setOpen(true)} onInput={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && hits[0]) pick(hits[0]); }} />
        {open
          ? <button class="text-btn" onClick={close}>Cancel</button>
          : <button class="icon-btn" aria-label="Settings" onClick={() => { store.tab.value = 'settings'; }}><Icon name="gear" /></button>}
      </div>
      {open && (
        <div class="search-panel" role="listbox" aria-label="Search results">
          {failed && <p class="muted pad">Couldn't load the city list. Check your connection and try again.</p>}
          {!failed && !index && <p class="muted pad">Loading cities…</p>}
          {index && query.trim() === '' && <p class="muted pad">Try “Tokyo”, “Côte d’Ivoire”, “NY” or “Vatican”.</p>}
          {index && query.trim() !== '' && hits.length === 0 && <p class="muted pad">No match. Drop a pin on the map to add any place by hand.</p>}
          {hits.map((h) => {
            const tracked = store.placeFor(h.type === 'city' ? 'city' : h.type, h.id);
            return (
              <button class="result" role="option" onClick={() => pick(h)} key={h.type + h.id}>
                <Icon name={h.type === 'city' ? 'pin' : 'map'} size={20} />
                <span class="result-text"><span class="result-name">{h.name}</span><span class="muted small">{h.sub}</span></span>
                {tracked && <span class={`badge ${tracked.status}`}>{tracked.status === 'visited' ? 'Visited' : 'Want to go'}</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

const LEVELS: { id: Level; label: string }[] = [
  { id: 'countries', label: 'Countries' },
  { id: 'states', label: 'US states' },
  { id: 'places', label: 'Places' },
];
const STATE_VIEWS: { label: string; bounds: [[number, number], [number, number]]; zoom: number }[] = [
  { label: 'Lower 48', bounds: [[-126, 23.5], [-65, 50]], zoom: 5 },
  { label: 'Alaska', bounds: [[-170, 51], [-129, 72]], zoom: 4 },
  { label: 'Hawaii', bounds: [[-161, 18.5], [-154, 22.5]], zoom: 7 },
];

export function MapChrome() {
  const level = store.level.value;
  return (
    <div class="chrome">
      <SearchBar />
      <div class="seg floating" role="group" aria-label="What to mark">
        {LEVELS.map((l) => (
          <button class={level === l.id ? 'on' : ''} aria-pressed={level === l.id} onClick={() => { store.level.value = l.id; }}>{l.label}</button>
        ))}
      </div>
      {level === 'places' && <p class="hint">Tap the map to drop a pin. Tap a dot to open it.</p>}
      {level === 'states' && (
        <div class="chips-row">
          {STATE_VIEWS.map((v) => <button class="chip-btn" onClick={() => fitMap(getMap(), v.bounds, v.zoom)}>{v.label}</button>)}
        </div>
      )}
    </div>
  );
}
