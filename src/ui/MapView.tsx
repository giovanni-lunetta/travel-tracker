/**
 * The map. Taps toggle countries/states; long-press (or "Places" mode) drops
 * a pin. All colouring is driven by the store, so the map never keeps its own
 * copy of your data.
 */
import { effect } from '@preact/signals';
import { AttributionControl, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type PointLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef } from 'preact/hooks';
import { countryTarget, lookups, stateTarget } from '../data/load';
import { locate } from '../lib/geo';
import { store, type Level } from '../store';
import { Icon } from './icons';
import { DARK, LIGHT, OFM_STYLE, offlineStyle, withStreets, type OverlayInput } from './mapStyle';

// With a bundler MapLibre can't find its own worker file, so say where it is.
setWorkerUrl(workerUrl);

const WORLD: [[number, number], [number, number]] = [[-170, -58], [180, 78]];
const US_LOWER_48: [[number, number], [number, number]] = [[-126, 23.5], [-65, 50]];
const LONG_PRESS_MS = 550;

/** Tracked places as points, used by "Fit all". */
function trackedPoints(): [number, number][] {
  const data = store.data.value;
  if (!data) return [];
  const { country, state } = lookups(data.catalog);
  const pts: [number, number][] = [];
  for (const p of store.places.value.values()) {
    if (p.lat !== null && p.lon !== null) pts.push([p.lon, p.lat]);
    else if (p.kind === 'country' && p.refId && country.has(p.refId)) pts.push([country.get(p.refId)!.lon, country.get(p.refId)!.lat]);
    else if (p.kind === 'state' && p.refId && state.has(p.refId)) pts.push([state.get(p.refId)!.lon, state.get(p.refId)!.lat]);
  }
  return pts;
}

/** Moves the camera (used by the Fit button and the US-state chips). */
export function fitMap(map: MapLibreMap | null, bounds: [[number, number], [number, number]], maxZoom = 6) {
  map?.fitBounds(bounds, { padding: { top: 150, bottom: 30, left: 24, right: 24 }, maxZoom, duration: 700 });
}

let currentMap: MapLibreMap | null = null;
export const getMap = () => currentMap;

export function fitAll(): void {
  const pts = trackedPoints();
  if (!currentMap) return;
  if (pts.length === 0) { fitMap(currentMap, WORLD, 3); return; }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const pad = pts.length === 1 ? 4 : 1;
  fitMap(currentMap, [[Math.min(...xs) - pad, Math.min(...ys) - pad], [Math.max(...xs) + pad, Math.max(...ys) + pad]], 5);
}

