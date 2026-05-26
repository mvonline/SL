/** Build-time (VITE_API_BASE), runtime (public/config.json), or dev localhost */

function normalizeApiBase(raw: string): string {
  const base = raw.trim().replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

let resolvedApiBase = '';

export async function initApiConfig(): Promise<void> {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) {
    resolvedApiBase = normalizeApiBase(fromEnv);
    return;
  }

  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const configUrl = new URL('config.json', window.location.origin + baseUrl).href;
    const res = await fetch(configUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { apiBase?: string };
      if (data.apiBase?.trim()) {
        resolvedApiBase = normalizeApiBase(data.apiBase);
        return;
      }
    }
  } catch {
    /* offline or missing config.json */
  }

  if (import.meta.env.DEV) {
    resolvedApiBase = 'http://localhost:3000/api';
  }
}

export function getApiBase(): string {
  return resolvedApiBase;
}

export function isApiConfigured(): boolean {
  return getApiBase().length > 0;
}
