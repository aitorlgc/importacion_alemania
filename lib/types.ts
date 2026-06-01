export interface RawCsvRow {
  make?: string | number
  model?: string | number
  price?: string | number
  year?: string | number
  hp?: string | number
  km?: string | number
  fuel?: string | number
  transmission?: string | number
  precio_venta_espana?: string | number
  costes_importacion?: string | number
  beneficio_potencial?: string | number
  co2?: string | number
  [key: string]: string | number | undefined
}

export type FuelType = 'diesel' | 'gasoline' | 'electric' | 'hybrid' | 'phev' | 'unknown'
export type TransmissionType = 'manual' | 'automatic' | 'unknown'
export type TaxCategory = '0%' | '4.75%' | '9.75%' | '14.75%'

export interface Car {
  id: number
  make: string
  model: string
  year: number
  price: number
  hp: number | null
  km: number | null
  fuel: FuelType
  transmission: TransmissionType
  precioVentaEspana: number
  co2?: number
  listingUrl?: string
  location?: string
}

export interface CostConfig {
  transport: number
  gestoria: number
  itv: number
  dgt: number
  insurance: number
}

export const DEFAULT_COST_CONFIG: CostConfig = {
  transport: 1000,
  gestoria: 350,
  itv: 50,
  dgt: 110,
  insurance: 80,
}

export interface CostBreakdown {
  purchasePrice: number
  transport: number
  fiscalBase: number
  matriculacionTaxRate: number
  matriculacionTaxAmount: number
  gestoria: number
  itv: number
  dgt: number
  insurance: number
  totalCost: number
  marketPriceSpain: number
  profit: number
  marginPct: number
  co2Used: number
  co2Source: 'csv' | 'estimated'
}

export interface FilterState {
  brands: string[]
  yearMin: number
  yearMax: number
  kmMax: number
  profitMin: number
  fuelTypes: FuelType[]
  taxCategories: TaxCategory[]
}

export interface EnrichedCar extends Car {
  breakdown: CostBreakdown
}
