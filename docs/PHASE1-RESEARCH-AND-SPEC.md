# Travel Tracker — Phase 1: Research, Stack, and v1 Spec

Status: **awaiting your approval. No code has been written.**
Research date: 2026-11-12. Prices and ratings change often; treat every figure as a snapshot.

---

## 0. How reliable is this research?

- **Primary sources:** App Store listings (descriptions, in-app-purchase prices, ratings, and the handful of reviews each page shows), plus the official policy/licence pages for Natural Earth, GeoNames, Nominatim, OSM tiles, OpenFreeMap, and GitHub Pages.
- **Limits:** The App Store pages show only a few reviews and don't show star counts per review, so I can't claim a systematic "1–3 star" sample. I read the *critical* reviews that were visible, plus Trustpilot/Google Play snippets that search surfaced. I did not read Google Play review pages in full.
- **Ambiguity:** several different apps are named "been". I used the long-running one (VINCI APPS / Apparata, App Store id 680148327).
- **Unverified:** file sizes below are my estimates (marked *est.*); I'll measure them for real in Phase 2.

---

## 1. App-by-app findings

| App | What it really is | Free vs paid (snapshot) | What users like | What users complain about |
|---|---|---|---|---|
| **Visited** (Arriving In High Heels) — 4.6★, ~14K ratings | Country/state/city map with bucket list, travel lists, itineraries, printed posters | Free with ads. Unlock Regions $3.99, Cities $9.99, Itineraries $7.99, Remove Ads $3.99, Pro $59.99 (or $34.99/yr, $9.99/mo) | Big feature set; sovereignty setting for disputed territories; dark mode, map projections | "None of the premium features were worth it"; city entry doesn't show a list/map; asks to re-enter history (2018, fixed later); country count dropped 60→58; small countries (Liechtenstein, Pitcairn) hard to find; South Georgia placed in Europe; disputed borders inconsistent; heavy personal-data collection + newsletter signup |
| **been** (VINCI/Apparata) — 4.7★, ~10K | Countries + US states, timeline, friend compare | Free with ads: countries, US states, dates. Premium: regions (25+ countries), cities, airports, extra globes, video export. Listed $2.29 / $19.99 yr / $4.99 wk | Simple; v3 timeline | "All my data seems to be gone" after an update (2023); "missing a lot of cities and no way to add them"; one visit colours the whole country; paywall added to a previously free feature; wants city pins |
| **Places Been** (Andrik Rieskamp) — 4.6★, 1.2K | Countries, states, cities, airports, UNESCO, parks | Free with ads. ~10 separate IAPs from $1.99 to $19.99 (PRO $4.99, PRO PLUS $6.99, TRAVELER $19.99, Airports $3.99…) | Bucket list + favourites; offline city database (>500 pop.); imports TripAdvisor maps | "WAY too many purchases" (wants one bundle); static shared maps; can't add unlisted sites; hard to move data to a new iPad ("paid to beta-test"); slow updates |
| **Pin Traveler** — 4.7★, 8.7K | Pin countries/cities/states, photos, dates, wishlist, friends | Current listing: unlimited pins and trips free. Premium (many overlapping plans: $2.99/wk … $24.99–34.99/yr, $39.99–44.99 lifetime) adds unlimited photos, custom pins, unlimited saved places. Older sources say a 50-pin free cap — sources conflict | Lively, well-designed; trip timelines; 500+ achievements | Older complaints: 50-pin cap not disclosed until after signup; "premium is expensive"; can't zoom out to see all pins; wants country fill + completion stats |
| **Skratch** (Zero Dawn) — 4.7★, ~2K | Scratch-map: countries, cities, regions, photos, bucket list, eSIM store | Developer says it "will always remain free" for countries. Cities & Regions power-up ~€9.99; map themes €5.99; bundle ~€12.99 | Visuals; photo-by-location timeline | Paying just to mark cities ("Useless"); crashes on map open (2019); wants manual city entry; eSIM upsell is clutter |
| **Polarsteps** — 4.9★, 10K | Trip journal with automatic GPS route tracking, followers, printed books | Free, ad-free. Plus subscription $9.99/mo or $34.99–44.99/yr. Printed books extra | Auto-tracking; works offline; privacy controls | Battery/privacy worry over always-on tracking; didn't track a live trip until home (2023); straight-line predicted routes; limited book layouts; print orders can't be cancelled. **Not a state/country counter** |
| **Mapsake** (Cole Jelinek, 2026) — 5.0★, only 12 ratings | Apple-only 3D-globe map built from your photo library; visited/lived/next | Free, no ads, no account, no IAP; data on device | Privacy stance; imports from Skratch/Visited/Polarsteps etc.; exports **JSON/CSV/Excel/PDF**; bundled offline gazetteer (230K+ places) | Too new to have real complaint history; Apple-only; needs photo access |
| **Wanderlog** — 4.9★ (App Store), Trustpilot ~1.8 (few reviews) | Trip *planner* (itineraries, budgets, collaboration) | Generous free tier. Pro ≈ $30–70/yr (listing shows many price variants) | Collaboration, reservation import, route optimiser | Offline + attachments reported as Pro-only; yearly-only billing; post-payment white-screen bugs; confusion over what stays free. **Not a tracker** |
| **Mapstr** — 4.7★, 2.6K | Save/tag places (restaurants, sights), import Google Maps/CSV/KML | Free until ~300 pins, then Mapstr Plus ≈ $60–80/yr | Tags, notes, ratings, photos, web version, CSV export, Google Maps import | "Charged a subscription to add pins over 300 — switching back to Google Maps". **Not country/state tracking** |
| Others noticed | *Countries Visited Tracker* (iOS, fully offline, free+IAP); *Driftlog* (auto-detects visits in background, on-device); self-hosted *AdventureLog*, *TREK*, *Dawarich* (need a server) | — | — | No free, serverless, installable, import/export-friendly web option turned up |

