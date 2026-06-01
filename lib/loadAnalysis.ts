import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import type { Car, FuelType, RawCsvRow, TransmissionType } from './types'

function normalizeFuel(raw: string | number | undefined): FuelType {
  const v = String(raw ?? '').toLowerCase().trim()
  if (['electric', 'elektro', 'ev', 'eléctrico', 'electrico'].includes(v)) return 'electric'
  if (['hybrid', 'híbrido', 'hibrido'].includes(v)) return 'hybrid'
  if (['phev', 'plug-in hybrid', 'plugin hybrid'].includes(v)) return 'phev'
  if (v === 'diesel' || v === 'diésel') return 'diesel'
  if (['gasoline', 'petrol', 'benzin', 'gasolina', 'nafta'].includes(v)) return 'gasoline'
  return 'unknown'
}

function normalizeTransmission(raw: string | number | undefined): TransmissionType {
  const v = String(raw ?? '').toLowerCase().trim()
  if (['automatic', 'automatik', 'automática', 'automatico'].includes(v)) return 'automatic'
  if (v === 'manual') return 'manual'
  return 'unknown'
}

function safeNum(v: string | number | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function safeNumRequired(v: string | number | undefined, fallback = 0): number {
  const n = safeNum(v)
  return n === null ? fallback : n
}

export function loadAnalysis(): Car[] {
  const filePath = path.join(process.cwd(), 'data', 'analisis_arbitraje_coches_final.csv')
  const csv = fs.readFileSync(filePath, 'utf8')

  const parsed = Papa.parse<RawCsvRow>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  return parsed.data
    .map((r, index): Car => ({
      id: index,
      make: String(r.make ?? '').toLowerCase().trim(),
      model: String(r.model ?? '').trim(),
      year: safeNumRequired(r.year, 0),
      price: safeNumRequired(r.price, 0),
      hp: safeNum(r.hp),
      km: safeNum(r.km),
      fuel: normalizeFuel(r.fuel),
      transmission: normalizeTransmission(r.transmission),
      precioVentaEspana: safeNumRequired(r.precio_venta_espana, 0),
      co2: safeNum(r.co2 as string | undefined) ?? undefined,
    }))
    .filter(car => car.price > 0 && car.precioVentaEspana > 0)
}
