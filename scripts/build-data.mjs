/**
 * build-data.mjs — turns raw Natural Earth + GeoNames downloads into the small
 * files the app ships with (public/data/*).
 *
 * Usage:  node scripts/build-data.mjs <folder-with-raw-downloads>
 *
 * Expected raw files (see README "Rebuilding the data"):
 *   ne_10m_admin_0_countries.geojson        (Natural Earth, public domain)
 *   ne_10m_admin_1_states_provinces.geojson (Natural Earth, public domain)
 *   cities5000.txt, admin1CodesASCII.txt    (GeoNames, CC BY 4.0)
 *
 * Outputs (in public/data/):
 *   countries.geojson  – simplified country shapes, props: { id, sel }
 *   states-us.geojson  – simplified US state shapes, props: { id }
 *   catalog.json       – names, kinds, aliases, label points for countries + states
 *   cities.json        – compact city table for offline search
 *   admin1.json        – "US.NY" -> "New York" lookup used to label cities
 *
 * The script ASSERTS the country classification: exactly 193 UN members and
 * 2 UN observers. If Natural Earth changes in a way that breaks this, the
 * build fails loudly instead of silently shipping a wrong "% of world".
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !fs.existsSync(rawDir)) {
  console.error('Usage: node scripts/build-data.mjs <folder-with-raw-downloads>');
  process.exit(1);
}
const outDir = path.join(root, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-data-'));
const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'));
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';

// ---------------------------------------------------------------------------
// Classification rules (documented in the app's About screen).
// ---------------------------------------------------------------------------
/** Not UN members, but widely treated as countries (or claiming to be). */
const PARTIAL = new Set(['TWN', 'KOS', 'SAH', 'SOL', 'CYN']);
/** UN non-member observer states. */
const OBSERVER = new Set(['VAT', 'PSX']);
/** Natural Earth marks these "Country" or "Disputed" but they are territories. */
const TERRITORY_EXTRA = new Set([
  'HKG', 'MAC', 'GRL', 'ABW', 'CUW', 'SXM', 'JEY', 'GGY', 'IMN', 'ALD',
  'GIB', 'FLK', 'IOT', 'ATA',
]);
/** Tiny enclaves/leases that count as part of the surrounding country. */
const MERGE_INTO = { USG: 'CUB', KAB: 'KAZ', CNM: 'CYP', ESB: 'CYP', WSB: 'CYP' };
/** Uninhabited or unclaimed disputed bits: drawn on the map, not selectable. */
const NOT_SELECTABLE = new Set(['BRI', 'KAS', 'SPI', 'BRT', 'PGA', 'BJN', 'SER', 'SCR']);

/** Display-name overrides where Natural Earth's English name is awkward. */
const DISPLAY = {
  USA: 'United States', COD: 'DR Congo', COG: 'Republic of the Congo',
  SWZ: 'Eswatini', CZE: 'Czechia', TUR: 'Türkiye', MKD: 'North Macedonia',
  PSX: 'Palestine', SAH: 'Western Sahara', CPV: 'Cabo Verde', TLS: 'Timor-Leste',
  MMR: 'Myanmar', CIV: "Côte d'Ivoire", FSM: 'Micronesia', BIH: 'Bosnia and Herzegovina',
  VAT: 'Vatican City', GBR: 'United Kingdom', RUS: 'Russia', KOR: 'South Korea',
  PRK: 'North Korea', LAO: 'Laos', BRN: 'Brunei', STP: 'São Tomé and Príncipe',
  CHN: 'China', BHS: 'Bahamas', GMB: 'Gambia', CYN: 'Northern Cyprus',
};

