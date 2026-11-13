/** Renders the app icons (PNG) from scripts/icon.svg. Run: npm run icons */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'scripts', 'icon.svg'));
const out = path.join(root, 'public');
const sizes = { 'pwa-192.png': 192, 'pwa-512.png': 512, 'apple-touch-icon.png': 180 };
for (const [name, size] of Object.entries(sizes)) {
  await sharp(svg).resize(size, size).png().toFile(path.join(out, name));
  console.log('wrote', name);
}
