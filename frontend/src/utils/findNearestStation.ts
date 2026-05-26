import type { Station } from '../types/index.js';

export function findNearestStation(
  stations: Station[],
  lat: number,
  lon: number
): { station: Station; distanceMeters: number } | null {
  if (!stations.length || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let best: Station | null = null;
  let bestDistSq = Infinity;

  for (const s of stations) {
    if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) continue;
    const dSq =
      (s.latitude - lat) ** 2 + (s.longitude - lon) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = s;
    }
  }

  if (!best) return null;

  // Rough meters (valid near Stockholm latitudes)
  const distanceMeters = Math.sqrt(bestDistSq) * 111_320;
  return { station: best, distanceMeters };
}
