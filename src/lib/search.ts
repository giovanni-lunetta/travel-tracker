/**
 * Offline search over countries, US states and ~70,000 cities.
 *
 * Everything is normalised ("folded") so accents, case, apostrophes and
 * punctuation don't matter: "Côte d'Ivoire", "cote divoire" and "COTE D IVOIRE"
 * are all the same to the search box.
 */
import type { Catalog, CityRow, CountryKind } from '../types';
import { haversineKm } from './geo';

const SPECIAL: Record<string, string> = { ø: 'o', ł: 'l', đ: 'd', ß: 'ss', æ: 'ae', œ: 'oe', ı: 'i', þ: 'th', ð: 'd' };

/** Lower-case, strip accents, drop apostrophes/periods, turn other punctuation into spaces. */
export function fold(s: string): string {
  let t = s.toLowerCase();
  if (!/^[a-z0-9 ]*$/.test(t)) { // fast path: plain ASCII needs no work
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[øłđßæœıþð]/g, (c) => SPECIAL[c])
      .replace(/['’`.]/g, '')
      .replace(/[^a-z0-9Ѐ-ӿͰ-Ͽ一-鿿 ]+/g, ' ');
  }
  return t.replace(/\s+/g, ' ').trim();
}

export interface SearchHit {
  type: 'country' | 'state' | 'city';
  /** Country/state id, or the GeoNames id as a string for cities. */
  id: string;
  name: string;
  /** Short context line, e.g. "Texas, United States". */
  sub: string;
  lat: number;
  lon: number;
  countryId: string | null;
  admin1: string | null;
  score: number;
}

interface Entry {
  type: SearchHit['type'];
  id: string;
  name: string;
  sub: string;
  lat: number;
  lon: number;
  countryId: string | null;
  admin1: string | null;
  /** All folded spellings joined by "|"; the first is the primary name. */
  hay: string;
  bonus: number;
}
export interface SearchIndex { entries: Entry[] }

const KIND_LABEL: Record<CountryKind, string> = {
  un: 'Country', observer: 'Country (UN observer)', partial: 'Disputed / partly recognised', territory: 'Territory',
};

export function buildIndex(catalog: Catalog, cities: CityRow[], admin1: Record<string, string>): SearchIndex {
  const entries: Entry[] = [];
  const byIso2 = new Map<string, { id: string; name: string }>();

  for (const c of catalog.countries) {
    if (c.iso2) byIso2.set(c.iso2, { id: c.id, name: c.name });
    const names = [...new Set([c.name, ...c.aliases].map(fold).filter(Boolean))];
    entries.push({
      type: 'country', id: c.id, name: c.name, sub: KIND_LABEL[c.kind], lat: c.lat, lon: c.lon,
      countryId: c.id, admin1: null, hay: names.join('|'), bonus: 30,
    });
  }
  const stateIds = new Set(catalog.states.map((s) => s.id));
  for (const s of catalog.states) {
    const names = [...new Set([s.name, s.postal, ...s.aliases].map(fold).filter(Boolean))];
    entries.push({
      type: 'state', id: s.id, name: s.name, sub: 'US state', lat: s.lat, lon: s.lon,
      countryId: s.country, admin1: s.id, hay: names.join('|'), bonus: 25,
    });
  }
  for (const [id, name, lat, lon, cc, a1, pop, alts] of cities) {
    const country = byIso2.get(cc);
    const region = a1 ? admin1[cc + '.' + a1] : undefined;
    const sub = [region && region !== name ? region : '', country?.name ?? cc].filter(Boolean).join(', ');
    const stateId = cc === 'US' ? 'US-' + a1 : null;
    const names = [fold(name)];
    if (alts) for (const a of alts.split('|')) names.push(fold(a));
    entries.push({
      type: 'city', id: String(id), name, sub, lat, lon, countryId: country?.id ?? null,
      admin1: stateId && stateIds.has(stateId) ? stateId : null,
      hay: names.join('|'), bonus: Math.log10(pop + 1) * 3,
    });
  }
  return { entries };
}

/** How well does one folded spelling match the folded query? 0 = no match. */
function nameScore(name: string, q: string, tokens: string[]): number {
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(' ' + q)) return 60;
  const words = name.split(' ');
  if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return 50;
  return name.includes(q) ? 25 : 0;
}

export function search(index: SearchIndex, query: string, limit = 20): SearchHit[] {
  const q = fold(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const hits: SearchHit[] = [];
  for (const e of index.entries) {
    if (!tokens.every((t) => e.hay.includes(t))) continue; // cheap pre-filter
    const names = e.hay.split('|');
    let best = 0;
    for (let i = 0; i < names.length; i++) {
      let s = nameScore(names[i], q, tokens);
      if (s && i === 0) s += 10; // the official name beats an alias
      if (s > best) best = s;
    }
    if (!best) continue;
    hits.push({
      type: e.type, id: e.id, name: e.name, sub: e.sub, lat: e.lat, lon: e.lon,
      countryId: e.countryId, admin1: e.admin1, score: best + e.bonus,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export interface NearestCity {
  id: string;
  name: string;
  sub: string;
  countryId: string | null;
  admin1: string | null;
  lat: number;
  lon: number;
  distKm: number;
}

/**
 * A good name for a dropped pin: find the closest listed city within maxKm,
 * then prefer the biggest place within 3 km of it. (GeoNames lists districts
 * such as "Paris 04 Hôtel-de-Ville" as separate cities; a pin in central Paris
 * should be named "Paris".)
 */
export function nearestCity(index: SearchIndex, lat: number, lon: number, maxKm: number): NearestCity | null {
  const latBand = maxKm / 110; // cheap pre-filter: skip anything clearly too far north/south
  const near: { e: Entry; d: number }[] = [];
  let nearest = Infinity;
  for (const e of index.entries) {
    if (e.type !== 'city' || Math.abs(e.lat - lat) > latBand) continue;
    const d = haversineKm(e.lon, e.lat, lon, lat);
    if (d > maxKm) continue;
    near.push({ e, d });
    if (d < nearest) nearest = d;
  }
  let best: { e: Entry; d: number } | null = null;
  for (const c of near) {
    if (c.d <= nearest + 3 && (!best || c.e.bonus > best.e.bonus)) best = c;
  }
  if (!best) return null;
  const { e, d } = best;
  return { id: e.id, name: e.name, sub: e.sub, countryId: e.countryId, admin1: e.admin1, lat: e.lat, lon: e.lon, distKm: d };
}