> The gap: **nobody offers countries + states + city pins + bucket list + JSON export, all free, with no account.** That's the niche for this app.

---

## 2. Feature comparison

Legend: **F** = free, **$** = paid, **—** = not evidenced in listing/reviews I could read.

| Feature | Visited | been | Places Been | Pin Traveler | Skratch | Polarsteps | Mapsake | Wanderlog | Mapstr |
|---|---|---|---|---|---|---|---|---|---|
| Countries | F | F | F | F | F | via route | F | — | — |
| US states / regions | $ | F (US), $ regions | F | F | $ | — | F | — | — |
| Cities | $ | $ | F (offline DB) | F | $ | via route | F | — | saved places |
| Free-form pins | — | — | places | F | — | steps | — | F | F (≤~300) |
| Bucket list / want-to-go | F | — | F | F | F | plan | "Next" lens | F | "To try" |
| Visit dates | partial | F | — | F | timeline | F | F | F | — |
| Notes | country notes | — | — | F | — | F | — | F | F |
| Photos | stock only | — | — | $ beyond limit | F | F | from library | $ attachments | F |
| Rating / tags | — | — | favourites | custom pins $ | — | — | — | — | F |
| Stats (% of world) | F | continent ratio | F | F | F | F | F | — | — |
| Sharing | posters ($) | share sheet | static image | links/images | F | followers | link/QR | collab | link |
| Import | — | — | TripAdvisor | — | — | — | many apps | email | Google Maps/CSV/KML |
| **Export** | — | — | — | — | — | — | **JSON/CSV/Excel/PDF** | Pro (Google Maps) | CSV |
| Works offline | — | — | F | — | — | F | F | $ (per reviews) | — |
| Account required | yes | optional | optional | yes | yes | yes | **no** | yes | optional |
| Ads | yes | yes | yes | — | — | no | **no** | — | — |
| Disputed-territory setting | **F** | — | — | — | — | — | — | — | — |

---

## 3. What my app should do

**(a) Must-have**
1. Countries, US states, and city/pin tracking — **all free, no caps**.
2. One-tap toggle for countries/states, with undo.
3. Per-place visit dates (multiple visits), notes, optional rating and tags.
4. Want-to-go (bucket list) status.
5. Stats: countries, % of world, states, pins.
6. Works fully offline; no account; data stays on device.
7. **JSON export/import** (the feature most competitors lack entirely).
8. Handle edge cases explicitly: territories, disputed regions, name aliases, tiny countries, duplicate pins.

