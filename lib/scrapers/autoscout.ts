import type { FuelType, TransmissionType } from '../types'

const BROWSER_HEADERS_DE: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
}

const BROWSER_HEADERS_ES: Record<string, string> = {
  ...BROWSER_HEADERS_DE,
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
}

export type AScoutListing = {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileage: number | null
  fuel: FuelType
  hp: number | null
  transmission: TransmissionType
  co2: number | null
  url: string
  city: string | null
}

function parseFuel(raw?: string): FuelType {
  const v = (raw ?? '').toUpperCase().trim()
  if (['E', 'ELECTRIC', 'ELEKTRO', 'EV'].includes(v)) return 'electric'
  if (['H', 'HYBRID', 'MHEV', 'FHEV'].includes(v)) return 'hybrid'
  if (['PHEV', 'PLUG-IN'].includes(v)) return 'phev'
  if (['D', 'DIESEL'].includes(v)) return 'diesel'
  if (['B', 'G', 'GASOLINE', 'PETROL', 'BENZIN'].includes(v)) return 'gasoline'
  return 'unknown'
}

function parseTransmission(raw?: string): TransmissionType {
  const v = (raw ?? '').toUpperCase().trim()
  if (['A', 'AUTOMATIC', 'AUTOMATIK', 'AUTOMATICA'].includes(v)) return 'automatic'
  if (['M', 'MANUAL'].includes(v)) return 'manual'
  return 'unknown'
}

function extractNextData(html: string): unknown {
  // Match __NEXT_DATA__ script tag (handles optional nonce and other attributes)
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (!match?.[1]) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dig(obj: unknown, ...keys: string[]): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[k]
  }
  return cur
}

function extractListings(data: unknown): AScoutListing[] {
  // AutoScout24 has changed their data structure multiple times.
  // Try several known paths in order of likelihood.
  const candidates = [
    dig(data, 'props', 'pageProps', 'listings'),
    dig(data, 'props', 'pageProps', 'listingPage', 'listings'),
    dig(data, 'props', 'pageProps', 'listingsModel', 'listings'),
    dig(data, 'props', 'pageProps', 'initialState', 'listing', 'items'),
    dig(data, 'props', 'pageProps', 'data', 'listings'),
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const mapped: AScoutListing[] = []
      for (const item of candidate) {
        try {
          mapped.push(mapItem(item))
        } catch {
          // skip malformed items
        }
      }
      if (mapped.length > 0) return mapped
    }
  }

  return []
}

function extractTotal(data: unknown): number {
  return (
    Number(dig(data, 'props', 'pageProps', 'totalCount')) ||
    Number(dig(data, 'props', 'pageProps', 'listingPage', 'totalCount')) ||
    0
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(item: any): AScoutListing {
  const vehicle = item.vehicle ?? {}
  const prices = item.prices ?? {}
  const seller = item.seller ?? {}
  const address = seller.address ?? {}

  const priceRaw =
    Number(prices?.public?.priceRaw) ||
    Number(prices?.public?.price) ||
    Number(item.price) ||
    0

  const firstReg = String(vehicle.firstRegistration ?? item.firstRegistration ?? '0000-01')
  const year = parseInt(firstReg.slice(0, 4), 10) || 0

  // AutoScout24 stores power in kW, convert to CV/HP
  const rawPower = Number(vehicle.power ?? item.power ?? 0)
  const powerUnit = String(vehicle.powerUnit ?? 'kw').toLowerCase()
  const hp = rawPower > 0 ? (powerUnit === 'kw' ? Math.round(rawPower * 1.36) : rawPower) : null

  return {
    id: String(item.id ?? ''),
    make: String(vehicle.make ?? item.make ?? '').toLowerCase().trim(),
    model: String(vehicle.model ?? item.model ?? '').trim(),
    year,
    price: priceRaw,
    mileage: Number(vehicle.mileage ?? item.mileage ?? 0) || null,
    fuel: parseFuel(String(vehicle.fuel ?? item.fuel ?? '')),
    hp,
    transmission: parseTransmission(String(vehicle.transmission ?? item.transmission ?? '')),
    co2: Number(vehicle.co2 ?? item.co2 ?? 0) || null,
    url: String(item.url ?? ''),
    city: String(address.city ?? item.city ?? '') || null,
  }
}

// AutoScout24 URL format: /lst/{make} — model goes as query param, not in path
// /lst/{make}/{model-variant} returns 404; use mmvco[] for filtering by model
export async function fetchAutoScout(
  make: string,
  country: 'DE' | 'ES',
  page = 1,
): Promise<{ listings: AScoutListing[]; total: number }> {
  const domain = country === 'DE' ? 'autoscout24.de' : 'autoscout24.es'
  const cy = country === 'DE' ? 'D' : 'E'
  const headers = country === 'DE' ? BROWSER_HEADERS_DE : BROWSER_HEADERS_ES

  const makeSlug = make.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')

  // AutoScout24 accepts page param but NOT sizepage — always returns ~20 results
  const params = new URLSearchParams({
    atype: 'C',
    cy,
    offerType: 'U',
    sort: 'age',
    desc: '1',
    damaged_listing: 'exclude',
    ustate: 'N,U',
    ...(page > 1 ? { page: String(page) } : {}),
  })

  const url = `https://www.${domain}/lst/${makeSlug}?${params}`

  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`AutoScout24 ${country}/${make}: HTTP ${res.status}`)
  }

  const html = await res.text()
  const data = extractNextData(html)

  if (!data) {
    throw new Error(`AutoScout24 ${country}/${make}: __NEXT_DATA__ not found in page`)
  }

  const listings = extractListings(data)
  const total = extractTotal(data)

  return { listings, total }
}
