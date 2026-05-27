import { NextRequest } from 'next/server'
import { fetchAutoScout, type AScoutListing } from '@/lib/scrapers/autoscout'
import { buildSpanishPriceIndex, lookupSpanishPrice } from '@/lib/scrapers/priceIndex'
import { getCache, setCache, getCacheAge } from '@/lib/cache'
import type { Car } from '@/lib/types'

export const dynamic = 'force-dynamic'

export const TOP_BRANDS = [
  'bmw', 'audi', 'volkswagen', 'mercedes-benz', 'porsche',
  'skoda', 'toyota', 'ford', 'opel', 'volvo', 'renault', 'hyundai',
]

const TTL_MS = 2 * 60 * 60 * 1000 // 2 hours
// Fetch 3 DE pages per make (~60 German listings per brand) for a wider opportunity set
const DE_PAGES = 3

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const makesParam = searchParams.get('makes')
  const forceRefresh = searchParams.get('refresh') === '1'

  const makes = makesParam
    ? makesParam.split(',').map(m => m.trim().toLowerCase()).filter(Boolean)
    : TOP_BRANDS

  const cacheKey = `live-v2::${makes.slice().sort().join(',')}`

  if (!forceRefresh) {
    const cached = getCache<Car[]>(cacheKey)
    if (cached) {
      const ageMs = getCacheAge(cacheKey) ?? 0
      const cachedAtMs = Date.now() - (TTL_MS - ageMs)
      return Response.json({
        cars: cached,
        fromCache: true,
        cachedAt: new Date(cachedAtMs).toISOString(),
        brands: makes,
      })
    }
  }

  // Fetch German listings (multiple pages) and Spanish price index in parallel
  const [dePageResults, spIndex] = await Promise.all([
    Promise.allSettled(
      makes.flatMap(make =>
        Array.from({ length: DE_PAGES }, (_, i) =>
          fetchAutoScout(make, 'DE', i + 1).then(r => ({ make, listings: r.listings }))
        )
      )
    ),
    buildSpanishPriceIndex(makes),
  ])

  const cars: Car[] = []
  const errors: string[] = []
  let id = 0

  // Deduplicate by listing id to avoid showing the same car from multiple page fetches
  const seenIds = new Set<string>()

  dePageResults.forEach(result => {
    if (result.status === 'rejected') {
      const msg = result.reason instanceof Error ? result.reason.message : String(result.reason)
      errors.push(msg)
      console.warn('[live/route]', msg)
      return
    }

    for (const listing of result.value.listings as AScoutListing[]) {
      if (listing.price <= 0 || listing.year < 2005) continue
      if (listing.id && seenIds.has(listing.id)) continue
      if (listing.id) seenIds.add(listing.id)

      const spPrice = lookupSpanishPrice(spIndex, listing.make, listing.model, listing.year)
      if (!spPrice || spPrice <= 0) continue

      cars.push({
        id: id++,
        make: listing.make,
        model: listing.model,
        year: listing.year,
        price: listing.price,
        hp: listing.hp,
        km: listing.mileage,
        fuel: listing.fuel,
        transmission: listing.transmission,
        precioVentaEspana: spPrice,
        co2: listing.co2 ?? undefined,
        location: listing.city ?? undefined,
      })
    }
  })

  // Sort by gross margin (DE price spread) descending
  cars.sort((a, b) => (b.precioVentaEspana - b.price) - (a.precioVentaEspana - a.price))

  setCache(cacheKey, cars, TTL_MS)

  return Response.json({
    cars,
    fromCache: false,
    fetchedAt: new Date().toISOString(),
    brands: makes,
    errors: errors.length > 0 ? errors : undefined,
    spanishIndexSize: spIndex.size,
  })
}