**(b) Nice-to-have (v1.1+)**
CSV export; photos (stored locally); admin-1 regions for other countries (UK, Canada, Australia, etc.); import from Google Maps/KML; achievements; shareable map image; map themes; Natural Earth point-of-view selector; optional free sync later.

**(c) Complaints to design out**
| Complaint (app) | Design response |
|---|---|
| Paywalled cities/regions (Visited, Skratch, been) | Everything free; $0 forever |
| Pin caps (Mapstr ~300, Pin Traveler 50 historically) | No limits |
| Too many separate purchases (Places Been) | No purchases |
| Lost data after update / re-entry prompts (been, Visited) | IndexedDB + schema migrations + export reminder + import tested |
| Missing cities with no way to add (been, Places Been, Skratch) | Drop-a-pin anywhere + bundled ~50K-city search |
| One visit paints a whole country (been) | Countries/states/pins are independent levels; app *offers* but never forces roll-up |
| Disputed borders handled inconsistently; small countries unfindable; count jumps (Visited) | One documented rule set, search list + markers for microstates, stable IDs |
| Accounts, ads, newsletters, heavy data collection (Visited) | No account, no analytics, no ads, no network calls except optional map tiles |
| Hard to move data to a new device (Places Been) | JSON export/import is a first-class feature |
| Can't zoom out to see everything (Pin Traveler) | "Fit all" button, min zoom shows whole world |

---

## 4. Approaches considered

| Approach | Verdict |
|---|---|
| **A. Local-first PWA, static hosting (recommended)** | $0 forever, installable on iPhone/Android, no accounts, works offline, you own the data |
| B. Native iOS app (SwiftUI) | Free to *write*, but installing on a phone long-term needs Apple's $99/yr developer account (free provisioning expires after 7 days) → fails the $0 rule; also iPhone-only |
| C. PWA + free cloud backend (Supabase/Firebase) | Adds accounts, quotas, and a service that can change terms. Possible later as optional sync; not needed for v1 |

---

## 5. Recommended stack ($0 to build, host, run)

| Layer | Choice | Why / tradeoff |
|---|---|---|
| Build | **Vite + TypeScript + Preact** | Small, fast, one-command build. Preact (~3 KB) keeps UI code tidy without a heavy framework. Tradeoff: needs Node installed; I'll walk you through it. (My call — you can veto.) |
| Map engine | **MapLibre GL JS** (BSD-3 licence) | WebGL vector rendering; can recolour polygons by state instantly (feature-state), smooth on phones. Leaflet is smaller and simpler, but redrawing ~250 country + 51 state polygons as SVG is heavier. |
| Country/state shapes | **Natural Earth** (public domain, no attribution required; I'll credit anyway) | Admin-0 countries at 1:50m/10m; Admin-1 filtered to US states. Boundaries follow *de facto* control, and Natural Earth offers separate disputed-area layers and point-of-view variants. Convert to simplified TopoJSON/GeoJSON at build time (*est.* well under 1 MB for countries, a few hundred KB for US states). |
| City search | **Bundled GeoNames `cities5000`** (~50K places; CC BY 4.0 — attribution required, commercial use OK) trimmed to name, ASCII name, lat/lon, country, admin1, population, id (+ a few alternate names) | Works 100% offline, instant, no API limits. *Est.* ~1–2 MB compressed, lazy-loaded then cached. Tradeoff: towns under 5,000 people aren't listed → covered by drop-a-pin and custom name. |
| Online geocoding | **Not in v1.** Nominatim's policy bans autocomplete, caps at 1 request/second, requires a identifying User-Agent/Referer and caching. Possible as an explicit "search online" button later. | Avoids policy risk and a network dependency |
| Basemap context | **Natural Earth polygons always (offline)** + **optional OpenFreeMap streets layer when online** while placing pins | OpenFreeMap: free, no key, no view limits, commercial OK; donation-funded with no SLA, so the app must never *depend* on it. OSM's own raster tiles are rejected: policy prohibits offline/bulk use and is best-effort only. Self-hosted PMTiles is a possible v1.1 for full offline streets (I haven't measured its size). |
| Storage | **IndexedDB** via the small `idb` wrapper | Structured, large, works offline. See iOS caveat below. |
| PWA | `vite-plugin-pwa` (Workbox): manifest, icons, precached app shell + data | Installable, offline |
| Tests | **Vitest** for logic (stats, dedup, import/export, alias search); real-browser walkthrough of core flows before I call it done | |
| Hosting | **GitHub Pages** via a GitHub Actions workflow (limits: 1 GB site, soft 100 GB/month bandwidth, no commercial use — all irrelevant for a personal app). Runner-up: Cloudflare Pages free (unlimited static requests, 500 deploys/month). | Your *data never touches the repo or server* — it lives only on your device. |

