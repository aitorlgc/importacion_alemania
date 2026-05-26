/**
 * Script de diagnóstico — ejecutar desde tu máquina local:
 *   node scripts/debug-autoscout.mjs
 *
 * Muestra la estructura exacta de los datos que devuelve AutoScout24.de
 * para que puedas ajustar el parser si la estructura ha cambiado.
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
}

const URL = 'https://www.autoscout24.de/lst/bmw/320d?atype=C&cy=D&offerType=U&sort=age&desc=1&damaged_listing=exclude&ustate=N%2CU&sizepage=3'

console.log('─'.repeat(60))
console.log('AutoScout24 DE — Debug de estructura de datos')
console.log('─'.repeat(60))
console.log(`URL: ${URL}\n`)

try {
  const res = await fetch(URL, { headers: HEADERS })
  console.log(`HTTP Status: ${res.status} ${res.statusText}`)
  console.log(`Content-Type: ${res.headers.get('content-type')}`)

  if (!res.ok) {
    console.error('\n❌ La petición fue bloqueada.')
    console.error('Posibles causas:')
    console.error('  · Cloudflare detectó el bot (cambia User-Agent o usa Playwright)')
    console.error('  · IP de datacenter bloqueada (usa una IP residencial)')
    process.exit(1)
  }

  const html = await res.text()
  console.log(`\nTamaño HTML: ${(html.length / 1024).toFixed(1)} KB`)

  // Buscar __NEXT_DATA__
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)

  if (!match) {
    console.error('\n❌ __NEXT_DATA__ NO encontrado en la página.')
    console.error('AutoScout24 puede haber migrado a App Router o cambiado la estructura.')

    // Buscar scripts alternativos
    const scripts = [...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([^<]{50,})<\/script>/g)]
    console.log(`\nScripts JSON encontrados: ${scripts.length}`)
    scripts.slice(0, 3).forEach((s, i) => {
      try {
        const parsed = JSON.parse(s[1])
        console.log(`  Script ${i + 1}: keys = ${Object.keys(parsed).join(', ')}`)
      } catch {
        console.log(`  Script ${i + 1}: JSON inválido`)
      }
    })

    // Guardar HTML para inspección manual
    await import('fs').then(fs => fs.writeFileSync('/tmp/autoscout-debug.html', html))
    console.log('\n💾 HTML guardado en /tmp/autoscout-debug.html para inspección manual')
    process.exit(1)
  }

  console.log('\n✅ __NEXT_DATA__ encontrado!')
  console.log(`Tamaño JSON: ${(match[1].length / 1024).toFixed(1)} KB`)

  const data = JSON.parse(match[1])

  // ─── Explorar estructura ───────────────────────────────────────────
  function explore(obj, prefix = '', maxDepth = 3, depth = 0) {
    if (depth > maxDepth || obj == null) return
    if (Array.isArray(obj)) {
      console.log(`${prefix}[] (${obj.length} items)`)
      if (obj.length > 0 && typeof obj[0] === 'object') {
        explore(obj[0], `${prefix}[0].`, maxDepth, depth + 1)
      }
      return
    }
    if (typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj)) {
        const type = Array.isArray(val) ? `Array(${val.length})` : typeof val
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          console.log(`${prefix}${key}: ${type}`)
          explore(val[0], `${prefix}${key}[0].`, maxDepth, depth + 1)
        } else if (typeof val === 'object' && val !== null && depth < maxDepth) {
          console.log(`${prefix}${key}: {`)
          explore(val, `${prefix}${key}.`, maxDepth, depth + 1)
        } else {
          const display = typeof val === 'string' ? `"${val.slice(0, 40)}"` : val
          console.log(`${prefix}${key}: ${display}`)
        }
      }
    }
  }

  console.log('\n── Estructura raíz ──')
  Object.entries(data).forEach(([k, v]) => {
    const type = Array.isArray(v) ? `Array(${v.length})` : typeof v
    console.log(`  ${k}: ${type}`)
  })

  // Buscar arrays que puedan ser listings
  function findArrays(obj, path = '') {
    if (!obj || typeof obj !== 'object') return []
    const found = []
    for (const [k, v] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${k}` : k
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0].id) {
        found.push({ path: fullPath, length: v.length, sample: v[0] })
      } else if (typeof v === 'object' && v !== null) {
        found.push(...findArrays(v, fullPath))
      }
    }
    return found
  }

  const arrays = findArrays(data)
  console.log(`\n── Arrays con objetos que tienen 'id' (posibles listings): ${arrays.length} ──`)
  arrays.forEach(({ path, length, sample }) => {
    console.log(`\n  📍 ${path} (${length} items)`)
    console.log(`     Primer item keys: ${Object.keys(sample).join(', ')}`)

    // Detectar si es un listing de coches
    const hasVehicle = 'vehicle' in sample
    const hasPrice = 'prices' in sample || 'price' in sample
    if (hasVehicle || hasPrice) {
      console.log('     ✅ PARECE UN LISTING DE COCHE')

      // Mostrar campos de precio
      if (sample.prices) {
        console.log(`     prices: ${JSON.stringify(sample.prices)}`)
      }
      if (sample.vehicle) {
        console.log(`     vehicle: ${JSON.stringify(sample.vehicle)}`)
      }
    }
  })

  // Si encontramos listings, mostrar el primero completo
  if (arrays.length > 0) {
    const bestMatch = arrays.find(a => {
      const s = a.sample
      return 'vehicle' in s || 'prices' in s
    }) ?? arrays[0]

    console.log('\n── Primer listing completo (JSON) ──')
    console.log(JSON.stringify(bestMatch.sample, null, 2))

    console.log('\n── Resumen para actualizar el parser ──')
    const s = bestMatch.sample
    console.log(`  Ruta en __NEXT_DATA__: ${bestMatch.path}`)
    console.log(`  Campo precio: ${s.prices ? 'prices.public.priceRaw' : 'price'}`)
    console.log(`  Campo año: ${s.vehicle?.firstRegistration ? 'vehicle.firstRegistration' : 'firstRegistration'}`)
    console.log(`  Campo km: ${s.vehicle?.mileage !== undefined ? 'vehicle.mileage' : 'mileage'}`)
    console.log(`  Campo combustible: ${s.vehicle?.fuel !== undefined ? 'vehicle.fuel' : 'fuel'}`)
    console.log(`  Campo potencia: ${s.vehicle?.power !== undefined ? 'vehicle.power (kW)' : 'power'}`)
  }

  // Guardar el JSON completo
  await import('fs').then(fs => {
    fs.writeFileSync('/tmp/autoscout-nextdata.json', JSON.stringify(data, null, 2))
    console.log('\n💾 __NEXT_DATA__ completo guardado en /tmp/autoscout-nextdata.json')
  })

} catch (err) {
  console.error('\n❌ Error de red:', err.message)
  console.error('Asegúrate de tener conexión a internet y que autoscout24.de no esté bloqueado.')
}
