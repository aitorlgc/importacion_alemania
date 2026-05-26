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

// ─── Fuel normalizer ─────────────────────────────────────────────
// AutoScout24 uses German display strings: "Elektro/Benzin", "Diesel",
// "Mild-Hybrid (Diesel)", "Plug-in-Hybrid (Benzin)", "Elektro", etc.
function parseFuel(raw?: string): FuelType {
  const v = (raw ?? '').toLowerCase().trim()
  if (!v) return 'unknown'

  if (v === 'elektro' || v === 'electric' || v === 'eléctrico' || v === 'ev' || v === 'e') return 'electric'

  // PHEV: "Elektro/Benzin", "Plug-in-Hybrid", "Elektro/Diesel"
  if (v.includes('elektro/') || v.includes('plug-in') || v.includes('plugin')) return 'phev'

  // Mild hybrid (48V etc.)
  if (v.includes('mild-hybrid') || v.includes('mild hybrid') || v.includes('mhev')) return 'hybrid'

  // Generic hybrid
  if (v.includes('hybrid') || v.includes('híbrido')) return 'hybrid'

  if (v.includes('diesel') || v.includes('diésel')) return 'diesel'

  if (v.includes('benzin') || v.includes('gasoline') || v.includes('petrol') ||
      v.includes('gasolina') || v.includes('nafta') || v === 'b' || v === 'g') return 'gasoline'

  // LPG / CNG — cost-wise similar to gasoline
  if (v.includes('lpg') || v.includes('autogas') || v.includes('erdgas') || v.includes('cng')) return 'gasoline'

  return 'unknown'
}

// ─── Transmission normalizer ─────────────────────────────────────
function parseTransmission(raw?: string): TransmissionType {
  const v = (raw ?? '').toLowerCase().trim()
  if (v.includes('automat') || v === 'a') return 'automatic'
  if (v.includes('manual') || v.includes('schalt') || v === 'm') return 'manual'
  return 'unknown'
}

// ─── vehicleDetails helper ───────────────────────────────────────
// vehicleDetails is an array of { data: string, ariaLabel: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detailData(vehicleDetails: any[], ariaLabel: string): string | null {
  if (!Array.isArray(vehicleDetails)) return null
  const item = vehicleDetails.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d: any) => typeof d?.ariaLabel === 'string' && d.ariaLabel.toLowerCase() === ariaLabel.toLowerCase()
  )
  return item?.data ?? null
}

// ─── Field extractors ────────────────────────────────────────────

// Price: best source is tracking.price (clean numeric string, e.g. "32480")
// Fallback: parse priceFormatted "€ 32.480" by stripping non-digits
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPrice(item: any): number {
  // tracking.price is the most reliable — clean numeric string
  const fromTracking = Number(item.tracking?.price)
  if (fromTracking > 0) return fromTracking

  // priceFormatted: "€ 32.480" — remove currency symbol, dots used as thousand separators
  const formatted = String(item.price?.priceFormatted ?? '')
  if (formatted) {
    const clean = formatted.replace(/[^\d,]/g, '').replace(',', '.')
    const n = parseFloat(clean)
    if (n > 0) return n
  }

  return 0
}

// Year: tracking.firstRegistration = "05-2022" (MM-YYYY)
// Fallback: vehicleDetails[ariaLabel="Erstzulassung"].data = "05/2022"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractYear(item: any): number {
  // tracking.firstRegistration: "05-2022" → year = last 4 chars
  const trackingReg = String(item.tracking?.firstRegistration ?? '')
  if (trackingReg) {
    const match = trackingReg.match(/(\d{4})$/)
    if (match) return parseInt(match[1], 10)
  }

  // vehicleDetails "Erstzulassung": "05/2022"
  const detailReg = detailData(item.vehicleDetails, 'Erstzulassung') ??
                    detailData(item.vehicleDetails, 'Primera matriculación')
  if (detailReg) {
    const match = detailReg.match(/(\d{4})/)
    if (match) return parseInt(match[1], 10)
  }

  return 0
}

