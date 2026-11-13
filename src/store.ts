/**
 * The app's state and every action that changes it.
 *
 * Kept free of any UI so it can be tested directly. Components read the
 * signals; they never write to the database themselves. Every change is
 * saved to IndexedDB straight away ("write-through"), so closing the app
 * at any moment loses nothing.
 */
import { computed, signal } from '@preact/signals';
import type { Repo } from './lib/db';
import { mergeImport, type MergeSummary } from './lib/importExport';
import { findNearbyDuplicate, hasDetails, makeId, newPlace, toggleVisited } from './lib/places';
import type { SearchIndex } from './lib/search';
import { DEFAULT_SETTINGS, type Catalog, type Kind, type Place, type Settings, type Status } from './types';

export type Tab = 'map' | 'lists' | 'stats' | 'settings';
export type Level = 'countries' | 'states' | 'places';

/** Anything on the map you can tap, tracked or not. */
export interface Target {
  kind: Kind;
  refId: string | null;
  name: string;
  countryId: string | null;
  admin1: string | null;
  lat: number | null;
  lon: number | null;
}

export interface ToastAction { label: string; run: () => void | Promise<void> }
export interface ToastState { id: number; message: string; actions: ToastAction[]; kind: 'info' | 'error' }

export interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/** What the detail sheet is showing. */
export type SheetState =
  | { type: 'place'; id: string }
  | { type: 'target'; target: Target; sub?: string }
  | { type: 'newpin'; lat: number; lon: number; name: string; countryId: string | null; admin1: string | null };

/** Loaded reference data (null until the app finishes starting). */
export interface AppData {
  catalog: Catalog;
  countries: GeoJSON.FeatureCollection;
  states: GeoJSON.FeatureCollection;
}

export type PinDraft = { name: string; lat: number; lon: number; countryId: string | null; admin1: string | null };
export type SavePinResult = { kind: 'saved'; place: Place } | { kind: 'duplicate'; existing: Place };

let toastSeq = 0;

export class Store {
  repo: Repo | null = null;

  ready = signal(false);
  places = signal<Map<string, Place>>(new Map());
  settings = signal<Settings>({ ...DEFAULT_SETTINGS });
  data = signal<AppData | null>(null);
  searchIndex = signal<SearchIndex | null>(null);

  tab = signal<Tab>('map');
  level = signal<Level>('countries');
  sheet = signal<SheetState | null>(null);
  toast = signal<ToastState | null>(null);
  confirm = signal<ConfirmState | null>(null);
  /** The map watches this and flies there; `seq` makes repeat requests distinct. */
  flyTo = signal<{ lon: number; lat: number; zoom?: number; seq: number } | null>(null);

  /** Ids to colour on the map, by level. */
  mapIds = computed(() => {
    const out = {
      countries: { visited: [] as string[], wishlist: [] as string[] },
      states: { visited: [] as string[], wishlist: [] as string[] },
    };
    for (const p of this.places.value.values()) {
      if (!p.refId) continue;
      const bucket = p.kind === 'country' ? out.countries : p.kind === 'state' ? out.states : null;
      bucket?.[p.status].push(p.refId);
    }
    return out;
  });

  /** Cities and pins to draw as dots. */
  pinsGeo = computed(() => ({
    type: 'FeatureCollection' as const,
    features: [...this.places.value.values()]
      .filter((p) => (p.kind === 'city' || p.kind === 'pin') && p.lat !== null && p.lon !== null)
      .map((p) => ({
        type: 'Feature' as const,
        properties: { id: p.id, status: p.status, name: p.name },
        geometry: { type: 'Point' as const, coordinates: [p.lon as number, p.lat as number] },
      })),
  }));

  async init(repo: Repo): Promise<void> {
    this.repo = repo;
    const [places, settings] = await Promise.all([repo.loadPlaces(), repo.loadSettings()]);
    this.places.value = new Map(places.map((p) => [p.id, p]));
    this.settings.value = settings;
    this.ready.value = true;
  }

  placeFor(kind: Kind, refId: string | null): Place | undefined {
    return this.places.value.get(makeId(kind, refId));
  }

  /* ----------------------------- messages ----------------------------- */

  showToast(message: string, actions: ToastAction[] = [], kind: ToastState['kind'] = 'info'): void {
    this.toast.value = { id: ++toastSeq, message, actions, kind };
  }
  dismissToast(): void { this.toast.value = null; }

  ask(title: string, body: string, confirmLabel: string, run: () => Promise<void>): void {
    this.confirm.value = {
      title, body, confirmLabel,
      onConfirm: async () => { this.confirm.value = null; await run(); },
      onCancel: () => { this.confirm.value = null; },
    };
  }

  /* ------------------------------ writes ------------------------------ */

