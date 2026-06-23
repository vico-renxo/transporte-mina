// In-memory cache — persists across SPA navigation, reset on full page reload
const _store = new Map<string, { data: unknown; ts: number }>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

export function hasCache(key: string): boolean {
  const hit = _store.get(key);
  return !!(hit && Date.now() - hit.ts < DEFAULT_TTL);
}

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const hit = _store.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.data as T;
  const data = await fetcher();
  _store.set(key, { data, ts: Date.now() });
  return data;
}

export function bust(...keys: string[]): void {
  keys.forEach(k => _store.delete(k));
}
