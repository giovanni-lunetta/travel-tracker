/**
 * Small offline geography helpers: distances and "which country/state is this
 * point in?" using the bundled Natural Earth shapes. No network involved.
 */
type Pos = [number, number];
type Ring = Pos[];
type Poly = Ring[]; // first ring is the outline, the rest are holes

const R = 6371.0088; // mean Earth radius, km
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

interface Shape { id: string; polys: Poly[]; bbox: [number, number, number, number] }

/** Converts a GeoJSON collection into plain polygons with bounding boxes (cached). */
const cache = new WeakMap<GeoJSON.FeatureCollection, Shape[]>();
function shapes(fc: GeoJSON.FeatureCollection): Shape[] {
  const hit = cache.get(fc);
  if (hit) return hit;
  const out: Shape[] = [];
  for (const f of fc.features) {
    const props = f.properties ?? {};
    if (props.sel === 0) continue; // drawn on the map but not a selectable place
    const g = f.geometry;
    const polys: Poly[] = g.type === 'Polygon' ? [g.coordinates as Poly]
      : g.type === 'MultiPolygon' ? (g.coordinates as Poly[]) : [];
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    for (const p of polys) for (const [x, y] of p[0]) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    out.push({ id: String(props.id), polys, bbox: [minX, minY, maxX, maxY] });
  }
  cache.set(fc, out);
  return out;
}

/** Even-odd ray casting for one ring. */
function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (x: number, y: number, p: Poly) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h));

/** Distance in km from a point to a line segment, on a locally flat map. */
function distToSegmentKm(px: number, py: number, a: Pos, b: Pos): number {
  const kx = 111.32 * Math.cos(rad(py));
  const ky = 110.57;
  const ax = (a[0] - px) * kx, ay = (a[1] - py) * ky;
  const bx = (b[0] - px) * kx, by = (b[1] - py) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Which shape contains this point? If several do (an enclave such as the
 * Vatican sits inside Italy's outline) the smallest one wins.
 */
function findContaining(fc: GeoJSON.FeatureCollection, x: number, y: number): string | null {
  let best: string | null = null;
  let bestArea = Infinity;
  for (const s of shapes(fc)) {
    const [minX, minY, maxX, maxY] = s.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    const area = (maxX - minX) * (maxY - minY);
    if (area < bestArea && s.polys.some((p) => inPoly(x, y, p))) { best = s.id; bestArea = area; }
  }
  return best;
}

/**
 * The shapes are simplified, so a coastal point can land a little offshore.
 * Snap to the nearest shape if one is within maxKm.
 */
function findNearest(fc: GeoJSON.FeatureCollection, x: number, y: number, maxKm: number): string | null {
  const margin = maxKm / 80; // degrees; generous at high latitudes
  let best: string | null = null;
  let bestD = maxKm;
  for (const s of shapes(fc)) {
    const [minX, minY, maxX, maxY] = s.bbox;
    if (x < minX - margin || x > maxX + margin || y < minY - margin || y > maxY + margin) continue;
    for (const p of s.polys) for (const ring of p) {
      for (let i = 1; i < ring.length; i++) {
        const d = distToSegmentKm(x, y, ring[i - 1], ring[i]);
        if (d < bestD) { bestD = d; best = s.id; }
      }
    }
  }
  return best;
}

export interface Located { countryId: string | null; stateId: string | null }

/** Which country (and US state) is this point in? Works offline. */
export function locate(
  lon: number, lat: number,
  countries: GeoJSON.FeatureCollection, states: GeoJSON.FeatureCollection,
): Located {
  const countryId = findContaining(countries, lon, lat) ?? findNearest(countries, lon, lat, 60);
  let stateId: string | null = null;
  if (countryId === 'USA') stateId = findContaining(states, lon, lat) ?? findNearest(states, lon, lat, 60);
  return { countryId, stateId };
}
