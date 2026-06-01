'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react'
import type { Car, CostConfig, FilterState } from '@/lib/types'
import { DEFAULT_COST_CONFIG } from '@/lib/types'
import { enrichCars, getTaxCategory } from '@/lib/costCalculator'
import { TOP_BRANDS } from '@/app/api/live/route'
import StatsCards from './StatsCards'
import OpportunityTable from './OpportunityTable'
import ChartsSection from './ChartsSection'
import CostBreakdownModal from './CostBreakdownModal'
import FiltersPanel from './FiltersPanel'
import type { EnrichedCar, TaxCategory, FuelType } from '@/lib/types'

type LiveStatus = 'idle' | 'loading' | 'success' | 'error'

interface LiveData {
  cars: Car[]
  fromCache: boolean
  fetchedAt: string
  brands: string[]
  errors?: string[]
}

type SortKey = 'make' | 'model' | 'year' | 'km' | 'price' | 'precioVentaEspana' | 'matriculacionTaxRate' | 'totalCost' | 'profit' | 'marginPct'

const PAGE_SIZE = 50

function applyFilters(cars: EnrichedCar[], f: FilterState): EnrichedCar[] {
  return cars.filter(car => {
    if (f.brands.length > 0 && !f.brands.includes(car.make)) return false
    if (f.yearMin && car.year < f.yearMin) return false
    if (f.yearMax && car.year > f.yearMax) return false
    if (f.kmMax && car.km !== null && car.km > f.kmMax) return false
    if (car.breakdown.profit < f.profitMin) return false
    if (f.fuelTypes.length > 0 && !f.fuelTypes.includes(car.fuel as FuelType)) return false
    if (f.taxCategories.length > 0) {
      const cat = getTaxCategory(car.breakdown.matriculacionTaxRate) as TaxCategory
      if (!f.taxCategories.includes(cat)) return false
    }
    return true
  })
}

function sortCars(cars: EnrichedCar[], key: SortKey, dir: 'asc' | 'desc'): EnrichedCar[] {
  return [...cars].sort((a, b) => {
    let av: number | string
    let bv: number | string
    if (['matriculacionTaxRate', 'totalCost', 'profit', 'marginPct'].includes(key)) {
      av = a.breakdown[key as keyof typeof a.breakdown] as number
      bv = b.breakdown[key as keyof typeof b.breakdown] as number
    } else if (key === 'km') {
      av = a.km ?? -1; bv = b.km ?? -1
    } else {
      av = a[key as keyof EnrichedCar] as number | string
      bv = b[key as keyof EnrichedCar] as number | string
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })
}

interface Props {
  costConfig: CostConfig
}

export default function LiveSearchSection({ costConfig }: Props) {
  const [status, setStatus] = useState<LiveStatus>('idle')
  const [data, setData] = useState<LiveData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedCar, setSelectedCar] = useState<EnrichedCar | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('profit')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<FilterState>({
    brands: [], yearMin: 2005, yearMax: 2025, kmMax: 300000, profitMin: 0, fuelTypes: [], taxCategories: [],
  })

  const fetchLive = useCallback(async (refresh = false) => {
    setStatus('loading')
    setErrorMsg(null)
    try {
      const url = `/api/live${refresh ? '?refresh=1' : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as LiveData
      setData(json)
      setStatus('success')
      setCurrentPage(1)

      // Init filters from data
      if (json.cars.length > 0) {
        const years = json.cars.map(c => c.year).filter(y => y > 2000)
        setFilters(f => ({
          ...f,
          yearMin: Math.min(...years),
          yearMax: Math.max(...years),
        }))
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
      setStatus('error')
    }
  }, [])

  // Auto-fetch on mount
  useEffect(() => { fetchLive() }, [fetchLive])

  const enriched = data
    ? enrichCars(data.cars, costConfig)
    : []

  const filtered = applyFilters(enriched, filters)
  const sorted = sortCars(filtered, sortKey, sortDir)
  const paged = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleSort(key: SortKey, dir: 'asc' | 'desc') {
    setSortKey(key); setSortDir(dir); setCurrentPage(1)
  }

  const fetchedTime = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex flex-1 overflow-hidden">
      {status === 'success' && data && (
        <FiltersPanel
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setCurrentPage(1) }}
          allCars={enriched}
        />
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 min-w-0">
        {/* Status bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {status === 'loading' && (
              <div className="flex items-center gap-2 text-indigo-600 text-sm">
                <RefreshCw size={15} className="animate-spin" />
                <span>Obteniendo datos de AutoScout24.de y AutoScout24.es…</span>
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <Wifi size={15} />
                <span className="font-medium">{data?.cars.length} vehículos cargados</span>
                {data?.fromCache && (
                  <span className="flex items-center gap-1 text-slate-400 text-xs">
                    <Clock size={11} /> caché · actualizado {fetchedTime}
                  </span>
                )}
                {!data?.fromCache && (
                  <span className="text-slate-400 text-xs">· directo {fetchedTime}</span>
                )}
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-rose-600 text-sm">
                <WifiOff size={15} />
                <span>{errorMsg}</span>
              </div>
            )}
            {status === 'idle' && (
              <span className="text-slate-500 text-sm">Iniciando búsqueda…</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLive(true)}
              disabled={status === 'loading'}
              className="btn-outline flex items-center gap-2 text-xs disabled:opacity-50"
            >
              <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : ''} />
              Actualizar datos
            </button>
          </div>
        </div>

        {/* Partial errors warning */}
        {status === 'success' && data?.errors && data.errors.length > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Algunas marcas no se pudieron cargar (anti-scraping activo):</p>
              <p className="text-xs mt-1 text-amber-700">{data.errors.join(' · ')}</p>
              <p className="text-xs mt-1">Prueba a recargar o revisa que el servidor tenga acceso a internet.</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="stat-card animate-pulse h-24 bg-slate-100" />
              ))}
            </div>
            <div className="section-card animate-pulse h-64 bg-slate-100" />
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="section-card p-12 text-center">
            <WifiOff size={40} className="text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-700 mb-2">No se pudo conectar con AutoScout24</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              Posibles causas: bloqueo anti-scraping, sin acceso a internet, o el servicio no responde.
              Asegúrate de que el servidor tenga acceso a autoscout24.de y autoscout24.es.
            </p>
            <button onClick={() => fetchLive(true)} className="btn-primary mx-auto">
              Reintentar
            </button>
          </div>
        )}

        {/* Results */}
        {status === 'success' && data && enriched.length > 0 && (
          <>
            <StatsCards cars={filtered} />

            <OpportunityTable
              cars={paged}
              total={sorted.length}
              page={currentPage}
              pageSize={PAGE_SIZE}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onPageChange={setCurrentPage}
              onRowClick={setSelectedCar}
            />

            <ChartsSection cars={filtered} />
          </>
        )}

        {/* No results */}
        {status === 'success' && data && enriched.length === 0 && (
          <div className="section-card p-12 text-center">
            <p className="text-slate-500">
              AutoScout24 respondió pero no se encontraron listados con precio en ambos mercados.
              Puede que la estructura de la web haya cambiado.
            </p>
          </div>
        )}
      </div>

      {selectedCar && (
        <CostBreakdownModal car={selectedCar} onClose={() => setSelectedCar(null)} />
      )}
    </div>
  )
}
