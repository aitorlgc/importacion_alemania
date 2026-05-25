'use client'

import { useMemo } from 'react'
import { SlidersHorizontal, RotateCcw } from 'lucide-react'
import type { EnrichedCar, FilterState, FuelType, TaxCategory } from '@/lib/types'

const FUEL_LABELS: Record<FuelType, string> = {
  diesel: 'Diésel',
  gasoline: 'Gasolina',
  electric: 'Eléctrico',
  hybrid: 'Híbrido',
  phev: 'PHEV',
  unknown: 'Desconocido',
}

const TAX_LABELS: TaxCategory[] = ['0%', '4.75%', '9.75%', '14.75%']

interface Props {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  allCars: EnrichedCar[]
}

export default function FiltersPanel({ filters, onFiltersChange, allCars }: Props) {
  const { brands, fuels, yearMin, yearMax, kmMax } = useMemo(() => {
    const brandSet = new Set<string>()
    const fuelSet = new Set<FuelType>()
    let yMin = Infinity, yMax = -Infinity, kMax = -Infinity

    allCars.forEach(c => {
      if (c.make) brandSet.add(c.make)
      fuelSet.add(c.fuel)
      if (c.year > 1990 && c.year < 2030) {
        yMin = Math.min(yMin, c.year)
        yMax = Math.max(yMax, c.year)
      }
      if (c.km !== null && c.km > 0) kMax = Math.max(kMax, c.km)
    })

    return {
      brands: Array.from(brandSet).sort(),
      fuels: Array.from(fuelSet).filter(f => f !== 'unknown'),
      yearMin: yMin === Infinity ? 2010 : yMin,
      yearMax: yMax === -Infinity ? 2024 : yMax,
      kmMax: kMax === -Infinity ? 300000 : Math.ceil(kMax / 50000) * 50000,
    }
  }, [allCars])

  function reset() {
    onFiltersChange({
      brands: [],
      yearMin,
      yearMax,
      kmMax: kmMax,
      profitMin: 0,
      fuelTypes: [],
      taxCategories: [],
    })
  }

  function toggleBrand(brand: string) {
    const next = filters.brands.includes(brand)
      ? filters.brands.filter(b => b !== brand)
      : [...filters.brands, brand]
    onFiltersChange({ ...filters, brands: next })
  }

  function toggleFuel(fuel: FuelType) {
    const next = filters.fuelTypes.includes(fuel)
      ? filters.fuelTypes.filter(f => f !== fuel)
      : [...filters.fuelTypes, fuel]
    onFiltersChange({ ...filters, fuelTypes: next })
  }

  function toggleTax(cat: TaxCategory) {
    const next = filters.taxCategories.includes(cat)
      ? filters.taxCategories.filter(c => c !== cat)
      : [...filters.taxCategories, cat]
    onFiltersChange({ ...filters, taxCategories: next })
  }

  const hasActive =
    filters.brands.length > 0 ||
    filters.fuelTypes.length > 0 ||
    filters.taxCategories.length > 0 ||
    filters.profitMin > 0 ||
    filters.yearMin > yearMin ||
    filters.yearMax < yearMax ||
    filters.kmMax < kmMax

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white overflow-y-auto scrollbar-thin">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <SlidersHorizontal size={15} className="text-indigo-600" />
            <span>Filtros</span>
            {hasActive && (
              <span className="text-xs bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                !
              </span>
            )}
          </div>
          <button onClick={reset} className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
            <RotateCcw size={11} />
            Reset
          </button>
        </div>

        {/* Beneficio mínimo */}
        <FilterSection title="Beneficio mínimo">
          <div className="relative">
            <input
              type="number"
              className="input-base pr-6"
              value={filters.profitMin}
              min={0}
              step={500}
              onChange={e => onFiltersChange({ ...filters, profitMin: Number(e.target.value) })}
              placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
          </div>
        </FilterSection>

        {/* Año */}
        <FilterSection title="Año">
          <div className="flex gap-2 items-center">
            <input
              type="number"
              className="input-base text-center"
              value={filters.yearMin}
              min={yearMin}
              max={filters.yearMax}
              onChange={e => onFiltersChange({ ...filters, yearMin: Number(e.target.value) })}
            />
            <span className="text-slate-400 text-xs shrink-0">—</span>
            <input
              type="number"
              className="input-base text-center"
              value={filters.yearMax}
              min={filters.yearMin}
              max={yearMax}
              onChange={e => onFiltersChange({ ...filters, yearMax: Number(e.target.value) })}
            />
          </div>
        </FilterSection>

        {/* Km máximos */}
        <FilterSection title="Km máximos">
          <div className="relative">
            <input
              type="number"
              className="input-base pr-10"
              value={filters.kmMax}
              min={0}
              step={10000}
              onChange={e => onFiltersChange({ ...filters, kmMax: Number(e.target.value) })}
              placeholder="Sin límite"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">km</span>
          </div>
        </FilterSection>

        {/* Combustible */}
        {fuels.length > 0 && (
          <FilterSection title="Combustible">
            <div className="space-y-1.5">
              {fuels.map(fuel => (
                <CheckboxItem
                  key={fuel}
                  label={FUEL_LABELS[fuel]}
                  checked={filters.fuelTypes.includes(fuel)}
                  onChange={() => toggleFuel(fuel)}
                />
              ))}
            </div>
          </FilterSection>
        )}

        {/* Impuesto matriculación */}
        <FilterSection title="Impuesto matric.">
          <div className="space-y-1.5">
            {TAX_LABELS.map(cat => (
              <CheckboxItem
                key={cat}
                label={cat}
                checked={filters.taxCategories.includes(cat)}
                onChange={() => toggleTax(cat)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Marca */}
        <FilterSection title={`Marca (${brands.length})`}>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin pr-1">
            {brands.map(brand => (
              <CheckboxItem
                key={brand}
                label={brand.charAt(0).toUpperCase() + brand.slice(1)}
                checked={filters.brands.includes(brand)}
                onChange={() => toggleBrand(brand)}
              />
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
      />
      <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
    </label>
  )
}
