import { fetchAutoScout, type AScoutListing } from './autoscout'
import { getCache, setCache } from '../cache'

export type PriceIndex = Map<string, number>

const TTL_MS = 3 * 60 * 60 * 1000 // 3 hours
// Fetch more pages per make so each make|model|year bucket has enough data points for a
// reliable median. 1 page ≈ 20 listings spread across dozens of buckets → too noisy.
// 5 pages ≈ 100 listings per make, giving ~5-10 samples per bucket on popular models.
const ES_PAGES = 5

function yearBucket(year: number): number {
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

// IQR-based outlier removal — keeps prices within [Q1 - 1.5·IQR, Q3 + 1.5·IQR]
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  if (iqr === 0) return sorted
  return sorted.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr)
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
    const clean = removeOutliers(prices)
    index.set(key, median(clean))
  })

  return index
}

export async function buildSpanishPriceIndex(makes: string[]): Promise<PriceIndex> {
  // v2 cache key invalidates old single-page cache
  const cacheKey = `es-price-index-v2::${makes.slice().sort().join(',')}`
  const cached = getCache<PriceIndex>(cacheKey)
  if (cached) return cached

  const allListings: AScoutListing[] = []

  // Fetch all pages for all makes concurrently; individual failures don't abort the rest
  await Promise.allSettled(
    makes.flatMap(make =>
      Array.from({ length: ES_PAGES }, (_, i) => i + 1).map(async page => {
        try {
          const { listings, total } = await fetchAutoScout(make, 'ES', page)
          allListings.push(...listings)
          // Stop fetching further pages if this make has fewer than a full page
          if (listings.length === 0 || (total > 0 && page * 20 >= total)) return
        } catch (err) {
          console.warn(`[priceIndex] ES/${make}/p${page}:`, err instanceof Error ? err.message : err)
        }
      })
    )
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
  // 1. Exact bucket match
  const exact = index.get(indexKey(make, model, year))
  if (exact) return exact

  // 2. Same model, adjacent year buckets ±4 years
  for (const delta of [2, -2, 4, -4, 6, -6]) {
    const adj = index.get(indexKey(make, model, year + delta))
    if (adj) return adj
  }

  // 3. Same make, any model, closest year bucket (within 4-year window).
  //    Only used as a last resort — caller should treat this price as approximate.
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
