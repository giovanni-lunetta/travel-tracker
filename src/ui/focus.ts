/** Jump to a tracked place on the map and open its sheet. */
import { lookups } from '../data/load';
import { store } from '../store';
import type { Place } from '../types';

export function focusPlace(p: Place): void {
  const data = store.data.value;
  store.tab.value = 'map';
  store.sheet.value = { type: 'place', id: p.id };
  if (!data) return;
  const { country, state } = lookups(data.catalog);
  if (p.lat !== null && p.lon !== null) store.fly(p.lon, p.lat, 9);
  else if (p.kind === 'country') {
    const c = country.get(p.refId ?? '');
    if (c) { store.level.value = 'countries'; store.fly(c.lon, c.lat, c.tiny ? 6 : 3.2); }
  } else if (p.kind === 'state') {
    const s = state.get(p.refId ?? '');
    if (s) { store.level.value = 'states'; store.fly(s.lon, s.lat, 5); }
  }
}