/** Extra spellings people actually type. */
const ALIASES = {
  USA: ['USA', 'US', 'U.S.', 'America', 'United States of America'],
  GBR: ['UK', 'U.K.', 'Great Britain', 'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  CZE: ['Czech Republic'], TUR: ['Turkey', 'Turkiye'], MMR: ['Burma'],
  CIV: ['Ivory Coast', 'Cote dIvoire'], SWZ: ['Swaziland'], CPV: ['Cape Verde'],
  TLS: ['East Timor'], COD: ['DRC', 'Congo-Kinshasa', 'Zaire', 'Democratic Republic of the Congo'],
  COG: ['Congo-Brazzaville', 'Congo Republic', 'Congo'], MKD: ['Macedonia'],
  PRK: ['DPRK'], KOR: ['Republic of Korea'], RUS: ['Russian Federation'],
  VAT: ['Holy See'], PSX: ['State of Palestine', 'West Bank', 'Gaza'],
  TWN: ['Republic of China', 'Chinese Taipei', 'ROC'], ARE: ['UAE', 'Emirates'],
  VNM: ['Viet Nam'], IRN: ['Persia'], NLD: ['Holland', 'The Netherlands'],
  BHS: ['The Bahamas'], GMB: ['The Gambia'], FSM: ['Federated States of Micronesia'],
  STP: ['Sao Tome and Principe', 'Sao Tome'], KNA: ['St Kitts', 'Saint Kitts', 'St. Kitts and Nevis'],
  VCT: ['St Vincent'], LCA: ['St Lucia'], BRN: ['Brunei Darussalam'],
  HKG: ['Hong Kong SAR'], MAC: ['Macau'], PRI: ['PR'], GUM: ['Guam'],
  GRL: ['Kalaallit Nunaat'], SAH: ['Sahrawi Republic'], KOS: ['Republic of Kosovo'],
  SYR: ['Syrian Arab Republic'], LBY: ['Libyan Arab Jamahiriya'], BOL: ['Plurinational State of Bolivia'],
  VEN: ['Bolivarian Republic of Venezuela'], TZA: ['United Republic of Tanzania'],
  BLR: ['Belorussia', 'Byelorussia'], MDA: ['Moldova, Republic of'], LKA: ['Ceylon'],
  THA: ['Siam'], ZWE: ['Rhodesia'], GUF: ['French Guiana'], ATA: ['Antarctic', 'South Pole'],
};

/** Expand abbreviations Natural Earth uses ("St.", "Is.", "Dem. Rep."). */
function expandAbbr(s) {
  return s
    .replace(/\bIs\.?(?=$|\s)/g, 'Islands').replace(/\bI\.(?=$|\s)/g, 'Island')
    .replace(/\bSt\.?(?=\s|-)/g, 'Saint').replace(/\bRep\.?(?=$|\s)/g, 'Republic')
    .replace(/\bDem\.?(?=\s)/g, 'Democratic').replace(/\bFr\.(?=\s)/g, 'French')
    .replace(/\bBr\.(?=\s)/g, 'British').replace(/\bTer\.?(?=$|\s)/g, 'Territories')
    .replace(/\bS\.(?=\s)/g, 'South').replace(/\bN\.(?=\s)/g, 'North')
    .replace(/\bW\.(?=\s)/g, 'Western').replace(/\bGeo\.(?=\s)/g, 'Georgia')
    .replace(/\bU\.S\.(?=\s)/g, 'United States').replace(/\bCent\.(?=\s)/g, 'Central')
    .replace(/\bEq\.(?=\s)/g, 'Equatorial').replace(/\bBosnia and Herz\./g, 'Bosnia and Herzegovina');
}

/**
 * Natural Earth files a few island places under "Seven seas (open ocean)"
 * (Seychelles, Mauritius, Maldives...). Use the UN region instead, so they land
 * on a real continent.
 */
function continentOf(p) {
  if (p.CONTINENT !== 'Seven seas (open ocean)') return p.CONTINENT;
  if (p.REGION_UN === 'Americas') return p.SUBREGION === 'South America' || p.ADM0_A3 === 'SGS' ? 'South America' : 'North America';
  return ['Africa', 'Asia', 'Europe', 'Oceania'].includes(p.REGION_UN) ? p.REGION_UN : 'Oceania';
}

// ---------------------------------------------------------------------------
// 1. Countries
// ---------------------------------------------------------------------------
const ne0 = readJSON('ne_10m_admin_0_countries.geojson');
const catalogCountries = [];
const countryFeatures = [];
const iso2Seen = new Map();

for (const f of ne0.features) {
  const p = f.properties;
  const a3 = p.ADM0_A3;
  const mergedInto = MERGE_INTO[a3];
  const selectable = !NOT_SELECTABLE.has(a3);

  // Geometry record: ids of merged enclaves point at their parent so tapping
  // them toggles the parent country.
  countryFeatures.push({
    type: 'Feature',
    properties: { id: mergedInto ?? (selectable ? a3 : 'x:' + a3), sel: selectable ? 1 : 0 },
    geometry: f.geometry,
  });
  if (mergedInto || !selectable) continue;

  let kind = 'un';
  if (PARTIAL.has(a3)) kind = 'partial';
  else if (OBSERVER.has(a3)) kind = 'observer';
  else if (TERRITORY_EXTRA.has(a3) || p.TYPE === 'Dependency' || p.TYPE === 'Lease') kind = 'territory';

  const name = DISPLAY[a3] ?? p.NAME_EN ?? p.NAME;
  const raw = [
    p.NAME, p.NAME_LONG, p.FORMAL_EN, p.NAME_ALT, p.NAME_SORT, p.BRK_NAME,
    p.NAME_EN, p.NAME_DE, p.NAME_ES, p.NAME_FR, p.NAME_IT, p.NAME_PT, p.NAME_NL,
    ...(ALIASES[a3] ?? []),
  ].filter((s) => typeof s === 'string' && s.trim());
  const aliasSet = new Set();
  for (const s of raw) { aliasSet.add(s.trim()); aliasSet.add(expandAbbr(s.trim())); }
  aliasSet.delete(name);

  const iso2 = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : '';
  catalogCountries.push({
    id: a3, name, iso2, kind,
    cont: continentOf(p),
    lon: Math.round(p.LABEL_X * 100) / 100, lat: Math.round(p.LABEL_Y * 100) / 100,
    tiny: p.TINY !== -99,
    rank: p.LABELRANK ?? 6,
    sov: p.SOV_A3,
    aliases: [...aliasSet],
    _primaryIso: p.ISO_A3_EH === a3 || p.ISO_A3 === a3,
  });
}

// iso2 must be unique so GeoNames country codes map to ONE catalog entry.
// Where several features share an ISO code (e.g. Australia's island territories
// all report "AU"), only the feature whose own code matches keeps it.
for (const c of catalogCountries) {
  if (!c.iso2) continue;
  (iso2Seen.get(c.iso2) ?? iso2Seen.set(c.iso2, []).get(c.iso2)).push(c);
}
for (const [iso2, list] of iso2Seen) {
  if (list.length === 1) continue;
  const primary = list.find((c) => c._primaryIso) ?? list[0];
  for (const c of list) if (c !== primary) c.iso2 = '';
}
for (const c of catalogCountries) delete c._primaryIso;

// Assertions: the denominators the Stats screen relies on.
const count = (k) => catalogCountries.filter((c) => c.kind === k).length;
console.log('kinds:', { un: count('un'), observer: count('observer'), partial: count('partial'), territory: count('territory') });
if (count('un') !== 193 || count('observer') !== 2) {
  const un = catalogCountries.filter((c) => c.kind === 'un').map((c) => c.id + ':' + c.name);
  console.error('ASSERTION FAILED: expected 193 UN members + 2 observers.\n', un.join(', '));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. US states (Natural Earth admin-1, filtered to the USA)
// ---------------------------------------------------------------------------
const ne1 = readJSON('ne_10m_admin_1_states_provinces.geojson');
const usFeatures = ne1.features.filter((f) => f.properties.iso_a2 === 'US');
if (usFeatures.length !== 51) throw new Error('expected 50 states + DC, got ' + usFeatures.length);
const stateFeatures = usFeatures.map((f) => ({
  type: 'Feature',
  properties: { id: f.properties.iso_3166_2 },
  geometry: f.geometry,
}));
const catalogStates = usFeatures.map((f) => {
  const p = f.properties;
  const postal = p.iso_3166_2.split('-')[1];
  const aliases = [postal];
  if (postal === 'DC') aliases.push('Washington DC', 'Washington D.C.', 'D.C.');
  return {
    id: p.iso_3166_2, name: p.name, country: 'USA', postal, aliases,
    lon: Math.round(p.longitude * 100) / 100, lat: Math.round(p.latitude * 100) / 100,
  };
});

// ---------------------------------------------------------------------------
// 3. Simplify shapes with mapshaper (topology-aware, keeps tiny islands)
// ---------------------------------------------------------------------------
const mapshaper = path.join(root, 'node_modules', '.bin', 'mapshaper');

const roundCoords = (c, d) => (typeof c === 'number' ? Math.round(c * 10 ** d) / 10 ** d : c.map((x) => roundCoords(x, d)));
function bboxSize(geom) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  (function walk(c) {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
    } else c.forEach(walk);
  })(geom.coordinates);
  return Math.max(maxX - minX, maxY - minY);
}

