/**
 * Regenerates public/stations-map-fallback.json (optional).
 * Requires monorepo with backend/src/data/stockholmStationsSeed.ts.
 * CI uses the committed JSON in public/ — no generation at build time.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedPaths = [
  join(root, '..', 'backend', 'src', 'data', 'stockholmStationsSeed.ts'),
  join(root, 'scripts', 'stockholmStationsSeed.ts'),
];
const outPath = join(root, 'public', 'stations-map-fallback.json');

const seedPath = seedPaths.find((p) => existsSync(p));
if (!seedPath) {
  if (existsSync(outPath)) {
    console.log('Seed file not found; keeping existing public/stations-map-fallback.json');
    process.exit(0);
  }
  console.error('No seed file and no existing stations-map-fallback.json');
  process.exit(1);
}

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

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(stations));
console.log(`Wrote ${stations.length} stations to ${outPath}`);
