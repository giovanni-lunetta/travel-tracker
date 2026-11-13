/**
 * JSON export / import — the "your data can't get trapped" feature.
 *
 * Export writes one self-describing file. Import is defensive: it validates
 * the file, cleans individual rows rather than rejecting the whole thing, and
 * previews what would change before anything is saved.
 */
import { DEFAULT_SETTINGS, type ExportFile, type Kind, type Place, type Settings, type Visit } from '../types';
import { isValidPartialDate, visitIsValid } from './dates';
import { findNearbyDuplicate } from './places';

/** Bump when the file format changes, and teach parseExport to migrate old versions. */
export const SCHEMA_VERSION = 1;

const KINDS: Kind[] = ['country', 'state', 'city', 'pin'];
const EPOCH = '1970-01-01T00:00:00.000Z';

export function buildExport(places: Place[], settings: Settings, now = new Date().toISOString()): ExportFile {
  return { app: 'travel-tracker', schemaVersion: SCHEMA_VERSION, exportedAt: now, places, settings };
}

/* ------------------------------ parsing ------------------------------ */

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown): string | null => (typeof x === 'string' && x.trim() !== '' ? x : null);
const num = (x: unknown, lo: number, hi: number): number | null =>
  typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : null;
const isoOr = (x: unknown, fallback: string): string =>
  typeof x === 'string' && !Number.isNaN(Date.parse(x)) ? x : fallback;

function cleanVisits(x: unknown): Visit[] {
  if (!Array.isArray(x)) return [];
  const out: Visit[] = [];
  for (const raw of x) {
    if (!isObj(raw) || typeof raw.start !== 'string') continue;
    const v: Visit = { start: raw.start };
    if (typeof raw.end === 'string' && raw.end !== '') v.end = raw.end;
    if (typeof raw.note === 'string' && raw.note.trim() !== '') v.note = raw.note;
    if (visitIsValid(v)) out.push(v);
  }
  return out;
}

function cleanTags(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of x) {
    if (typeof t !== 'string') continue;
    const tag = t.trim();
    if (tag && !seen.has(tag.toLowerCase())) { seen.add(tag.toLowerCase()); out.push(tag); }
  }
  return out;
}

/** Returns a clean Place, or null if the row is unusable. */
function cleanPlace(raw: unknown): Place | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name)?.trim();
  if (!id || !name || !KINDS.includes(raw.kind as Kind)) return null;
  if (raw.status !== 'visited' && raw.status !== 'wishlist') return null;
  const kind = raw.kind as Kind;
  const lat = num(raw.lat, -90, 90);
  const lon = num(raw.lon, -180, 180);
  if ((kind === 'city' || kind === 'pin') && (lat === null || lon === null)) return null;
  const updatedAt = isoOr(raw.updatedAt, EPOCH);
  const rating = typeof raw.rating === 'number' && Number.isInteger(raw.rating) && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : null;
  return {
    id, kind, name,
    refId: typeof raw.refId === 'string' ? raw.refId : typeof raw.refId === 'number' ? String(raw.refId) : null,
    countryId: str(raw.countryId), admin1: str(raw.admin1),
    lat, lon, status: raw.status,
    visits: cleanVisits(raw.visits),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    rating, tags: cleanTags(raw.tags),
    createdAt: isoOr(raw.createdAt, updatedAt), updatedAt,
  };
}

function cleanSettings(x: unknown): Settings {
  if (!isObj(x)) return { ...DEFAULT_SETTINGS };
  return {
    countMode: x.countMode === 'un193' || x.countMode === 'all' || x.countMode === 'un195' ? x.countMode : DEFAULT_SETTINGS.countMode,
    lastExportedAt: typeof x.lastExportedAt === 'string' ? x.lastExportedAt : null,
    streets: typeof x.streets === 'boolean' ? x.streets : DEFAULT_SETTINGS.streets,
    labels: typeof x.labels === 'boolean' ? x.labels : DEFAULT_SETTINGS.labels,
  };
}

export interface ParsedExport {
  places: Place[];
  settings: Settings;
  /** Rows that were unusable and left out. */
  skipped: number;
}

