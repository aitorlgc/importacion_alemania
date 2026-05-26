import { fetchAutoScout, type AScoutListing } from './autoscout'
import { getCache, setCache } from '../cache'

// Spanish price index: maps `make|model|yearBucket` → median price in Spain
export type PriceIndex = Map<string, number>

const TTL_MS = 3 * 60 * 60 * 1000 // 3 hours

function yearBucket(year: number): number {
  // Group into 2-year windows for more data points per bucket
  return Math.floor(year / 2) * 2
}

function indexKey(make: string, model: string, year: number): string {
  return `${make.toLowerCase()}|${model.toLowerCase()}|${yearBucket(year)}`
}

function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function buildIndex(listings: AScoutListing[]): PriceIndex {
  const groups = new Map<string, number[]>()

  for (const l of listings) {
    if (l.price < 1000 || l.year < 2000) continue
    const key = indexKey(l.make, l.model, l.year)
    const arr = groups.get(key) ?? []
    arr.push(l.price)
    groups.set(key, arr)
  }

  const index: PriceIndex = new Map()
  groups.forEach((prices, key) => {
    index.set(key, median(prices))
  })

  return index
}

export async function buildSpanishPriceIndex(makes: string[]): Promise<PriceIndex> {
  const cacheKey = `es-price-index::${makes.slice().sort().join(',')}`
  const cached = getCache<PriceIndex>(cacheKey)
  if (cached) return cached

  const allListings: AScoutListing[] = []

  await Promise.allSettled(
    makes.map(async (make) => {
      try {
        const { listings } = await fetchAutoScout(make, 'ES', 1)
        allListings.push(...listings)
      } catch (err) {
        console.warn(`[priceIndex] ES/${make}:`, err instanceof Error ? err.message : err)
      }
    })
  )

  const index = buildIndex(allListings)
  setCache(cacheKey, index, TTL_MS)
  return index
}

export function lookupSpanishPrice(
  index: PriceIndex,
  make: string,
  model: string,
  year: number
): number | null {
  // Exact bucket match
  const exact = index.get(indexKey(make, model, year))
  if (exact) return exact

  // Widen search: adjacent years ±2
  for (const delta of [1, -1, 2, -2]) {
    const adj = index.get(indexKey(make, model, year + delta))
    if (adj) return adj
  }

  // Fallback: any listing of this make in a broad year range (±3)
  let closestKey: string | null = null
  let closestDelta = Infinity
  for (const [key] of index.entries()) {
    const parts = key.split('|')
    if (parts[0] !== make.toLowerCase()) continue
    const bucket = parseInt(parts[2] ?? '0', 10)
    const delta = Math.abs(bucket - yearBucket(year))
    if (delta < closestDelta) {
      closestDelta = delta
      closestKey = key
    }
  }
  if (closestKey && closestDelta <= 4) {
    return index.get(closestKey) ?? null
  }

  return null
}
