/**
 * Script de diagnóstico — ejecutar desde tu máquina local:
 *   node scripts/debug-autoscout.mjs
 */

import fs from 'fs'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
  'Accept-Encoding': 'identity',   // evitar gzip para simplificar
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
}

// Candidatos de URL a probar en orden
const URL_CANDIDATES = [
  // Sin modelo (solo marca): la más fiable
  'https://www.autoscout24.de/lst/bmw?atype=C&cy=D&offerType=U&sort=age&desc=1&damaged_listing=exclude&ustate=N%2CU',
  // Con serie (modelo family, no variante)
  'https://www.autoscout24.de/lst/bmw/3er?atype=C&cy=D&offerType=U&sort=age&desc=1&damaged_listing=exclude&ustate=N%2CU',
  // Sin parámetros extra
  'https://www.autoscout24.de/lst/bmw',
]

console.log('─'.repeat(60))
console.log('AutoScout24 DE — Diagnóstico de URL y estructura JSON')
console.log('─'.repeat(60))

let workingUrl = null
let html = null

for (const url of URL_CANDIDATES) {
  process.stdout.write(`\nProbando: ${url}\n  → `)
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })
    process.stdout.write(`HTTP ${res.status} ${res.statusText}\n`)
    if (res.ok) {
      html = await res.text()
      workingUrl = url
      console.log(`  ✅ Funciona! Tamaño: ${(html.length / 1024).toFixed(1)} KB`)
      break
    }
  } catch (err) {
    process.stdout.write(`ERROR: ${err.message}\n`)
  }
}

if (!html) {
  console.error('\n❌ Ninguna URL funcionó.')
  console.error('Posible causa: AutoScout24 detectó el scraper desde tu red.')
  console.error('Solución: abre autoscout24.de en el navegador y luego copia las cookies de DevTools.')
  process.exit(1)
}

console.log(`\n✅ URL válida: ${workingUrl}`)

// ── Buscar __NEXT_DATA__ ──────────────────────────────────────────
const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)

if (!match) {
  console.error('\n❌ __NEXT_DATA__ no encontrado.')

  // Buscar scripts JSON alternativos
  const scripts = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([^<]{100,})<\/script>/g)]
  console.log(`Scripts JSON encontrados en la página: ${scripts.length}`)
  scripts.slice(0, 5).forEach((s, i) => {
    try {
      const parsed = JSON.parse(s[1])
      console.log(`  Script ${i + 1}: keys raíz → ${Object.keys(parsed).join(', ')}`)
    } catch { /* ignore */ }
  })

  fs.writeFileSync('autoscout-debug.html', html)
  console.log('\n💾 HTML guardado en autoscout-debug.html — ábrelo y busca "listings" manualmente')
  process.exit(1)
}

console.log(`\n✅ __NEXT_DATA__ encontrado (${(match[1].length / 1024).toFixed(1)} KB)`)
const data = JSON.parse(match[1])

// ── Buscar arrays con listings ───────────────────────────────────
function findListingArrays(obj, path = '', depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return []
  const found = []
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
      const sample = v[0]
      const keys = Object.keys(sample)
      // Detectar si parece un listing de coche
      const looksLikeListing =
        ('vehicle' in sample && 'prices' in sample) ||
        ('price' in sample && 'make' in sample) ||
        ('prices' in sample && 'id' in sample) ||
        (keys.includes('vehicle') || keys.includes('prices') || keys.includes('listing'))
      found.push({ path: p, length: v.length, sample, looksLikeListing })
    } else if (!Array.isArray(v) && typeof v === 'object') {
      found.push(...findListingArrays(v, p, depth + 1))
    }
  }
  return found
}

const arrays = findListingArrays(data)
const listings = arrays.filter(a => a.looksLikeListing)
const other = arrays.filter(a => !a.looksLikeListing)

console.log(`\n── Arrays detectados ──`)
console.log(`  Posibles listings de coches: ${listings.length}`)
console.log(`  Otros arrays:               ${other.length}`)

if (listings.length === 0) {
  console.log('\n⚠️  No se detectaron listings automáticamente.')
  console.log('Todos los arrays encontrados:')
  arrays.slice(0, 10).forEach(a => {
    console.log(`  ${a.path}: ${a.length} items — keys: ${Object.keys(a.sample).slice(0, 8).join(', ')}`)
  })
} else {
  const best = listings[0]
  console.log(`\n✅ Mejor candidato: ${best.path} (${best.length} items)`)

  const s = best.sample
  console.log('\n── Primer listing (estructura completa) ──')
  console.log(JSON.stringify(s, null, 2))

  // ── Resumen de campos ─────────────────────────────────────────
  console.log('\n── Campos detectados para el parser ──')
  const vehicle = s.vehicle ?? {}
  const prices  = s.prices  ?? {}
  const seller  = s.seller  ?? {}

  const priceRaw = prices?.public?.priceRaw ?? prices?.public?.price ?? s.price
  const firstReg = vehicle.firstRegistration ?? s.firstRegistration
  const mileage  = vehicle.mileage ?? s.mileage
  const fuel     = vehicle.fuel ?? s.fuel
  const power    = vehicle.power ?? s.power
  const powerUnit = vehicle.powerUnit ?? 'kW'
  const make     = vehicle.make ?? s.make
  const model    = vehicle.model ?? s.model

  console.log(`  path en __NEXT_DATA__ : props.pageProps.${best.path.replace('props.pageProps.', '')}`)
  console.log(`  id                   : ${s.id}`)
  console.log(`  make                 : ${make}`)
  console.log(`  model                : ${model}`)
  console.log(`  firstRegistration    : ${firstReg}`)
  console.log(`  mileage              : ${mileage}`)
  console.log(`  fuel                 : ${fuel}`)
  console.log(`  power                : ${power} ${powerUnit}`)
  console.log(`  price (raw)          : ${priceRaw}`)
  console.log(`  city                 : ${seller?.address?.city ?? s.city ?? '—'}`)
  console.log(`  url                  : ${s.url ?? '—'}`)

  console.log('\n── ACCIÓN: copia esta línea al chat ──')
  console.log(`  PATH: props.pageProps.${best.path.replace(/^props\.pageProps\./, '')} | CAMPOS: make=${make}, price=${priceRaw}, year=${firstReg?.slice(0,4)}, km=${mileage}, fuel=${fuel}`)
}

// ── Guardar JSON completo ──────────────────────────────────────
fs.writeFileSync('autoscout-nextdata.json', JSON.stringify(data, null, 2))
console.log('\n💾 JSON completo guardado en autoscout-nextdata.json')
console.log('   (ábrelo en VS Code para explorar toda la estructura)')
