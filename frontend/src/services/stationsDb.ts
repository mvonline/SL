import type { Station } from '../types/index.js';

let cache: Station[] | null = null;

function stationsUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${base.endsWith('/') ? '' : '/'}stations-map-fallback.json`;
}

export async function loadStationsDb(): Promise<Station[]> {
  if (cache) return cache;
  const res = await fetch(stationsUrl());
  if (!res.ok) throw new Error('Offline station database missing');
  const data = (await res.json()) as Station[];
  cache = Array.isArray(data) ? data : [];
  return cache;
}

export function getMapStations(stations: Station[]): Station[] {
  return stations.filter((s) => ['METRO', 'TRAIN', 'FERRY'].includes(s.stop_type));
}

export function searchStationsLocal(q: string, stations: Station[]): Station[] {
  const lower = q.trim().toLowerCase();
  if (!lower) return [];
  return stations
    .filter((s) => s.name.toLowerCase().includes(lower))
    .sort((a, b) => (b.is_major ?? 0) - (a.is_major ?? 0))
    .slice(0, 40);
}

export function getClosestStation(stations: Station[], lat: number, lon: number): Station {
  return stations.reduce((best, s) => {
    const dBest = (best.latitude - lat) ** 2 + (best.longitude - lon) ** 2;
    const dCurr = (s.latitude - lat) ** 2 + (s.longitude - lon) ** 2;
    return dCurr < dBest ? s : best;
  });
}
