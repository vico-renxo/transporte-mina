// In-memory cache — persists across SPA navigation, reset on full page reload
const _store = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

export function hasCache(key) {
  const hit = _store.get(key);
  return !!(hit && Date.now() - hit.ts < DEFAULT_TTL);
}

export async function cached(key, fetcher, ttl = DEFAULT_TTL) {
  const hit = _store.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.data;
  const data = await fetcher();
  _store.set(key, { data, ts: Date.now() });
  return data;
}

export function bust(...keys) {
  keys.forEach(k => _store.delete(k));
}
