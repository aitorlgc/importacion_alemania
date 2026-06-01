import type { Car, CostBreakdown, CostConfig, EnrichedCar, FuelType, TaxCategory } from './types'

export function deriveCo2(fuel: FuelType, co2?: number): { value: number; source: 'csv' | 'estimated' } {
  if (co2 !== undefined && co2 >= 0 && !isNaN(co2)) {
    return { value: co2, source: 'csv' }
  }
  const defaults: Record<FuelType, number> = {
    electric: 0,
    hybrid: 80,
    phev: 80,
    diesel: 140,
    gasoline: 150,
    unknown: 150,
  }
  return { value: defaults[fuel], source: 'estimated' }
}

export function getMatriculacionRate(co2Gkm: number): number {
  if (co2Gkm === 0) return 0
  if (co2Gkm <= 120) return 0
  if (co2Gkm <= 160) return 0.0475
  if (co2Gkm <= 200) return 0.0975
  return 0.1475
}

export function getTaxCategory(rate: number): TaxCategory {
  if (rate === 0) return '0%'
  if (rate === 0.0475) return '4.75%'
  if (rate === 0.0975) return '9.75%'
  return '14.75%'
}

export function computeBreakdown(car: Car, config: CostConfig): CostBreakdown {
  const { value: co2Used, source: co2Source } = deriveCo2(car.fuel, car.co2)
  const matriculacionTaxRate = getMatriculacionRate(co2Used)
  const fiscalBase = car.price + config.transport
  const matriculacionTaxAmount = fiscalBase * matriculacionTaxRate

  const totalCost =
    car.price +
    config.transport +
    matriculacionTaxAmount +
    config.gestoria +
    config.itv +
    config.dgt +
    config.insurance

  const profit = car.precioVentaEspana - totalCost
  const marginPct = totalCost > 0 ? (profit / totalCost) * 100 : 0

  return {
    purchasePrice: car.price,
    transport: config.transport,
    fiscalBase,
    matriculacionTaxRate,
    matriculacionTaxAmount,
    gestoria: config.gestoria,
    itv: config.itv,
    dgt: config.dgt,
    insurance: config.insurance,
    totalCost,
    marketPriceSpain: car.precioVentaEspana,
    profit,
    marginPct,
    co2Used,
    co2Source,
  }
}

export function enrichCars(cars: Car[], config: CostConfig): EnrichedCar[] {
  return cars.map(car => ({
    ...car,
    breakdown: computeBreakdown(car, config),
  }))
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNum(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value)
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

export function profitColorClass(profit: number): string {
  if (profit > 5000) return 'text-emerald-600 font-semibold'
  if (profit > 2000) return 'text-amber-600 font-semibold'
  if (profit >= 0) return 'text-orange-500'
  return 'text-rose-500'
}

export function profitBgClass(profit: number): string {
  if (profit > 5000) return 'bg-emerald-50'
  if (profit > 2000) return 'bg-amber-50'
  if (profit >= 0) return 'bg-orange-50'
  return 'bg-rose-50'
}
