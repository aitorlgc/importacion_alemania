type Entry<T> = { data: T; expiresAt: number }

// Module-level store — persists across requests on the same Node.js process.
// On Vercel Edge/Serverless, each invocation is isolated; for persistent
// caching in production use Vercel KV or Redis.
const store = new Map<string, Entry<unknown>>()

export function getCache<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function getCacheAge(key: string): number | null {
  const entry = store.get(key)
  if (!entry) return null
  const remaining = entry.expiresAt - Date.now()
  if (remaining <= 0) return null
  return remaining
}

export function clearCache(key?: string): void {
  if (key) store.delete(key)
  else store.clear()
}
