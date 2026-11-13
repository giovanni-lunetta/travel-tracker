/**
 * The detail sheet. It shows one of three things:
 *   target  – a country/state/city you haven't tracked yet (choose visited / want to go)
 *   newpin  – a pin you just dropped (name it, then save)
 *   place   – something you track: dates, rating, tags, notes (all saved as you type)
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ensureSearchIndex, lookups } from '../data/load';
import { formatVisit, visitIsValid } from '../lib/dates';
import { nearestCity, type NearestCity } from '../lib/search';
import { store, type SavePinResult } from '../store';
import type { Catalog, Place, Status, Visit } from '../types';
import { Icon } from './icons';
import { Sheet } from './Sheet';

const KIND_LABEL = { un: 'Country', observer: 'Country (UN observer)', partial: 'Disputed or partly recognised', territory: 'Territory' } as const;
const now = () => new Date().toISOString();

/** One line describing what/where a place is. */
function describe(p: Place, catalog: Catalog): string {
  const { country, state } = lookups(catalog);
  if (p.kind === 'country') {
    const c = country.get(p.refId ?? '');
    if (!c) return 'Country';
    const sov = c.kind === 'territory' && c.sov !== c.id ? [...country.values()].find((x) => x.sov === c.sov && x.kind === 'un')?.name : undefined;
    return c.kind === 'territory' && sov ? `Territory of ${sov}` : KIND_LABEL[c.kind];
  }
  if (p.kind === 'state') return 'US state';
  const where = [p.admin1 ? state.get(p.admin1)?.name : '', p.countryId ? country.get(p.countryId)?.name : ''].filter(Boolean).join(', ');
  return where || (p.lat !== null ? `${p.lat.toFixed(3)}, ${p.lon?.toFixed(3)}` : '');
}

function Segmented({ value, onChange }: { value: Status | null; onChange: (s: Status) => void }) {
  return (
    <div class="seg" role="group" aria-label="Status">
      <button class={value === 'visited' ? 'on' : ''} aria-pressed={value === 'visited'} onClick={() => onChange('visited')}>Visited</button>
      <button class={value === 'wishlist' ? 'on' : ''} aria-pressed={value === 'wishlist'} onClick={() => onChange('wishlist')}>Want to go</button>
    </div>
  );
}