export function MapView() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const data = store.data.value!;
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const input = (streets: boolean): OverlayInput => ({
      data, ids: store.mapIds.value, pins: store.pinsGeo.value, level: store.level.value,
      streets, labels: store.settings.value.labels, p: dark.matches ? DARK : LIGHT,
    });

    const map = new MapLibreMap({
      container: box.current!,
      style: offlineStyle(input(false)),
      bounds: WORLD,
      fitBoundsOptions: { padding: { top: 120, bottom: 20, left: 8, right: 8 } },
      minZoom: 0.6, maxZoom: 18,
      attributionControl: false,
      dragRotate: false, pitchWithRotate: false, renderWorldCopies: false,
    });
    currentMap = map;
    if (import.meta.env.DEV) (window as unknown as { __map: MapLibreMap }).__map = map; // for debugging in dev only
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true, customAttribution: 'Natural Earth · GeoNames' }), 'bottom-left');

    /* ---------------- style (offline by default, streets optional) ---------------- */
    let styleKey = '';
    let request = 0;
    const wantsStreets = () => store.settings.value.streets && navigator.onLine;
    async function applyStyle() {
      const streets = wantsStreets();
      const key = [streets, store.settings.value.labels, dark.matches].join();
      if (key === styleKey) return;
      styleKey = key;
      const mine = ++request;
      if (streets) {
        try {
          const res = await fetch(OFM_STYLE);
          if (!res.ok) throw new Error(String(res.status));
          const base = await res.json();
          if (mine === request) map.setStyle(withStreets(base, input(true)));
          return;
        } catch {
          if (mine !== request) return;
          store.showToast('Street map needs an internet connection. Showing the offline map.');
        }
      }
      map.setStyle(offlineStyle(input(false)));
    }
    map.on('error', (e) => {
      // Missing fonts or tiles while offline are expected; the offline map keeps working.
      console.debug('map:', e.error?.message ?? e);
    });

    /* ---------------- keeping colours in step with the store ---------------- */
    const ready = (fn: () => void) => (map.isStyleLoaded() ? fn() : map.once('idle', fn));
    const setFilter = (layer: string, f: unknown) => { if (map.getLayer(layer)) map.setFilter(layer, f as never); };
    const idsFilter = (ids: string[]) => ['in', ['get', 'id'], ['literal', ids]];
    const stops: (() => void)[] = [];

    stops.push(effect(() => {
      const { countries, states } = store.mapIds.value;
      ready(() => {
        setFilter('country-visited', idsFilter(countries.visited));
        setFilter('country-wish', idsFilter(countries.wishlist));
        setFilter('tiny-visited', ['all', ['==', ['get', 'tiny'], 1], idsFilter(countries.visited)]);
        setFilter('tiny-wish', ['all', ['==', ['get', 'tiny'], 1], idsFilter(countries.wishlist)]);
        setFilter('state-visited', idsFilter(states.visited));
        setFilter('state-wish', idsFilter(states.wishlist));
      });
    }));
    stops.push(effect(() => {
      const pins = store.pinsGeo.value;
      ready(() => (map.getSource('pins') as GeoJSONSource | undefined)?.setData(pins));
    }));

    const LEVEL_LAYERS: Record<'countries' | 'states', string[]> = {
      countries: ['country-visited', 'country-wish', 'tiny-ring', 'tiny-visited', 'tiny-wish', 'country-labels'],
      states: ['state-fill', 'state-visited', 'state-wish', 'state-line', 'state-labels'],
    };
    let lastLevel: Level | null = null;
    stops.push(effect(() => {
      const level = store.level.value;
      ready(() => {
        const showStates = level === 'states';
        for (const id of LEVEL_LAYERS.countries) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showStates ? 'none' : 'visible');
        for (const id of LEVEL_LAYERS.states) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showStates ? 'visible' : 'none');
      });
      if (level === 'states' && lastLevel !== 'states') fitMap(map, US_LOWER_48, 5);
      lastLevel = level;
    }));
    stops.push(effect(() => {
      void store.settings.value.streets; void store.settings.value.labels;
      if (map.isStyleLoaded() || styleKey) void applyStyle();
    }));
    const onScheme = () => void applyStyle();
    dark.addEventListener('change', onScheme);
    window.addEventListener('online', onScheme);

    stops.push(effect(() => {
      const f = store.flyTo.value;
      if (f) map.flyTo({ center: [f.lon, f.lat], zoom: f.zoom ?? Math.max(map.getZoom(), 3), duration: 900 });
    }));

    /* ---------------- the temporary marker while a pin is being placed ---------------- */
    let marker: Marker | null = null;
    stops.push(effect(() => {
      const s = store.sheet.value;
      marker?.remove();
      marker = null;
      if (s?.type === 'newpin') marker = new Marker({ color: (dark.matches ? DARK : LIGHT).pin }).setLngLat([s.lon, s.lat]).addTo(map);
    }));

    /* ---------------- taps ---------------- */
    const query = (box: [PointLike, PointLike] | PointLike, layers: string[]) =>
      map.queryRenderedFeatures(box as never, { layers: layers.filter((l) => map.getLayer(l)) });
    const around = (p: { x: number; y: number }, r: number): [PointLike, PointLike] => [[p.x - r, p.y - r], [p.x + r, p.y + r]];
    let lastDrop = -1e9;

    function dropPin(lngLat: { lng: number; lat: number }) {
      lastDrop = performance.now();
      const where = locate(lngLat.lng, lngLat.lat, data.countries, data.states);
      store.sheet.value = { type: 'newpin', lat: lngLat.lat, lon: lngLat.lng, name: '', countryId: where.countryId, admin1: where.stateId };
    }

    map.on('click', (e) => {
      if (performance.now() - lastDrop < 700) return; // the lift-off after a long-press is not a tap
      const level = store.level.value;
      const pin = query(around(e.point, 11), ['pins'])[0];
      if (pin) { store.sheet.value = { type: 'place', id: String(pin.properties.id) }; return; }
      if (level === 'places') { dropPin(e.lngLat); return; }

      const { country, state } = lookups(data.catalog);
      if (level === 'states') {
        const f = query(e.point, ['state-fill'])[0];
        const s = f && state.get(String(f.properties.id));
        if (s) void store.tap(stateTarget(s));
        else store.showToast('US states only for now. Switch to Countries for everywhere else.',
          [{ label: 'Countries', run: () => { store.level.value = 'countries'; } }]);
        return;
      }
      const f = query(around(e.point, 9), ['tiny-ring'])[0] ?? query(e.point, ['country-fill'])[0];
      const c = f && country.get(String(f.properties.id));
      if (c) void store.tap(countryTarget(c));
    });

    // Long-press on touch screens, right-click on desktop.
    let pressTimer: number | undefined;
    let pressAt: { x: number; y: number } | null = null;
    const cancelPress = () => { window.clearTimeout(pressTimer); pressAt = null; };
    map.on('touchstart', (e) => {
      if (e.points.length !== 1) { cancelPress(); return; }
      pressAt = { x: e.point.x, y: e.point.y };
      pressTimer = window.setTimeout(() => { navigator.vibrate?.(12); dropPin(e.lngLat); pressAt = null; }, LONG_PRESS_MS);
    });
    map.on('touchmove', (e) => { if (pressAt && Math.hypot(e.point.x - pressAt.x, e.point.y - pressAt.y) > 8) cancelPress(); });
    for (const ev of ['touchend', 'touchcancel', 'dragstart', 'zoomstart'] as const) map.on(ev, cancelPress);
    map.on('contextmenu', (e) => dropPin(e.lngLat));

    map.on('mousemove', (e) => {
      const layers = store.level.value === 'states' ? ['state-fill'] : ['pins', 'tiny-ring', 'country-fill'];
      map.getCanvas().style.cursor = query(e.point, layers).length ? 'pointer' : '';
    });

    return () => {
      stops.forEach((s) => s());
      dark.removeEventListener('change', onScheme);
      window.removeEventListener('online', onScheme);
      cancelPress();
      marker?.remove();
      map.remove();
      currentMap = null;
    };
  }, []);

  return (
    <div class="map-wrap">
      <div ref={box} class="map" role="application" aria-label="World map. Use search or the Lists tab for keyboard access." />
      <div class="map-controls">
        <button class="round zoom-btn" aria-label="Zoom in" onClick={() => currentMap?.zoomIn()}><Icon name="plus" /></button>
        <button class="round zoom-btn" aria-label="Zoom out" onClick={() => currentMap?.zoomOut()}><Icon name="minus" /></button>
        <button class="round" aria-label="Fit everything I've tracked" title="Fit all" onClick={fitAll}><Icon name="fit" /></button>
      </div>
    </div>
  );
}
