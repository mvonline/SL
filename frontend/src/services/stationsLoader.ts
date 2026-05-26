import type { Station } from '../types/index.js';
import { isStaticMode } from '../config/staticMode.js';
import { ApiClient } from './api.js';
import { getMapStations, loadStationsDb } from './stationsDb.js';

export type StationsLoadSource = 'api' | 'fallback' | 'error';

export interface StationsLoadResult {
  status: 'success' | 'error';
  data: Station[];
  source: StationsLoadSource;
  message?: string;
}

/** Map stations: offline JSON on GitHub Pages, or live backend when configured */
export async function loadMapStations(): Promise<StationsLoadResult> {
  if (isStaticMode) {
    try {
      const all = await loadStationsDb();
      const data = getMapStations(all);
      return {
        status: 'success',
        data,
        source: 'fallback',
        message: `${data.length} stations from offline database.`,
      };
    } catch {
      return {
        status: 'error',
        data: [],
        source: 'error',
        message: 'Could not load stations-map-fallback.json.',
      };
    }
  }

  const apiRes = await ApiClient.getMapStations();

  if (apiRes.status === 'success' && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
    return { status: 'success', data: apiRes.data as Station[], source: 'api' };
  }

  try {
    const all = await loadStationsDb();
    const data = getMapStations(all);
    return {
      status: 'success',
      data,
      source: 'fallback',
      message: 'Backend unreachable — showing offline stations.',
    };
  } catch {
    return {
      status: 'error',
      data: [],
      source: 'error',
      message: apiRes.message || 'Could not load stations.',
    };
  }
}
