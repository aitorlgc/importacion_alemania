'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Car, CostConfig, EnrichedCar, FilterState, FuelType, TaxCategory } from '@/lib/types'
import { DEFAULT_COST_CONFIG } from '@/lib/types'
import { enrichCars, getTaxCategory } from '@/lib/costCalculator'
import DashboardHeader from './DashboardHeader'
import FiltersPanel from './FiltersPanel'
import StatsCards from './StatsCards'
import OpportunityTable from './OpportunityTable'
import ChartsSection from './ChartsSection'
import CostBreakdownModal from './CostBreakdownModal'
import CostConfigPanel from './CostConfigPanel'
import LiveSearchSection from './LiveSearchSection'
import { Database, Wifi } from 'lucide-react'

type SortKey = 'make' | 'model' | 'year' | 'km' | 'price' | 'precioVentaEspana' | 'matriculacionTaxRate' | 'totalCost' | 'profit' | 'marginPct'

const PAGE_SIZE = 50

function getDefaultFilters(cars: Car[]): FilterState {
  const years = cars.map(c => c.year).filter(y => y > 1990 && y < 2030)
  const kms = cars.map(c => c.km).filter((k): k is number => k !== null && k > 0)

  return {
    brands: [],
    yearMin: years.length ? Math.min(...years) : 2010,
    yearMax: years.length ? Math.max(...years) : 2024,
    kmMax: kms.length ? Math.ceil(Math.max(...kms) / 50000) * 50000 : 300000,
    profitMin: 0,
    fuelTypes: [],
    taxCategories: [],
  }
}

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

    if (key === 'matriculacionTaxRate' || key === 'totalCost' || key === 'profit' || key === 'marginPct') {
      av = a.breakdown[key as keyof typeof a.breakdown] as number
      bv = b.breakdown[key as keyof typeof b.breakdown] as number
    } else if (key === 'km') {
      av = a.km ?? -1
      bv = b.km ?? -1
    } else {
      av = a[key as keyof EnrichedCar] as number | string
      bv = b[key as keyof EnrichedCar] as number | string
    }

    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }

    return dir === 'asc'
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number)
  })
}

interface Props {
  cars: Car[]
  lastUpdated: string
}

export default function DashboardClient({ cars, lastUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'csv' | 'live'>('live')
  const [costConfig, setCostConfig] = useState<CostConfig>(DEFAULT_COST_CONFIG)
  const [filters, setFilters] = useState<FilterState>(() => getDefaultFilters(cars))
  const [selectedCar, setSelectedCar] = useState<EnrichedCar | null>(null)
  const [configPanelOpen, setConfigPanelOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('profit')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  const enrichedCars = useMemo(() => enrichCars(cars, costConfig), [cars, costConfig])
  const filteredCars = useMemo(() => applyFilters(enrichedCars, filters), [enrichedCars, filters])
  const sortedCars = useMemo(() => sortCars(filteredCars, sortKey, sortDir), [filteredCars, sortKey, sortDir])
  const pagedCars = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedCars.slice(start, start + PAGE_SIZE)
  }, [sortedCars, currentPage])

  // Reset to page 1 when filters or sort change
  useEffect(() => { setCurrentPage(1) }, [filteredCars.length, sortKey, sortDir])

  function handleSort(key: SortKey, dir: 'asc' | 'desc') {
    setSortKey(key)
    setSortDir(dir)
  }

  function handleFiltersChange(f: FilterState) {
    setFilters(f)
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader
        lastUpdated={lastUpdated}
        totalCars={enrichedCars.length}
        onConfigOpen={() => setConfigPanelOpen(true)}
      />

      {/* Tab switcher */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'live'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Wifi size={14} />
          En vivo · AutoScout24
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'csv'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database size={14} />
          Histórico · CSV
        </button>
      </div>

      {/* Live tab */}
      {activeTab === 'live' && (
        <LiveSearchSection costConfig={costConfig} />
      )}

      {/* CSV tab */}
      {activeTab === 'csv' && (
        <div className="flex flex-1 overflow-hidden">
          <FiltersPanel
            filters={filters}
            onFiltersChange={handleFiltersChange}
            allCars={enrichedCars}
          />

          <main className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6 min-w-0">
            <StatsCards cars={filteredCars} />

            <OpportunityTable
              cars={pagedCars}
              total={sortedCars.length}
              page={currentPage}
              pageSize={PAGE_SIZE}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onPageChange={setCurrentPage}
              onRowClick={setSelectedCar}
            />

            <ChartsSection cars={filteredCars} />
          </main>
        </div>
      )}

      {selectedCar && (
        <CostBreakdownModal car={selectedCar} onClose={() => setSelectedCar(null)} />
      )}

      <CostConfigPanel
        open={configPanelOpen}
        config={costConfig}
        onChange={setCostConfig}
        onClose={() => setConfigPanelOpen(false)}
      />
    </div>
  )
}
