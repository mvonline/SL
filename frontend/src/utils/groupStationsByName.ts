import type { Station } from '../types/index.js';

const STOP_TYPE_PRIORITY: Record<Station['stop_type'], number> = {
  METRO: 4,
  TRAIN: 3,
  FERRY: 2,
  BUS: 1,
};

/** Normalized key for grouping the same physical stop across tariff zones */
export function stationNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Collapse rows that share a station name (e.g. multiple zones) into one map marker.
 * Position is the average of variants; tariff_zone lists all zones.
 */
export function groupStationsByName(stations: Station[]): Station[] {
  const groups = new Map<string, Station[]>();

  for (const station of stations) {
    const key = stationNameKey(station.name);
    const list = groups.get(key) ?? [];
    list.push(station);
    groups.set(key, list);
  }

  const merged: Station[] = [];

  for (const variants of groups.values()) {
    if (variants.length === 1) {
      merged.push(variants[0]);
      continue;
    }

    const rep = [...variants].sort((a, b) => {
      if (b.is_major !== a.is_major) return b.is_major - a.is_major;
      return STOP_TYPE_PRIORITY[b.stop_type] - STOP_TYPE_PRIORITY[a.stop_type];
    })[0];

    const valid = variants.filter(
      (v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude)
    );
    const latitude =
      valid.length > 0
        ? valid.reduce((sum, v) => sum + v.latitude, 0) / valid.length
        : rep.latitude;
    const longitude =
      valid.length > 0
        ? valid.reduce((sum, v) => sum + v.longitude, 0) / valid.length
        : rep.longitude;

    const zones = [...new Set(variants.map((v) => v.tariff_zone).filter(Boolean))].sort();

    merged.push({
      ...rep,
      latitude,
      longitude,
      tariff_zone: zones.join(', '),
      is_major: variants.some((v) => v.is_major) ? 1 : 0,
    });
  }

  return merged;
}
