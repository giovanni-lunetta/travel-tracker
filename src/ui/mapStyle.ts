/**
 * Everything about how the map LOOKS: colours, layers, and the optional
 * street-map style. No tiles are needed for the countries/states view, so it
 * works fully offline. Street tiles and place-name fonts come from the free
 * OpenFreeMap service, only when you've left those options on.
 */
import type { ExpressionSpecification, LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl';
import type { AppData, Level } from '../store';

export const OFM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT = ['Noto Sans Regular'];

export interface Palette {
  ocean: string; land: string; line: string; visited: string; wish: string;
  pin: string; pinStroke: string; label: string; halo: string;
}
export const LIGHT: Palette = {
  ocean: '#cfe0e8', land: '#f1f2f0', line: '#a9b6c0', visited: '#1f3fae', wish: '#f2b33d',
  pin: '#de4b2e', pinStroke: '#ffffff', label: '#2f3d49', halo: 'rgba(255,255,255,0.85)',
};
export const DARK: Palette = {
  ocean: '#0e1a24', land: '#1d2c39', line: '#3a4c5d', visited: '#7391ff', wish: '#f2b33d',
  pin: '#ff7a5c', pinStroke: '#0e1a24', label: '#c9d6e0', halo: 'rgba(14,26,36,0.85)',
};

export interface OverlayInput {
  data: AppData;
  ids: { countries: { visited: string[]; wishlist: string[] }; states: { visited: string[]; wishlist: string[] } };
  pins: GeoJSON.FeatureCollection;
  level: Level;
  streets: boolean;
  labels: boolean;
  p: Palette;
}

const inIds = (ids: string[]): ExpressionSpecification => ['in', ['get', 'id'], ['literal', ids]];
const vis = (on: boolean) => ({ visibility: on ? 'visible' : 'none' }) as const;

/** Points used for country markers (microstates) and name labels. */
function countryPoints(data: AppData): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.catalog.countries.map((c) => ({
      type: 'Feature', properties: { id: c.id, name: c.name, tiny: c.tiny ? 1 : 0, rank: c.rank },
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
    })),
  };
}
function statePoints(data: AppData): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.catalog.states.map((s) => ({
      type: 'Feature', properties: { id: s.id, name: s.postal },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    })),
  };
}

/** Our sources and layers, ready to sit on top of any base style. */
export function overlay(o: OverlayInput): { sources: Record<string, SourceSpecification>; layers: LayerSpecification[] } {
  const { p, ids, level, streets, labels } = o;
  const inStates = level === 'states';
  // With streets on, shapes become see-through as you zoom in so roads show.
  const fade = (full: number): ExpressionSpecification | number =>
    streets ? ['interpolate', ['linear'], ['zoom'], 0, full, 5, full, 8, full * 0.3] : full;

  const sources: Record<string, SourceSpecification> = {
    countries: { type: 'geojson', data: o.data.countries },
    states: { type: 'geojson', data: o.data.states },
    cpoints: { type: 'geojson', data: countryPoints(o.data) },
    spoints: { type: 'geojson', data: statePoints(o.data) },
    pins: { type: 'geojson', data: o.pins },
  };

  const layers: LayerSpecification[] = [
    { id: 'country-fill', type: 'fill', source: 'countries', paint: { 'fill-color': p.land, 'fill-opacity': fade(1) } },
    { id: 'country-visited', type: 'fill', source: 'countries', filter: inIds(ids.countries.visited), layout: vis(!inStates),
      paint: { 'fill-color': p.visited, 'fill-opacity': fade(0.88) } },
    { id: 'country-wish', type: 'fill', source: 'countries', filter: inIds(ids.countries.wishlist), layout: vis(!inStates),
      paint: { 'fill-color': p.wish, 'fill-opacity': fade(0.85) } },
    { id: 'country-line', type: 'line', source: 'countries',
      paint: { 'line-color': p.line, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 6, 1.2] } },

    // US states sit on top of the country layers when "US states" is selected.
    { id: 'state-fill', type: 'fill', source: 'states', layout: vis(inStates), paint: { 'fill-color': p.land, 'fill-opacity': fade(1) } },
    { id: 'state-visited', type: 'fill', source: 'states', filter: inIds(ids.states.visited), layout: vis(inStates),
      paint: { 'fill-color': p.visited, 'fill-opacity': fade(0.88) } },
    { id: 'state-wish', type: 'fill', source: 'states', filter: inIds(ids.states.wishlist), layout: vis(inStates),
      paint: { 'fill-color': p.wish, 'fill-opacity': fade(0.85) } },
    { id: 'state-line', type: 'line', source: 'states', layout: vis(inStates),
      paint: { 'line-color': p.line, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.5, 7, 1.4] } },

    // Marker dots so microstates (Vatican, Monaco, Tuvalu...) can always be found and tapped.
    { id: 'tiny-ring', type: 'circle', source: 'cpoints', maxzoom: 6.5, filter: ['==', ['get', 'tiny'], 1], layout: vis(!inStates),
      paint: { 'circle-radius': 5.5, 'circle-color': p.land, 'circle-stroke-color': p.visited, 'circle-stroke-width': 1.5 } },
    { id: 'tiny-visited', type: 'circle', source: 'cpoints', maxzoom: 6.5,
      filter: ['all', ['==', ['get', 'tiny'], 1], inIds(ids.countries.visited)], layout: vis(!inStates),
      paint: { 'circle-radius': 5.5, 'circle-color': p.visited, 'circle-stroke-color': p.visited, 'circle-stroke-width': 1.5 } },
    { id: 'tiny-wish', type: 'circle', source: 'cpoints', maxzoom: 6.5,
      filter: ['all', ['==', ['get', 'tiny'], 1], inIds(ids.countries.wishlist)], layout: vis(!inStates),
      paint: { 'circle-radius': 5.5, 'circle-color': p.wish, 'circle-stroke-color': p.visited, 'circle-stroke-width': 1.5 } },
  ];

  if (labels) {
    layers.push(
      { id: 'country-labels', type: 'symbol', source: 'cpoints', minzoom: 1.2, layout: {
          ...vis(!inStates), 'text-field': ['get', 'name'], 'text-font': FONT, 'symbol-sort-key': ['get', 'rank'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 4, 12, 8, 15], 'text-max-width': 6, 'text-padding': 2 },
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.3 } },
      { id: 'state-labels', type: 'symbol', source: 'spoints', minzoom: 3, layout: {
          ...vis(inStates), 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 7, 14] },
        paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.3 } },
    );
  }

  layers.push(
    { id: 'pins-halo', type: 'circle', source: 'pins',
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 5.5, 12, 11], 'circle-color': p.pinStroke } },
    { id: 'pins', type: 'circle', source: 'pins', paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3.8, 12, 8.5],
      'circle-color': ['match', ['get', 'status'], 'wishlist', p.wish, p.pin] } },
  );
  return { sources, layers };
}

/** The fully offline style: ocean + our layers. */
export function offlineStyle(o: OverlayInput): StyleSpecification {
  const ov = overlay(o);
  return {
    version: 8,
    ...(o.labels ? { glyphs: OFM_GLYPHS } : {}),
    sources: ov.sources,
    layers: [{ id: 'ocean', type: 'background', paint: { 'background-color': o.p.ocean } }, ...ov.layers],
  };
}

/** Merges our layers on top of the OpenFreeMap street style. */
export function withStreets(next: StyleSpecification, o: OverlayInput): StyleSpecification {
  const ov = overlay(o);
  return { ...next, sources: { ...next.sources, ...ov.sources }, layers: [...next.layers, ...ov.layers] };
}
