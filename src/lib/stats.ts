/** Numbers for the Stats screen. */
import type { Catalog, CountMode, CountryKind, Place } from '../types';

export interface Stats {
  countriesVisited: number;
  /** Size of the chosen "world" (193, 195 or every place on the map). */
  worldTotal: number;
  /** 0-100, one decimal. */
  percent: number;
  /** Visited places that exist on the map but are outside the chosen world (e.g. territories). */
  extraVisited: number;
  statesVisited: number;
  statesTotal: number;
  cities: number;
  pins: number;
  wishlist: number;
  continents: Record<string, { visited: number; total: number }>;
  firstVisit: string | null;
  latestVisit: string | null;
}

const COUNTED: Record<CountMode, CountryKind[]> = {
  un193: ['un'],
  un195: ['un', 'observer'],
  all: ['un', 'observer', 'partial', 'territory'],
};

export function computeStats(places: Place[], catalog: Catalog, mode: CountMode): Stats {
  const counted = new Set(COUNTED[mode]);
  const inWorld = new Map(catalog.countries.filter((c) => counted.has(c.kind)).map((c) => [c.id, c]));
  const known = new Set(catalog.countries.map((c) => c.id));

  const continents: Stats['continents'] = {};
  for (const c of inWorld.values()) (continents[c.cont] ??= { visited: 0, total: 0 }).total++;

  let countriesVisited = 0, extraVisited = 0, statesVisited = 0, cities = 0, pins = 0, wishlist = 0;
  let first: string | null = null, latest: string | null = null;

  for (const p of places) {
    if (p.status === 'wishlist') { wishlist++; continue; }
    if (p.kind === 'country' && p.refId) {
      const c = inWorld.get(p.refId);
      if (c) { countriesVisited++; continents[c.cont].visited++; }
      else if (known.has(p.refId)) extraVisited++;
    } else if (p.kind === 'state') statesVisited++;
    else if (p.kind === 'city') cities++;
    else if (p.kind === 'pin') pins++;
    for (const v of p.visits) {
      if (first === null || v.start < first) first = v.start;
      if (latest === null || v.start > latest) latest = v.start;
    }
  }
  const worldTotal = inWorld.size;
  return {
    countriesVisited, worldTotal,
    percent: worldTotal ? Math.round((countriesVisited / worldTotal) * 1000) / 10 : 0,
    extraVisited, statesVisited, statesTotal: catalog.states.length,
    cities, pins, wishlist, continents, firstVisit: first, latestVisit: latest,
  };
}