// Mileage: tracking.mileage = "43982" (clean numeric string)
// Fallback: vehicle.mileageInKm = "43.982 km" (German format, dots = thousands)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMileage(item: any): number | null {
  // tracking.mileage is cleanest
  const fromTracking = Number(item.tracking?.mileage)
  if (fromTracking > 0) return fromTracking

  // vehicle.mileageInKm: "43.982 km" → remove dots and " km"
  const kmStr = String(item.vehicle?.mileageInKm ?? '')
  if (kmStr) {
    const clean = kmStr.replace(/\./g, '').replace(/[^\d]/g, '')
    const n = parseInt(clean, 10)
    if (n > 0) return n
  }

  return null
}

// HP: vehicleDetails[ariaLabel="Leistung"].data = "215 kW (292 PS)"
// Extract PS from parentheses; convert kW if no PS found
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHp(item: any): number | null {
  const leistung = detailData(item.vehicleDetails, 'Leistung') ??
                   detailData(item.vehicleDetails, 'Potencia')

  if (leistung) {
    // "(292 PS)" → 292
    const psMatch = leistung.match(/\((\d+)\s*PS\)/)
    if (psMatch) return parseInt(psMatch[1], 10)

    // "215 kW" with no PS → convert
    const kwMatch = leistung.match(/(\d+)\s*kW/)
    if (kwMatch) return Math.round(parseInt(kwMatch[1], 10) * 1.36)
  }

  return null
}

// CO2: vehicleDetails[ariaLabel="CO₂-Emissionen"].data = "149 (g/km)"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCo2(item: any): number | null {
  const co2Data = detailData(item.vehicleDetails, 'CO₂-Emissionen') ??
                  detailData(item.vehicleDetails, 'Emisiones CO₂')
  if (co2Data) {
    const match = co2Data.match(/(\d+)/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > 0 && n < 1000) return n  // sanity check
    }
  }
  return null
}

// ─── Main item mapper ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(item: any): AScoutListing {
  const vehicle = item.vehicle ?? {}

  // modelGroup ("3er") is more useful than model ("330") for matching across listings
  const model = String(vehicle.modelGroup ?? vehicle.model ?? item.model ?? '').trim()

  return {
    id:           String(item.id ?? ''),
    make:         String(vehicle.make ?? item.make ?? '').toLowerCase().trim(),
    model,
    year:         extractYear(item),
    price:        extractPrice(item),
    mileage:      extractMileage(item),
    fuel:         parseFuel(String(vehicle.fuel ?? item.fuel ?? '')),
    hp:           extractHp(item),
    transmission: parseTransmission(String(vehicle.transmission ?? item.transmission ?? '')),
    co2:          extractCo2(item),
    url:          String(item.url ?? ''),
    city:         String(item.location?.city ?? item.seller?.address?.city ?? '') || null,
  }
}

// ─── Next.js data extraction ──────────────────────────────────────
function extractNextData(html: string): unknown {
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (!match?.[1]) return null
  try { return JSON.parse(match[1]) } catch { return null }
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
  const candidates = [
    dig(data, 'props', 'pageProps', 'listings'),
    dig(data, 'props', 'pageProps', 'listingPage', 'listings'),
    dig(data, 'props', 'pageProps', 'listingsModel', 'listings'),
    dig(data, 'props', 'pageProps', 'initialState', 'listing', 'items'),
    dig(data, 'props', 'pageProps', 'data', 'listings'),
    dig(data, 'props', 'pageProps', 'searchResults', 'listings'),
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const mapped: AScoutListing[] = []
      for (const item of candidate) {
        try { mapped.push(mapItem(item)) } catch { /* skip malformed */ }
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

// ─── Public API ───────────────────────────────────────────────────
// AutoScout24 URL: /lst/{make} — model is NOT part of the URL path.
export async function fetchAutoScout(
  make: string,
  country: 'DE' | 'ES',
  page = 1,
): Promise<{ listings: AScoutListing[]; total: number }> {
  const domain  = country === 'DE' ? 'autoscout24.de' : 'autoscout24.es'
  const cy      = country === 'DE' ? 'D' : 'E'
  const headers = country === 'DE' ? BROWSER_HEADERS_DE : BROWSER_HEADERS_ES
  const makeSlug = make.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')

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
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) })

  if (!res.ok) throw new Error(`AutoScout24 ${country}/${make}: HTTP ${res.status}`)

  const html = await res.text()
  const data = extractNextData(html)
  if (!data) throw new Error(`AutoScout24 ${country}/${make}: __NEXT_DATA__ not found`)

  return { listings: extractListings(data), total: extractTotal(data) }
}
