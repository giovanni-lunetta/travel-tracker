/** Pure helpers for creating and changing Places (no storage, no UI). */
import type { Kind, Place, Status } from '../types';
import { haversineKm } from './geo';
import { fold } from './search';

/**
 * Countries, states and cities have deterministic ids ("country:FRA"), so
 * tracking the same place twice, or importing it from a file, can never make
 * a duplicate. Free pins get a random id.
 */
export function makeId(kind: Kind, refId?: string | null): string {
  if (kind === 'pin' || refId == null) return `pin:${crypto.randomUUID()}`;
  return `${kind}:${refId}`;
}

export interface NewPlaceInput {
  kind: Kind;
  refId: string | null;
  name: string;
  countryId: string | null;
  admin1?: string | null;
  lat?: number | null;
  lon?: number | null;
  status?: Status;
}

export function newPlace(input: NewPlaceInput, now = new Date().toISOString()): Place {
  return {
    id: makeId(input.kind, input.refId),
    kind: input.kind,
    refId: input.refId,
    name: input.name.trim(),
    countryId: input.countryId,
    admin1: input.admin1 ?? null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    status: input.status ?? 'visited',
    visits: [], notes: '', rating: null, tags: [],
    createdAt: now, updatedAt: now,
  };
}

/**
 * What a tap on the map does:
 *   not tracked -> visited,   want-to-go -> visited,   visited -> removed (null).
 * The caller decides whether to confirm first (see hasDetails).
 */
export function toggleVisited(
  existing: Place | undefined,
  create: Omit<NewPlaceInput, 'status'>,
  now = new Date().toISOString(),
): Place | null {
  if (!existing) return newPlace({ ...create, status: 'visited' }, now);
  if (existing.status === 'visited') return null;
  return { ...existing, status: 'visited', updatedAt: now };
}

/** True if removing this place would throw away something the user typed. */
export function hasDetails(p: Place): boolean {
  return p.notes.trim() !== '' || p.visits.length > 0 || p.rating !== null || p.tags.length > 0;
}

const SAME_SPOT_KM = 0.15;
const NEAR_KM = 1;

function similarName(a: string, b: string): boolean {
  const x = fold(a), y = fold(b);
  return x !== '' && y !== '' && (x === y || x.includes(y) || y.includes(x));
}

/**
 * Is there already a city/pin here? Within 150 m it counts whatever the name;
 * within 1 km it counts if the names are alike. Returns the closest match.
 */
export function findNearbyDuplicate(
  places: Iterable<Place>,
  probe: { name: string; lat: number; lon: number },
): Place | null {
  let best: Place | null = null;
  let bestD = Infinity;
  for (const p of places) {
    if ((p.kind !== 'pin' && p.kind !== 'city') || p.lat === null || p.lon === null) continue;
    const d = haversineKm(p.lon, p.lat, probe.lon, probe.lat);
    const hit = d <= SAME_SPOT_KM || (d <= NEAR_KM && similarName(p.name, probe.name));
    if (hit && d < bestD) { best = p; bestD = d; }
  }
  return best;
}
