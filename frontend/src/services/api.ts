import type { Station } from '../types/index.js';
import { isStaticMode } from '../config/staticMode.js';
import { getApiBase, isApiConfigured } from '../config/apiBase.js';
import {
  getMapStations,
  loadStationsDb,
  searchStationsLocal,
} from './stationsDb.js';
import { fetchLiveDepartures } from './slTransportApi.js';
import { resolveDeparturesSiteId } from './journeyPlanner.js';
import { getRoute as getStaticRoute } from './staticRouting.js';

type ApiResult<T> = {
  status: 'success' | 'error';
  source?: string;
  data?: T;
  warnings?: string[];
  message?: string;
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  if (!isApiConfigured()) {
    return {
      status: 'error',
      message: 'Backend API not configured.',
    };
  }

  const token = localStorage.getItem('transit_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  try {
    const response = await fetch(`${getApiBase()}${endpoint}`, { ...options, headers });
    const parsed = await response.json();
    if (!response.ok) {
      throw new Error(parsed.message || `API error with status: ${response.status}`);
    }
    return parsed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network communication failure.';
    console.error(`Fetch failure on endpoint ${endpoint}:`, err);
    return { status: 'error', message };
  }
}

export const ApiClient = {
  async signup(username: string, password: string) {
    if (isStaticMode) return { status: 'error' as const, message: 'Auth not available in static mode.' };
    return apiFetch<{ token: string; username: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async login(username: string, password: string) {
    if (isStaticMode) return { status: 'error' as const, message: 'Auth not available in static mode.' };
    return apiFetch<{ token: string; username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async logout() {
    if (isStaticMode) {
      localStorage.removeItem('transit_token');
      localStorage.removeItem('transit_username');
      return { status: 'success' as const };
    }
    const result = await apiFetch<void>('/auth/logout', { method: 'POST' });
    localStorage.removeItem('transit_token');
    localStorage.removeItem('transit_username');
    return result;
  },

  async searchStations(q: string) {
    if (isStaticMode) {
      const all = await loadStationsDb();
      return { status: 'success' as const, data: searchStationsLocal(q, all) };
    }
    return apiFetch<Station[]>(`/stations/search?q=${encodeURIComponent(q)}`);
  },

  async getStations() {
    if (isStaticMode) {
      const all = await loadStationsDb();
      return { status: 'success' as const, data: all };
    }
    return apiFetch<Station[]>('/stations');
  },

  async getMapStations() {
    if (isStaticMode) {
      const all = await loadStationsDb();
      return { status: 'success' as const, data: getMapStations(all) };
    }
    return apiFetch<Station[]>('/stations?forMap=true');
  },

  async getLiveDepartures(stationId: string) {
    if (isStaticMode) {
      try {
        const all = await loadStationsDb();
        const station = all.find((s) => s.id === stationId);
        const siteId = await resolveDeparturesSiteId(
          stationId,
          station
            ? { name: station.name, latitude: station.latitude, longitude: station.longitude }
            : undefined
        );
        if (!siteId) {
          return { status: 'error' as const, message: 'Could not resolve station for departures.' };
        }
        return await fetchLiveDepartures(siteId);
      } catch (err: unknown) {
        return {
          status: 'error' as const,
          message: err instanceof Error ? err.message : 'Departures unavailable.',
        };
      }
    }
    return apiFetch<unknown>(`/departures/${stationId}`);
  },

  async getRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    mode: 'walking' | 'driving' | 'transit',
    fromName?: string,
    toName?: string
  ) {
    if (isStaticMode) {
      try {
        const data = await getStaticRoute(
          fromLat,
          fromLon,
          toLat,
          toLon,
          mode,
          fromName,
          toName
        );
        const { status: _ignored, ...route } = data;
        return { status: 'success' as const, ...route };
      } catch (err: unknown) {
        return {
          status: 'error' as const,
          message: err instanceof Error ? err.message : 'Routing failed.',
        };
      }
    }
    let url = `/routing?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}&mode=${mode}`;
    if (fromName) url += `&fromName=${encodeURIComponent(fromName)}`;
    if (toName) url += `&toName=${encodeURIComponent(toName)}`;
    return apiFetch<unknown>(url);
  },

  async triggerAdminSync() {
    if (isStaticMode) {
      return {
        status: 'success' as const,
        data: { message: 'Using offline station database.', count: (await loadStationsDb()).length },
      };
    }
    return apiFetch<{ message: string; count: number }>('/admin/sync', { method: 'POST' });
  },

  async getAdminStats(days = 7) {
    if (isStaticMode) return { status: 'error' as const, message: 'Stats not available in static mode.' };
    return apiFetch<unknown>(`/admin/stats?days=${days}`);
  },
};