**Important iOS caveat (verified from Apple forum/WebKit discussion, secondary sources):** Safari can delete a website's storage after 7 days without use, but **installed Home-Screen web apps are exempt** from that rule — and the installed app and Safari tab have *separate* storage. Persistent-storage requests aren't reliable on iOS, and storage can still be evicted under severe disk pressure. So: install to Home Screen, and the app will show a "last exported N days ago" reminder. Export is a safety net, not an afterthought.

---

## 6. v1 specification

### 6.1 Features
1. **World map (home)** — countries coloured: visited / want-to-go / none. Tap a country → toggles visited (Undo toast with a "Details" link). Tap a visited country again → un-visits. "Fit world" button.
2. **US states layer** — switch level to "States": 50 states + DC (+ territories listed as territories). Same tap behaviour.
3. **Pins** — search (offline GeoNames) or long-press the map to drop a pin. Dropped pins auto-detect country/state by point-in-polygon (offline). Duplicate check on save.
4. **Place details** — status (visited / want-to-go), visit dates (multiple; exact day, range, month, or year only), notes, rating 1–5 (optional), tags (optional).
5. **Lists** — Visited and Want-to-go, grouped by continent/country, searchable.
6. **Stats** — countries visited, % of world, states visited (x/51), pin count, continents, first/latest visit.
7. **Settings** — "what counts as a country" mode, export/import, storage status, attributions/About, erase all.
8. **Export/Import** — one JSON file; import previews "N new / M updated / K duplicates" and offers Merge or Replace.
9. **PWA** — installable, offline, no account.

