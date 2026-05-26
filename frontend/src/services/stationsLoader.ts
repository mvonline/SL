import type { Station } from '../types/index.js';
import { ApiClient } from './api.js';
import { getApiBase } from '../config/apiBase.js';

export type StationsLoadSource = 'api' | 'fallback' | 'error';

export interface StationsLoadResult {
  status: 'success' | 'error';
  data: Station[];
  source: StationsLoadSource;
  message?: string;
}

async function loadFallbackStations(): Promise<Station[]> {
  const base = import.meta.env.BASE_URL || '/';
  const url = `${base}${base.endsWith('/') ? '' : '/'}stations-map-fallback.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fallback station file missing');
  const data = (await res.json()) as Station[];
  return Array.isArray(data) ? data : [];
}

/** Map stations: live API when available, else bundled fallback for GitHub Pages */
export async function loadMapStations(): Promise<StationsLoadResult> {
  const apiRes = await ApiClient.getMapStations();

  if (apiRes.status === 'success' && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
    return { status: 'success', data: apiRes.data as Station[], source: 'api' };
  }

  if (apiRes.status === 'success' && Array.isArray(apiRes.data) && apiRes.data.length === 0) {
    try {
      const fallback = await loadFallbackStations();
      return {
        status: 'success',
        data: fallback,
        source: 'fallback',
        message: 'API database is empty. Showing offline stations — log in and run Admin sync.',
      };
    } catch {
      return {
        status: 'error',
        data: [],
        source: 'error',
        message: 'No stations in database. Deploy backend and run Admin sync.',
      };
    }
  }

  try {
    const fallback = await loadFallbackStations();
    const hint = getApiBase()
      ? 'Backend unreachable — showing offline station list.'
      : 'Set apiBase in public/config.json or VITE_API_BASE in GitHub repo variables.';
    return {
      status: 'success',
      data: fallback,
      source: 'fallback',
      message: hint,
    };
  } catch {
    return {
      status: 'error',
      data: [],
      source: 'error',
      message: apiRes.message || 'Could not load stations from API or fallback.',
    };
  }
}
