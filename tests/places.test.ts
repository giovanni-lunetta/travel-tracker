import { describe, expect, test } from 'vitest';
import { findNearbyDuplicate, hasDetails, makeId, newPlace, toggleVisited } from '../src/lib/places';
import { place } from './helpers';

const NOW = '2025-05-05T12:00:00.000Z';

describe('ids', () => {
  test('countries, states and cities get deterministic ids', () => {
    expect(makeId('country', 'FRA')).toBe('country:FRA');
    expect(makeId('state', 'US-NY')).toBe('state:US-NY');
    expect(makeId('city', '2988507')).toBe('city:2988507');
  });
  test('pins get unique ids', () => {
    const a = makeId('pin');
    expect(a.startsWith('pin:')).toBe(true);
    expect(makeId('pin')).not.toBe(a);
  });
});

describe('toggleVisited (tap on the map)', () => {
  const create = { kind: 'country' as const, refId: 'FRA', name: 'France', countryId: 'FRA' };
  test('an untracked place becomes visited', () => {
    const next = toggleVisited(undefined, create, NOW)!;
    expect(next).toMatchObject({ id: 'country:FRA', status: 'visited', createdAt: NOW, updatedAt: NOW });
  });
  test('a want-to-go place becomes visited and keeps its notes', () => {
    const next = toggleVisited(place({ status: 'wishlist', notes: 'see the Louvre' }), create, NOW)!;
    expect(next.status).toBe('visited');
    expect(next.notes).toBe('see the Louvre');
    expect(next.updatedAt).toBe(NOW);
  });
  test('a visited place is removed (null)', () => {
    expect(toggleVisited(place(), create, NOW)).toBeNull();
  });
});

describe('hasDetails', () => {
  test('a bare place has none', () => expect(hasDetails(place())).toBe(false));
  test.each([
    ['notes', { notes: 'x' }], ['a visit date', { visits: [{ start: '2020' }] }],
    ['a rating', { rating: 4 }], ['tags', { tags: ['beach'] }],
  ])('%s counts as details', (_n, over) => expect(hasDetails(place(over))).toBe(true));
  test('whitespace-only notes do not', () => expect(hasDetails(place({ notes: '  \n' }))).toBe(false));
});

describe('newPlace', () => {
  test('trims the name and defaults to visited with empty details', () => {
    const p = newPlace({ kind: 'pin', refId: null, name: '  Eiffel Tower ', lat: 48.8584, lon: 2.2945, countryId: 'FRA' }, NOW);
    expect(p).toMatchObject({ name: 'Eiffel Tower', status: 'visited', visits: [], notes: '', rating: null, tags: [], admin1: null });
    expect(p.id.startsWith('pin:')).toBe(true);
  });
});

describe('findNearbyDuplicate (pins)', () => {
  const eiffel = place({ id: 'pin:a', kind: 'pin', refId: null, name: 'Eiffel Tower', lat: 48.8584, lon: 2.2945 });
  test('same spot within 150 m is a duplicate whatever the name', () => {
    expect(findNearbyDuplicate([eiffel], { name: 'Tour', lat: 48.8586, lon: 2.2947 })?.id).toBe('pin:a');
  });
  test('~700 m away with a similar name is a duplicate', () => {
    expect(findNearbyDuplicate([eiffel], { name: 'eiffel tower!', lat: 48.8640, lon: 2.2945 })?.id).toBe('pin:a');
  });
  test('~700 m away with a different name is not', () => {
    expect(findNearbyDuplicate([eiffel], { name: 'Cafe de Flore', lat: 48.8640, lon: 2.2945 })).toBeNull();
  });
  test('far away with the same name is not (two places called "Springfield")', () => {
    expect(findNearbyDuplicate([eiffel], { name: 'Eiffel Tower', lat: 36.3, lon: -115.2 })).toBeNull();
  });
  test('countries and states without coordinates are ignored', () => {
    expect(findNearbyDuplicate([place()], { name: 'France', lat: 48, lon: 2 })).toBeNull();
  });
});