### 6.2 Edge-case rules (documented in-app under About)
- **Country list:** every Natural Earth admin-0 polygon is selectable. Each is tagged `sovereign` (UN member), `observer` (Vatican, Palestine), `partial` (e.g., Kosovo, Taiwan, Western Sahara), or `territory` (e.g., Puerto Rico, Greenland, Hong Kong, Guam).
- **"% of world" denominator — setting, default 195** (193 UN members + 2 observers). Alternatives: 193, or "all countries & territories (~250)". Territories you visit are always shown as "+N territories", never silently merged into or dropped from your country count. (Travel counters genuinely disagree: 193, 195, 197+, and Travelers' Century Club ~330 — so it must be a setting.)
- **Disputed borders:** v1 uses Natural Earth's default (*de facto* control) and states that plainly. A point-of-view selector is a v1.1 option; choosing one is a political choice and I don't want to make it silently for you.
- **Name spellings:** every place has `aliases`; search is diacritic- and case-insensitive. Examples: Czechia/Czech Republic, Türkiye/Turkey, Myanmar/Burma, Côte d'Ivoire/Ivory Coast, Eswatini/Swaziland, Cabo Verde/Cape Verde, Timor-Leste/East Timor, DR Congo, UK/Britain/England, USA/America. Cities use GeoNames alternate names (Wien → Vienna, München → Munich).
- **Tiny countries:** the map has a list/search path to every country, plus marker dots for microstates at low zoom, so nothing is "unclickable".
- **Duplicate pins:** searched cities are keyed by GeoNames ID (same ID → add a *visit* to the existing place, don't create a second pin). Dropped pins within ~1 km with a similar name prompt "add a visit instead?". Import dedupes by ID first, then name + rounded coordinates. Same name, different place (Paris, TX vs Paris, FR) is distinguished by ID and shown with region/country.
- **Stable IDs:** country/state IDs are ISO codes, so counts can't jump when map data is updated.

### 6.3 Data model (IndexedDB)

```
places            (one store, one row per tracked thing)
  id              string  (uuid; stable across export/import)
  kind            'country' | 'state' | 'city' | 'pin'
  refId           string? (ISO 3166-1/-2 code, or GeoNames id; null for free pins)
  name            string
  countryCode     string  (ISO alpha-2)
  admin1          string? (e.g., 'US-NY')
  lat, lon        number? (cities/pins)
  status          'visited' | 'wishlist'
  visits          [{ start: '2019' | '2019-07' | '2019-07-04', end?: same, note? }]
  notes           string
  rating          1-5 | null
  tags            string[]
  createdAt, updatedAt  ISO timestamps

settings          countMode ('un193' | 'un195' | 'all'), theme, lastExportedAt
meta              schemaVersion, appVersion
```

Export file: `{ "app": "travel-tracker", "schemaVersion": 1, "exportedAt": "...", "places": [...], "settings": {...} }`. Import validates the schema, migrates older versions, and never overwrites without a preview.

### 6.4 Screens (mobile-first)

```
┌──────────────────────────┐
│ 🔍 Search places…    ⚙  │  Map (home)
│ [Countries|States|Pins]  │
│                          │   tap = toggle visited
│     (world map)          │   long-press = drop pin
│                          │
│                       ⌖  │   fit-all
│ ✓ France visited  UNDO ▸ │   toast + Details
├──────────────────────────┤
│  🗺 Map  ☰ Lists  📊 Stats│  bottom nav
└──────────────────────────┘
```
1. **Map** 2. **Place sheet** (bottom sheet: status, dates, notes, rating, tags, delete) 3. **Search** (countries, states, cities; recent) 4. **Lists** (Visited / Want-to-go tabs) 5. **Stats** 6. **Settings** (count mode, export/import, storage status, About & attributions, erase)

### 6.5 Non-goals for v1
Accounts or cloud sync; photos; social/friends; trip itineraries; automatic GPS tracking; admin-1 regions outside the US; native app-store apps.

### 6.6 Attributions shown in About
Natural Earth (public domain; credited courtesy), GeoNames (CC BY 4.0), OpenStreetMap contributors / OpenFreeMap / OpenMapTiles (when streets layer is on), MapLibre (BSD-3).

---

## 7. Free-hosting walkthrough (preview of Phase 2)
1. Create a free GitHub account (you do this — account creation and passwords are yours).
2. Create a public repository `travel-tracker`; I give you the files and exact commands to push them.
3. Turn on GitHub Pages → "GitHub Actions"; a workflow I supply builds and deploys on every push.
4. Open `https://<your-username>.github.io/travel-tracker/` on your phone → Share/Menu → **Add to Home Screen**.
5. Do a first export to confirm backups work.

---

## 8. Decisions I need from you
1. **Phone:** iPhone or Android? (iOS has the storage caveat above and changes the install steps.)
2. **Tap behaviour:** tap toggles immediately with an Undo toast (as you asked), vs. tap opens a sheet. *I recommend the toggle + Undo.*
3. **% of world default:** 195 (UN + 2 observers), changeable in Settings. OK?
4. **Basemap:** offline Natural Earth shapes always; streets from OpenFreeMap only when online. OK?
5. **Stack:** Vite + TypeScript + Preact + MapLibre. OK? (Needs Node.js on your Mac; I'll check and guide.)
6. **States scope:** US states only in v1, other countries' regions in v1.1. OK?

## Sources
- Store listings: [Visited](https://apps.apple.com/us/app/visited-map-where-ive-been/id846983349), [been](https://apps.apple.com/us/app/680148327), [Places Been](https://apps.apple.com/us/app/-/id1480355919), [Pin Traveler](https://apps.apple.com/US/app/id1335839375), [Skratch](https://apps.apple.com/hr/app/id1457438876?l=hr), [Polarsteps](https://apps.apple.com/us/app/-/id947925763), [Mapsake](https://apps.apple.com/app/id6775122085), [Wanderlog](https://apps.apple.com/ua/app/id1476732439), [Mapstr](https://apps.apple.com/us/app/id917288465)
- Data/policy: [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/), [Admin-0 countries](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/), [Admin-1 states](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/), [GeoNames dump readme](https://download.geonames.org/export/dump/readme.txt), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [OpenFreeMap](https://openfreemap.org/), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)
- Other: [Apple forum on PWA storage](https://developer.apple.com/forums/thread/710157), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits), [country-count conventions](https://everything-everywhere.com/how-many-countries-in-the-world/), [AdventureLog/TREK/Dawarich search](https://github.com/mauriceboe/TREK)
