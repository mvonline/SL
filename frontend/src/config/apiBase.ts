/** Resolved at build time (VITE_API_BASE) or runtime for GitHub Pages */
export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE?.trim();
  if (configured) {
    const base = configured.replace(/\/$/, '');
    return base.endsWith('/api') ? base : `${base}/api`;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3000/api';
  }
  return '';
}

export function isApiConfigured(): boolean {
  return getApiBase().length > 0;
}

export function isGithubPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('github.io');
}