/** Throws an Error with a user-readable message if the file can't be used. */
export function parseExport(text: string): ParsedExport {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('This is not a valid JSON file.'); }
  if (!isObj(data) || data.app !== 'travel-tracker') {
    throw new Error("This file doesn't look like a Travel Tracker export.");
  }
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This file was made by a newer version of Travel Tracker. Update the app, then try again.');
  }
  if (!Array.isArray(data.places)) throw new Error('The file has no "places" list.');

  // (Future: migrate older schemaVersions here before cleaning.)
  const places: Place[] = [];
  let skipped = 0;
  for (const raw of data.places) {
    const p = cleanPlace(raw);
    if (p) places.push(p); else skipped++;
  }
  return { places, settings: cleanSettings(data.settings), skipped };
}

/* ------------------------------ merging ------------------------------ */

export interface MergeSummary {
  /** Places in the file that are new to you. */
  added: number;
  /** Places you already had that changed (newer notes, extra visits...). */
  updated: number;
  /** Places you already had that stay exactly as they are. */
  unchanged: number;
  /** Incoming pins recognised as duplicates of pins you already have. */
  merged: number;
  /** Places deleted (only in Replace mode). */
  removed: number;
}

export interface MergeResult { places: Place[]; summary: MergeSummary }

const visitKey = (v: Visit) => `${v.start}|${v.end ?? ''}|${v.note ?? ''}`;

function unionVisits(a: Visit[], b: Visit[]): Visit[] {
  const seen = new Map<string, Visit>();
  for (const v of [...a, ...b]) if (!seen.has(visitKey(v))) seen.set(visitKey(v), { ...v });
  return [...seen.values()].sort((x, y) => (x.start + (x.end ?? '')).localeCompare(y.start + (y.end ?? '')));
}

function unionTags(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...a, ...b]) if (!seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
  return out;
}

/** The newer copy wins for single values; visits and tags from both are kept. */
function combine(mine: Place, theirs: Place): Place {
  const newer = theirs.updatedAt > mine.updatedAt ? theirs : mine;
  return {
    ...newer,
    id: mine.id,
    createdAt: mine.createdAt < theirs.createdAt ? mine.createdAt : theirs.createdAt,
    updatedAt: mine.updatedAt > theirs.updatedAt ? mine.updatedAt : theirs.updatedAt,
    visits: unionVisits(mine.visits, theirs.visits),
    tags: unionTags(mine.tags, theirs.tags),
  };
}

/**
 * Combines imported places with the ones you have. Never mutates its inputs,
 * so the UI can call it just to preview the summary.
 *
 * merge:   keep everything you have, add/update from the file.
 * replace: your places become exactly the file's (duplicates inside the file
 *          are still folded together).
 */
export function mergeImport(existing: Place[], incoming: Place[], mode: 'merge' | 'replace'): MergeResult {
  const base = mode === 'replace' ? [] : structuredClone(existing);
  const byId = new Map(base.map((p) => [p.id, p]));
  const changed = new Set<string>();
  let added = 0, updated = 0, merged = 0;

  for (const inc of incoming) {
    let target = byId.get(inc.id);
    let viaDuplicate = false;
    if (!target && inc.kind === 'pin' && inc.lat !== null && inc.lon !== null) {
      target = findNearbyDuplicate(byId.values(), { name: inc.name, lat: inc.lat, lon: inc.lon }) ?? undefined;
      viaDuplicate = target !== undefined;
    }
    if (!target) { byId.set(inc.id, structuredClone(inc)); added++; changed.add(inc.id); continue; }

    const next = combine(target, inc);
    const isNewlyChanged = JSON.stringify(next) !== JSON.stringify(target);
    byId.set(target.id, next);
    if (viaDuplicate) { merged++; }
    else if (isNewlyChanged && !changed.has(target.id)) { updated++; }
    if (isNewlyChanged) changed.add(target.id);
  }

  const places = [...byId.values()];
  const existingKept = mode === 'replace' ? 0 : existing.length;
  return {
    places,
    summary: {
      added, updated, merged,
      unchanged: mode === 'replace' ? 0 : Math.max(0, existingKept - [...changed].filter((id) => existing.some((e) => e.id === id)).length),
      removed: mode === 'replace' ? existing.length : 0,
    },
  };
}

/** Handy for validating a partial date typed in a form. */
export { isValidPartialDate };
