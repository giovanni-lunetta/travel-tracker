# Travel Tracker

A free, private map of everywhere you've been. Tap a country or US state to mark it visited, search or drop a pin for any city or place, and add trips, notes, ratings and tags. It works offline, installs on your phone like an app, and keeps everything on your device. There is no account, no server, no ads and nothing to pay for.

- **Levels:** countries, US states, and cities or pins. Each can be *Visited* or *Want to go*.
- **Stats:** countries visited, % of the world, states, and cities and pins.
- **Your data is yours:** export everything to one JSON file and import it back at any time.
- **Costs $0:** built, hosted and run entirely on free services.

---

## 1. Try it on your computer

You need [Node.js](https://nodejs.org) (version 22 or newer). Open Terminal in this folder:

```bash
npm install
```

```bash
npm run dev
```

Open the address it prints (usually http://localhost:5173). Run the checks with:

```bash
npm test
```

## 2. Put it online for free (GitHub Pages)

You do this once. After that, every update is two commands.

**a) Make a free GitHub account** at <https://github.com/signup> (skip if you have one).

**b) Create an empty repository.** At <https://github.com/new>: name it `travel-tracker`, choose **Public**, and leave every "add a README / .gitignore / license" box **unticked**. Click **Create repository**. (Public is required for free Pages. Your *places* are never in the repository. They live only on your devices.)

**c) Send this folder to GitHub.** In Terminal, inside this folder (replace `YOUR-USERNAME`):

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "Travel Tracker v1"
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/travel-tracker.git
```

```bash
git push -u origin main
```

GitHub may ask you to sign in the first time. If it asks for a password, it wants a *personal access token* (GitHub > Settings > Developer settings > Tokens) or use the free [GitHub Desktop](https://desktop.github.com) app instead.

**d) Turn on Pages.** In your repository: **Settings > Pages > Build and deployment > Source: GitHub Actions**.

**e) Wait about two minutes.** Open the **Actions** tab to watch "Deploy to GitHub Pages" turn green. Your app is now at:

```
https://YOUR-USERNAME.github.io/travel-tracker/
```

**To update later:** change files, then `git add .`, `git commit -m "describe the change"` and `git push`. It redeploys by itself, and installed copies update the next time they open online.

> Prefer Cloudflare Pages? Create a free Cloudflare account, choose **Workers & Pages > Create > Pages > Connect to Git**, pick the repository, set **Build command** `npm run build` and **Build output directory** `dist`. No other settings are needed.

## 3. Install it on your phone

Open your app's address on your phone, then:

- **iPhone (Safari):** tap the **Share** button, then **Add to Home Screen**.
- **Android (Chrome):** menu (three dots), then **Install app** (or **Add to Home screen**).

**iPhone tip:** install it to the Home Screen. Safari can clear a website's stored data after 7 days of not opening it, but installed apps are exempt. The installed app also has *separate* storage from the Safari tab, so if you tried it in Safari first, use **Settings > Export backup** there and **Import** in the installed app.

## 4. Back up your places

Everything is stored in your phone's browser storage, so **export a backup now and then** (Settings > Export backup). The app reminds you if it has been 30 days. On a phone this opens the share sheet. Choose **Save to Files** (iPhone) or Drive/Files (Android). To move to a new phone, install the app there and **Import** the file.

## How things are counted

- **Countries** follow the UN list: 193 members plus two observers (the Vatican and Palestine) = **195**. Change this in Settings to 193 or to "everything on the map".
- **Territories** (Puerto Rico, Greenland, Hong Kong...) and **disputed or partly recognised places** (Taiwan, Kosovo, Western Sahara, Somaliland, Northern Cyprus) are tracked too. They count as "extra" unless you pick "everything on the map".
- **Borders** are Natural Earth's default, which draws lines by who controls the land. This is a map convention, not a political statement.
- **Duplicates:** a pin within about 150 m of another pin, or about 1 km with a similar name, is treated as a duplicate and you're asked first. Searched cities use a fixed ID, so you can't add the same city twice.
- **Name spellings:** search understands alternate names (Czech Republic, Ivory Coast, Burma, Wien, München...). Accents and capitals don't matter.

## What uses the internet

Nothing, by default, once the app has loaded: the maps, 70,000 cities and all your data are on your device. Two optional things, both in Settings > Map, talk to the free [OpenFreeMap](https://openfreemap.org) service: place **names** on the map (fonts, then cached for offline) and the **street map** when you zoom in. Turn both off for zero network requests. OpenFreeMap sees your IP address and the area you view, as any map server would. Turn them off if that matters to you.

## Credits and licences

- Country and state shapes: [Natural Earth](https://www.naturalearthdata.com) (public domain).
- Cities: [GeoNames](https://www.geonames.org) (CC BY 4.0). Credit is shown in the app.
- Optional map names and streets: [OpenFreeMap](https://openfreemap.org), OpenMapTiles and © OpenStreetMap contributors.
- Map engine: [MapLibre GL JS](https://maplibre.org) (BSD-3).

## For developers

- Stack: Vite, TypeScript, Preact, MapLibre GL JS, IndexedDB (via `idb`), `vite-plugin-pwa`, Vitest.
- `src/lib/` is plain logic with tests in `tests/` (stats, search, dedup, import/export, geo). `src/store.ts` holds state and every action. `src/ui/` is the interface.
- `docs/PHASE1-RESEARCH-AND-SPEC.md` has the research, comparison and original spec.

### Rebuilding the map and city data

The data in `public/data/` is already built and committed. To rebuild it, download these into a new empty folder: `ne_10m_admin_0_countries.geojson` and `ne_10m_admin_1_states_provinces.geojson` from [Natural Earth's GitHub](https://github.com/nvkelso/natural-earth-vector/tree/master/geojson), and `cities5000.zip` (unzip it) plus `admin1CodesASCII.txt` from <https://download.geonames.org/export/dump/>. Then:

```bash
node scripts/build-data.mjs /path/to/that/folder
```

The script stops with an error if the UN member count isn't exactly 193 plus 2 observers.
