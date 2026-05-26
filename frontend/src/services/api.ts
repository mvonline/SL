import type { Station } from '../types/index.js';
import { getApiBase, isApiConfigured } from '../config/apiBase.js';

/**
 * Custom wrapper around fetch to append JWT tokens and handle standard parsing.
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<{ status: 'success' | 'error'; source?: string; data?: T; warnings?: string[]; message?: string }> {
  if (!isApiConfigured()) {
    return {
      status: 'error',
      message:
        'API URL not configured. Set GitHub variable VITE_API_BASE to your backend (e.g. https://sthlmtransit-api.onrender.com/api).',
    };
  }

  const token = localStorage.getItem('transit_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  try {
    const response = await fetch(`${getApiBase()}${endpoint}`, {
      ...options,
      headers,
    });

    const parsed = await response.json();
    if (!response.ok) {
      throw new Error(parsed.message || `API error with status: ${response.status}`);
    }

    return parsed;
  } catch (err: any) {
    console.error(`Fetch failure on endpoint ${endpoint}:`, err);
    return {
      status: 'error',
      message: err.message || 'Network communication failure.'
    };
  }
}

export const ApiClient = {
  // 1. Authentication
  async signup(username: string, password: string) {
    return apiFetch<{ token: string; username: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async login(username: string, password: string) {
    return apiFetch<{ token: string; username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async logout() {
    const result = await apiFetch<void>('/auth/logout', { method: 'POST' });
    localStorage.removeItem('transit_token');
    localStorage.removeItem('transit_username');
    return result;
  },

  async searchStations(q: string) {
    return apiFetch<Station[]>(`/stations/search?q=${encodeURIComponent(q)}`);
  },

  // 2. Stations Directory
  async getStations(bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
    let url = '/stations';
    if (bounds) {
      url += `?minLat=${bounds.minLat}&maxLat=${bounds.maxLat}&minLon=${bounds.minLon}&maxLon=${bounds.maxLon}`;
    }
    return apiFetch<any[]>(url);
  },

  /** Map markers only — excludes bus stops for performance */
  async getMapStations() {
    return apiFetch<Station[]>('/stations?forMap=true');
  },

  // 3. Live Departures (triggers dual-key caching and graceful circuit breakers)
  async getLiveDepartures(siteId: string) {
    return apiFetch<any>(`/departures/${siteId}`);
  },

  // 4. Multimodal Routing Planner
  async getRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    mode: 'walking' | 'driving' | 'transit',
    fromName?: string,
    toName?: string
  ) {
    let url = `/routing?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}&mode=${mode}`;
    if (fromName) url += `&fromName=${encodeURIComponent(fromName)}`;
    if (toName) url += `&toName=${encodeURIComponent(toName)}`;
    return apiFetch<any>(url);
  },

  // 5. Admin Sync Trigger
  async triggerAdminSync() {
    return apiFetch<{ message: string; count: number }>('/admin/sync', { method: 'POST' });
  },

  // 6. Admin Cost Analytics Aggregator
  async getAdminStats(days = 7) {
    return apiFetch<any>(`/admin/stats?days=${days}`);
  }
};
