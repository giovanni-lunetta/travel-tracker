import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/**
 * BASE_PATH is the URL folder the site lives in. For a GitHub project page that
 * is "/<repo-name>/" (the deploy workflow sets it automatically); locally it is "/".
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      // New versions install quietly and take over the next time you open the app.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Travel Tracker',
        short_name: 'Travel Tracker',
        description: 'A free, private map of everywhere you have been. Works offline.',
        theme_color: '#f1f2f0',
        background_color: '#cfe0e8',
        display: 'standalone',
        categories: ['travel', 'lifestyle'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs offline: code, styles, icons and the map/city data.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,json,geojson}'],
        // cities.json is ~6 MB; the default limit (2 MB) would silently leave it out.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Map fonts (place names) and style files from OpenFreeMap: cache once, reuse offline.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(fonts|sprites|styles)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'openfreemap-static', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Street tiles you have looked at. Capped well below OpenFreeMap's offline-download limits.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(planet|natural_earth)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'openfreemap-tiles', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
