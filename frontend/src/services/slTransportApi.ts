const SL_API_BASE = 'https://transport.integration.sl.se/v1';

const liveCache = new Map<string, { data: unknown; at: number }>();
const fallbackCache = new Map<string, unknown>();
const LIVE_TTL_MS = 15_000;

async function slFetch<T>(path: string, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SL_API_BASE}${path}`, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`SL API HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function fetchLiveDepartures(siteId: string): Promise<{
  status: 'success';
  source: 'network' | 'cache';
  data: unknown;
  warnings?: string[];
}> {
  const liveKey = siteId;
  const cached = liveCache.get(liveKey);
  if (cached && Date.now() - cached.at < LIVE_TTL_MS) {
    return { status: 'success', source: 'cache', data: cached.data };
  }

  try {
    const fresh = await slFetch<unknown>(`/sites/${siteId}/departures`);
    liveCache.set(liveKey, { data: fresh, at: Date.now() });
    fallbackCache.set(siteId, fresh);
    return { status: 'success', source: 'network', data: fresh };
  } catch {
    const fallback = fallbackCache.get(siteId);
    if (fallback) {
      return {
        status: 'success',
        source: 'cache',
        data: fallback,
        warnings: ['Showing cached departures — live feed unavailable.'],
      };
    }
    throw new Error('Transit departures temporarily unavailable.');
  }
}
