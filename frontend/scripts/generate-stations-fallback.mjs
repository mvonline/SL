/**
 * Generates public/stations-map-fallback.json from backend seed (metro/train/ferry only).
 * Run: node scripts/generate-stations-fallback.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(root, '..', 'backend', 'src', 'data', 'stockholmStationsSeed.ts');
const outPath = join(root, 'public', 'stations-map-fallback.json');

const src = readFileSync(seedPath, 'utf8');
const stations = [];
const re =
  /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*latitude:\s*([\d.]+),\s*longitude:\s*([\d.]+),\s*tariff_zone:\s*'([^']+)',\s*stop_type:\s*'([^']+)',\s*is_major:\s*(\d+)\s*\}/g;

let m;
while ((m = re.exec(src)) !== null) {
  const stop_type = m[6];
  if (!['METRO', 'TRAIN', 'FERRY'].includes(stop_type)) continue;
  stations.push({
    id: m[1],
    name: m[2],
    latitude: Number(m[3]),
    longitude: Number(m[4]),
    tariff_zone: m[5],
    stop_type,
    is_major: Number(m[7]),
  });
}

writeFileSync(outPath, JSON.stringify(stations, null, 0));
console.log(`Wrote ${stations.length} stations to ${outPath}`);
