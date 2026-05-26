/** Coerce API values to safe React text children (avoids "Objects are not valid as a React child") */
export function asText(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return asText((value as { name?: unknown }).name, fallback);
  }
  return fallback;
}
