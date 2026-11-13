/** Everything you've tracked, as a list. Also the keyboard- and screen-reader-friendly way in. */
import { useMemo, useState } from 'preact/hooks';
import { lookups } from '../data/load';
import { fold } from '../lib/search';
import { store } from '../store';
import type { Place, Status } from '../types';
import { BackupNudge } from './BackupNudge';
import { focusPlace } from './focus';

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name);

function years(p: Place): string {
  const ys = [...new Set(p.visits.map((v) => v.start.slice(0, 4)))].sort();
  return ys.length > 3 ? `${ys[0]} – ${ys[ys.length - 1]}` : ys.join(', ');
}

function Row({ p, sub }: { p: Place; sub?: string }) {
  const meta = [sub, years(p), p.rating ? '★'.repeat(p.rating) : ''].filter(Boolean).join(' · ');
  return (
    <li>
      <button class="list-row" onClick={() => focusPlace(p)}>
        <span class="list-name">{p.name}</span>
        {meta && <span class="muted small">{meta}</span>}
      </button>
    </li>
  );
}

export function Lists() {
  const [status, setStatus] = useState<Status>('visited');
  const [filter, setFilter] = useState('');
  const data = store.data.value!;
  const { country } = lookups(data.catalog);
  const all = [...store.places.value.values()];
  const counts = { visited: all.filter((p) => p.status === 'visited').length, wishlist: all.filter((p) => p.status === 'wishlist').length };

  const view = useMemo(() => {
    const f = fold(filter);
    const mine = all.filter((p) => p.status === status && (!f || fold(p.name).includes(f)));
    const countries = mine.filter((p) => p.kind === 'country').sort(byName);
    const byContinent = new Map<string, Place[]>();
    for (const p of countries) {
      const cont = country.get(p.refId ?? '')?.cont ?? 'Other';
      byContinent.set(cont, [...(byContinent.get(cont) ?? []), p]);
    }
    return {
      continents: [...byContinent.entries()].sort(([a], [b]) => a.localeCompare(b)),
      states: mine.filter((p) => p.kind === 'state').sort(byName),
      places: mine.filter((p) => p.kind === 'city' || p.kind === 'pin').sort(byName),
      total: mine.length,
    };
  }, [store.places.value, status, filter]);

  return (
    <section class="screen scroll" aria-label="Lists">
      <header class="screen-head"><h1>Lists</h1></header>
      <BackupNudge />
      <div class="seg" role="group" aria-label="List">
        <button class={status === 'visited' ? 'on' : ''} aria-pressed={status === 'visited'} onClick={() => setStatus('visited')}>Visited · {counts.visited}</button>
        <button class={status === 'wishlist' ? 'on' : ''} aria-pressed={status === 'wishlist'} onClick={() => setStatus('wishlist')}>Want to go · {counts.wishlist}</button>
      </div>
      <input class="filter" type="search" placeholder="Filter" aria-label="Filter list" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} />

      {view.total === 0 && (
        <div class="empty">
          <p>{filter ? 'Nothing matches that filter.' : status === 'visited' ? 'No places yet. Tap a country on the map to mark it visited.' : 'Nothing on your want-to-go list yet. Open any place and choose “Want to go”.'}</p>
          <button class="btn primary" onClick={() => { store.tab.value = 'map'; }}>Open the map</button>
        </div>
      )}
      {view.continents.map(([cont, ps]) => (
        <div class="group"><h2>{cont} <span class="muted">{ps.length}</span></h2><ul class="plain">{ps.map((p) => <Row p={p} />)}</ul></div>
      ))}
      {view.states.length > 0 && <div class="group"><h2>US states <span class="muted">{view.states.length}</span></h2><ul class="plain">{view.states.map((p) => <Row p={p} />)}</ul></div>}
      {view.places.length > 0 && (
        <div class="group"><h2>Cities and pins <span class="muted">{view.places.length}</span></h2>
          <ul class="plain">{view.places.map((p) => <Row p={p} sub={p.countryId ? country.get(p.countryId)?.name : undefined} />)}</ul></div>
      )}
    </section>
  );
}