/** Country (and, for the US, state) pickers for cities and pins. */
function WhereFields({ countryId, admin1, onChange }: {
  countryId: string | null; admin1: string | null; onChange: (c: string | null, a: string | null) => void;
}) {
  const catalog = store.data.value!.catalog;
  const countries = useMemo(() => [...catalog.countries].sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
  return (
    <div class="field">
      <label for="where-country">Located in</label>
      <select id="where-country" value={countryId ?? ''} onChange={(e) => onChange(e.currentTarget.value || null, null)}>
        <option value="">Not set</option>
        {countries.map((c) => <option value={c.id}>{c.name}</option>)}
      </select>
      {countryId === 'USA' && (
        <select aria-label="State" value={admin1 ?? ''} onChange={(e) => onChange(countryId, e.currentTarget.value || null)}>
          <option value="">State not set</option>
          {catalog.states.map((s) => <option value={s.id}>{s.name}</option>)}
        </select>
      )}
    </div>
  );
}

/* ----------------------------- untracked target ----------------------------- */

function TargetView({ t }: { t: Extract<NonNullable<typeof store.sheet.value>, { type: 'target' }> }) {
  const mark = async (status: Status) => {
    const p = await store.setStatus(t.target, status);
    store.sheet.value = { type: 'place', id: p.id };
    store.showToast(status === 'visited' ? `${t.target.name} marked visited` : `${t.target.name} added to want to go`);
  };
  return (
    <>
      <p class="muted">Not on your map yet.</p>
      <div class="btn-row">
        <button class="btn primary" onClick={() => void mark('visited')}><Icon name="check" size={18} /> Mark visited</button>
        <button class="btn" onClick={() => void mark('wishlist')}><Icon name="flag" size={18} /> Want to go</button>
      </div>
    </>
  );
}

/* ------------------------------- dropped pin -------------------------------- */

function NewPinView({ s }: { s: Extract<NonNullable<typeof store.sheet.value>, { type: 'newpin' }> }) {
  const [name, setName] = useState(s.name);
  const [status, setStatus] = useState<Status>('visited');
  const [countryId, setCountryId] = useState(s.countryId);
  const [admin1, setAdmin1] = useState(s.admin1);
  const [hint, setHint] = useState<NearestCity | null>(null);
  const [dup, setDup] = useState<Extract<SavePinResult, { kind: 'duplicate' }> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    let alive = true;
    ensureSearchIndex().then(() => {
      const idx = store.searchIndex.value;
      if (alive && idx) setHint(nearestCity(idx, s.lat, s.lon, 25));
    }).catch(() => { /* the hint is a nicety; the pin works without it */ });
    return () => { alive = false; };
  }, [s.lat, s.lon]);

  const draft = () => ({ name: name.trim() || 'Dropped pin', lat: s.lat, lon: s.lon, countryId: countryId ?? hint?.countryId ?? null, admin1 });
  const save = async (force = false) => {
    const r = await store.savePin(draft(), status, { force });
    if (r.kind === 'duplicate') { setDup(r); return; }
    store.sheet.value = { type: 'place', id: r.place.id };
    store.showToast('Pin saved');
  };
  const addVisit = async () => {
    if (!dup) return;
    await store.addVisitTo(dup.existing.id, new Date().toISOString().slice(0, 7));
    store.sheet.value = { type: 'place', id: dup.existing.id };
    store.showToast(`Added a visit to ${dup.existing.name}`);
  };

  if (dup) {
    return (
      <>
        <p>You already have <strong>{dup.existing.name}</strong> here.</p>
        <div class="btn-row">
          <button class="btn primary" onClick={() => void addVisit()}>Add a visit to it</button>
          <button class="btn" onClick={() => void save(true)}>Save as a separate pin</button>
          <button class="btn ghost" onClick={() => setDup(null)}>Back</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div class="field">
        <label for="pin-name">Name</label>
        <input id="pin-name" ref={input} value={name} placeholder={hint ? `e.g. ${hint.name}` : 'Name this place'}
          autocomplete="off" onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} />
        {hint && !name.trim() && (
          <button class="chip-btn" onClick={() => setName(hint.name)}>Near {hint.name}{hint.distKm >= 1 ? ` · ${Math.round(hint.distKm)} km` : ''}. Use this name</button>
        )}
      </div>
      <Segmented value={status} onChange={setStatus} />
      <WhereFields countryId={countryId ?? hint?.countryId ?? null} admin1={admin1} onChange={(c, a) => { setCountryId(c); setAdmin1(a); }} />
      <div class="btn-row">
        <button class="btn primary" onClick={() => void save()}>Save pin</button>
        <button class="btn ghost" onClick={() => { store.sheet.value = null; }}>Cancel</button>
      </div>
    </>
  );
}

/* ------------------------------- tracked place ------------------------------ */