  /** Saves a place (insert or update) in memory and in IndexedDB. */
  async save(p: Place): Promise<void> {
    const next = new Map(this.places.value);
    next.set(p.id, p);
    this.places.value = next;
    await this.persist(() => this.repo!.putPlace(p));
  }

  async remove(id: string): Promise<void> {
    const next = new Map(this.places.value);
    next.delete(id);
    this.places.value = next;
    if (this.sheet.value?.type === 'place' && this.sheet.value.id === id) this.sheet.value = null;
    await this.persist(() => this.repo!.deletePlace(id));
  }

  /** Runs a database write; if it fails the change stays on screen and the user is told. */
  private async persist(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (err) {
      console.error('Save failed', err);
      this.showToast("Couldn't save to this device. Export a backup, then free up some storage.", [], 'error');
    }
  }

  private async restore(prev: Place | undefined, id: string): Promise<void> {
    if (prev) await this.save(prev); else await this.remove(id);
  }

  private async removeWithUndo(existing: Place): Promise<void> {
    await this.remove(existing.id);
    this.showToast(`${existing.name} removed`, [{ label: 'Undo', run: () => this.restore(existing, existing.id) }]);
  }

  /** The Remove button in the sheet: asks first if the place has anything you typed. */
  async requestRemove(id: string): Promise<void> {
    const p = this.places.value.get(id);
    if (!p) return;
    if (hasDetails(p)) {
      this.ask(`Remove ${p.name}?`, 'It has notes, dates, a rating or tags. Removing it deletes them.', 'Remove', () => this.removeWithUndo(p));
    } else {
      await this.removeWithUndo(p);
    }
  }

  /**
   * One tap on a country, state or city:
   * untracked -> visited, want-to-go -> visited, visited -> removed.
   * Removing something that has notes/dates/rating/tags asks first.
   */
  async tap(t: Target): Promise<void> {
    const id = makeId(t.kind, t.refId);
    const existing = this.places.value.get(id);
    if (existing && existing.status === 'visited' && hasDetails(existing)) {
      this.ask(
        `Remove ${t.name}?`,
        'It has notes, dates, a rating or tags. Removing it deletes them.',
        'Remove',
        () => this.removeWithUndo(existing),
      );
      return;
    }
    const next = toggleVisited(existing, t);
    if (next === null) { await this.removeWithUndo(existing!); return; }
    await this.save(next);
    this.showToast(`${t.name} marked visited`, [
      { label: 'Undo', run: () => this.restore(existing, id) },
      { label: 'Details', run: () => { this.sheet.value = { type: 'place', id }; } },
    ]);
  }

  /** Sets visited / want-to-go for a target, creating it if needed. */
  async setStatus(t: Target, status: Status): Promise<Place> {
    const id = makeId(t.kind, t.refId);
    const existing = this.places.value.get(id);
    const next = existing
      ? { ...existing, status, updatedAt: new Date().toISOString() }
      : newPlace({ ...t, status });
    await this.save(next);
    return next;
  }

  /** Saves a dropped pin, unless one is already there (then reports the duplicate). */
  async savePin(draft: PinDraft, status: Status, opts: { force?: boolean } = {}): Promise<SavePinResult> {
    if (!opts.force) {
      const dup = findNearbyDuplicate(this.places.value.values(), draft);
      if (dup) return { kind: 'duplicate', existing: dup };
    }
    const place = newPlace({ kind: 'pin', refId: null, ...draft, status });
    await this.save(place);
    return { kind: 'saved', place };
  }

  /** "Add a visit instead": records another trip on a place you already have. */
  async addVisitTo(id: string, date: string): Promise<void> {
    const p = this.places.value.get(id);
    if (!p) return;
    const visits = p.visits.some((v) => v.start === date && !v.end) ? p.visits : [...p.visits, { start: date }];
    await this.save({ ...p, visits, status: 'visited', updatedAt: new Date().toISOString() });
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    const next = { ...this.settings.value, ...patch };
    this.settings.value = next;
    await this.persist(() => this.repo!.saveSettings(next));
  }

  /** Applies an import. (Use mergeImport directly to preview without saving.) */
  async importPlaces(incoming: Place[], mode: 'merge' | 'replace'): Promise<MergeSummary> {
    const { places, summary } = mergeImport([...this.places.value.values()], incoming, mode);
    this.places.value = new Map(places.map((p) => [p.id, p]));
    await this.persist(() => this.repo!.replaceAll(places));
    return summary;
  }

  async eraseAll(): Promise<void> {
    this.places.value = new Map();
    this.sheet.value = null;
    await this.persist(() => this.repo!.replaceAll([]));
  }

  /* ------------------------------ helpers ------------------------------ */

  fly(lon: number, lat: number, zoom?: number): void {
    this.flyTo.value = { lon, lat, zoom, seq: (this.flyTo.value?.seq ?? 0) + 1 };
  }
}

export const store = new Store();