/**
 * Simplify with mapshaper (topology-aware, so shared borders stay aligned).
 * Rounding to 0.01 degrees (~1 km) would erase tiny places such as the Vatican
 * entirely, so any feature smaller than ~30 km keeps its original geometry
 * (rounded to 4 decimals, ~10 m). That costs almost nothing in file size.
 */
function simplifyTo(features, outName, pct, precision = '0.01') {
  const inFile = path.join(tmp, outName + '.in.geojson');
  fs.writeFileSync(inFile, JSON.stringify({ type: 'FeatureCollection', features }));
  const outFile = path.join(outDir, outName);
  execFileSync(mapshaper, [
    inFile, '-simplify', pct, 'keep-shapes', '-o', outFile, 'format=geojson', `precision=${precision}`,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });

  const out = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  if (out.features.length !== features.length) throw new Error('mapshaper changed the feature count');
  let rescued = 0;
  out.features.forEach((f, i) => {
    const orig = features[i];
    if (f.properties.id !== orig.properties.id) throw new Error('mapshaper changed the feature order');
    if (!f.geometry || bboxSize(orig.geometry) < 0.3) {
      f.geometry = { type: orig.geometry.type, coordinates: roundCoords(orig.geometry.coordinates, 4) };
      rescued++;
    }
  });
  // Draw order: big shapes first, so enclaves (Vatican inside Italy, Lesotho inside
  // South Africa) are painted on top and win taps.
  const area = (f) => bboxSize(f.geometry) ** 2;
  out.features.sort((a, b) => area(b) - area(a));
  fs.writeFileSync(outFile, JSON.stringify(out));
  const empty = out.features.filter((f) => !f.geometry).length;
  if (empty) throw new Error(`${empty} features in ${outName} have no geometry`);
  console.log(outName, kb(outFile), `(${rescued} tiny shapes kept at full detail)`);
}
simplifyTo(countryFeatures, 'countries.geojson', '6%');
simplifyTo(stateFeatures, 'states-us.geojson', '35%', '0.002');

fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify({
  countries: catalogCountries, states: catalogStates,
}));
console.log('catalog.json', kb(path.join(outDir, 'catalog.json')));

// ---------------------------------------------------------------------------
// 4. Cities (GeoNames cities5000) -> compact rows
//    row: [geonameid, name, lat, lon, countryCode, admin1Code, population, altNames]
// ---------------------------------------------------------------------------
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lines = fs.readFileSync(path.join(rawDir, 'cities5000.txt'), 'utf8').split('\n').filter(Boolean);
const rows = [];
const usedAdmin1 = new Set();
for (const line of lines) {
  const c = line.split('\t');
  const [id, name, , alts, lat, lon, , , cc, , a1, , , , pop] = c;
  const nameFold = fold(name);
  const maxAlts = +pop >= 1000000 ? 60 : +pop >= 100000 ? 25 : +pop >= 15000 ? 8 : 3;
  const keep = [];
  const seen = new Set([nameFold]);
  for (const a of alts.split(',')) {
    const af = fold(a);
    // Keep only Latin-script spellings; others can't be typed on this keyboard.
    if (!/^[a-z0-9][a-z0-9 .'-]{1,31}$/.test(af) || seen.has(af)) continue;
    seen.add(af);
    keep.push(a);
    if (keep.length >= maxAlts) break;
  }
  rows.push([+id, name, Math.round(+lat * 1000) / 1000, Math.round(+lon * 1000) / 1000, cc, a1, +pop, keep.join('|')]);
  if (a1) usedAdmin1.add(cc + '.' + a1);
}
fs.writeFileSync(path.join(outDir, 'cities.json'), JSON.stringify(rows));
console.log('cities.json', rows.length, 'rows', kb(path.join(outDir, 'cities.json')));

const admin1 = {};
for (const line of fs.readFileSync(path.join(rawDir, 'admin1CodesASCII.txt'), 'utf8').split('\n')) {
  const [code, name] = line.split('\t');
  if (code && usedAdmin1.has(code)) admin1[code] = name;
}
fs.writeFileSync(path.join(outDir, 'admin1.json'), JSON.stringify(admin1));
console.log('admin1.json', Object.keys(admin1).length, 'entries', kb(path.join(outDir, 'admin1.json')));
fs.rmSync(tmp, { recursive: true, force: true });