function PlaceView({ id }: { id: string }) {
  const p = store.places.value.get(id);
  const [notes, setNotes] = useState(p?.notes ?? '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [err, setErr] = useState('');
  const [tag, setTag] = useState('');
  const timer = useRef<number | undefined>(undefined);

  /** Always edit the freshest copy, never a stale one captured by a timer. */
  const upd = (patch: Partial<Place>) => {
    const cur = store.places.value.get(id);
    if (cur) void store.save({ ...cur, ...patch, updatedAt: now() });
  };
  const flushNotes = (value: string) => { window.clearTimeout(timer.current); if (value !== store.places.value.get(id)?.notes) upd({ notes: value }); };
  useEffect(() => () => flushNotes(notesRef.current), []);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const allTags = useMemo(() => [...new Set([...store.places.value.values()].flatMap((x) => x.tags))].sort(), [store.places.value]);
  if (!p) return null;

  const addVisit = () => {
    const v: Visit = { start: start.trim() };
    if (end.trim()) v.end = end.trim();
    if (!visitIsValid(v)) { setErr('Use a year (2019), month (2019-07) or day (2019-07-04). The end can’t be before the start.'); return; }
    const visits = [...p.visits, v].sort((a, b) => (a.start + (a.end ?? '')).localeCompare(b.start + (b.end ?? '')));
    upd({ visits, status: 'visited' });
    setStart(''); setEnd(''); setErr('');
  };
  const addTag = () => {
    const t = tag.trim().replace(/,$/, '');
    if (t && !p.tags.some((x) => x.toLowerCase() === t.toLowerCase())) upd({ tags: [...p.tags, t] });
    setTag('');
  };

  return (
    <>
      <Segmented value={p.status} onChange={(status) => upd({ status })} />

      <section class="field">
        <h3>Trips</h3>
        {p.visits.length === 0 && <p class="muted small">No dates yet. Add one if you remember when.</p>}
        <ul class="plain">
          {p.visits.map((v, i) => (
            <li class="row">
              <span>{formatVisit(v)}</span>
              <button class="icon-btn small" aria-label={`Remove trip ${formatVisit(v)}`} onClick={() => upd({ visits: p.visits.filter((_, j) => j !== i) })}><Icon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
        <div class="inline">
          <input aria-label="Trip start" placeholder="Start: 2019 or 2019-07" inputMode="numeric" value={start} onInput={(e) => { setStart(e.currentTarget.value); setErr(''); }} />
          <input aria-label="Trip end (optional)" placeholder="End (optional)" inputMode="numeric" value={end} onInput={(e) => { setEnd(e.currentTarget.value); setErr(''); }} />
          <button class="btn" onClick={addVisit} disabled={!start.trim()}>Add</button>
        </div>
        {err && <p class="error small" role="alert">{err}</p>}
      </section>

      <section class="field">
        <h3>Rating</h3>
        <div class="stars" role="group" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={p.rating === n} class={(p.rating ?? 0) >= n ? 'on' : ''}
              onClick={() => upd({ rating: p.rating === n ? null : n })}><Icon name="star" size={26} filled={(p.rating ?? 0) >= n} /></button>
          ))}
        </div>
      </section>

      <section class="field">
        <h3>Tags</h3>
        <div class="chips">
          {p.tags.map((t) => (
            <span class="chip">{t}<button aria-label={`Remove tag ${t}`} onClick={() => upd({ tags: p.tags.filter((x) => x !== t) })}><Icon name="close" size={14} /></button></span>
          ))}
        </div>
        <input aria-label="Add a tag" placeholder="Add a tag, then press Enter" list="tag-suggestions" value={tag}
          onInput={(e) => setTag(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag} />
        <datalist id="tag-suggestions">{allTags.map((t) => <option value={t} />)}</datalist>
      </section>

      <section class="field">
        <h3><label for="notes">Notes</label></h3>
        <textarea id="notes" rows={4} placeholder="What do you want to remember?" value={notes}
          onInput={(e) => {
            const v = e.currentTarget.value;
            setNotes(v);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => flushNotes(v), 700);
          }}
          onBlur={() => flushNotes(notes)} />
      </section>

      {(p.kind === 'city' || p.kind === 'pin') && (
        <WhereFields countryId={p.countryId} admin1={p.admin1} onChange={(countryId, admin1) => upd({ countryId, admin1 })} />
      )}

      <button class="btn danger ghost" onClick={() => void store.requestRemove(p.id)}><Icon name="trash" size={18} /> Remove from my map</button>
    </>
  );
}

/* --------------------------------- the sheet -------------------------------- */

export function PlaceSheet() {
  const s = store.sheet.value;
  const data = store.data.value;
  if (!s || !data) return null;
  const close = () => { store.sheet.value = null; };

  if (s.type === 'place') {
    const p = store.places.value.get(s.id);
    if (!p) return null;
    return (
      <Sheet label={p.name} onClose={close}
        header={<><h2>{p.name}</h2><p class="muted small">{describe(p, data.catalog)}</p></>}>
        <PlaceView key={p.id} id={p.id} />
      </Sheet>
    );
  }
  if (s.type === 'target') {
    return (
      <Sheet label={s.target.name} onClose={close} header={<><h2>{s.target.name}</h2><p class="muted small">{s.sub ?? ''}</p></>}>
        <TargetView t={s} />
      </Sheet>
    );
  }
  return (
    <Sheet label="New pin" onClose={close} header={<><h2>New pin</h2><p class="muted small">{s.lat.toFixed(3)}, {s.lon.toFixed(3)}</p></>}>
      <NewPinView s={s} key={`${s.lat},${s.lon}`} />
    </Sheet>
  );
}
