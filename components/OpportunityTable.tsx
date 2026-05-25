'use client'

import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import type { EnrichedCar } from '@/lib/types'
import { formatEur, formatNum, formatPct, getTaxCategory, profitColorClass } from '@/lib/costCalculator'
import { cn } from '@/lib/utils'

type SortKey = 'make' | 'model' | 'year' | 'km' | 'price' | 'precioVentaEspana' | 'matriculacionTaxRate' | 'totalCost' | 'profit' | 'marginPct'

interface Props {
  cars: EnrichedCar[]
  total: number
  page: number
  pageSize: number
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey, dir: 'asc' | 'desc') => void
  onPageChange: (page: number) => void
  onRowClick: (car: EnrichedCar) => void
}

const FUEL_ES: Record<string, string> = {
  diesel: 'Diésel',
  gasoline: 'Gasolina',
  electric: 'Eléctrico',
  hybrid: 'Híbrido',
  phev: 'PHEV',
  unknown: '—',
}

const TAX_BADGE: Record<string, string> = {
  '0%': 'bg-emerald-100 text-emerald-700',
  '4.75%': 'bg-amber-100 text-amber-700',
  '9.75%': 'bg-orange-100 text-orange-700',
  '14.75%': 'bg-rose-100 text-rose-700',
}

export default function OpportunityTable({ cars, total, page, pageSize, sortKey, sortDir, onSort, onPageChange, onRowClick }: Props) {
  const totalPages = Math.ceil(total / pageSize)
  const startIdx = (page - 1) * pageSize + 1
  const endIdx = Math.min(page * pageSize, total)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      onSort(key, sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      onSort(key, 'desc')
    }
  }

  function SortIcon({ colKey }: { colKey: SortKey }) {
    if (colKey !== sortKey) return <ChevronsUpDown size={13} className="text-slate-300" />
    return sortDir === 'desc'
      ? <ChevronDown size={13} className="text-indigo-600" />
      : <ChevronUp size={13} className="text-indigo-600" />
  }

  function Th({ label, colKey, align = 'right' }: { label: string; colKey: SortKey; align?: string }) {
    const isActive = colKey === sortKey
    return (
      <th
        className={cn(
          'px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none',
          `text-${align}`,
          isActive ? 'text-indigo-600' : 'text-slate-500',
          'hover:text-slate-800 transition-colors'
        )}
        onClick={() => handleSort(colKey)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <SortIcon colKey={colKey} />
        </span>
      </th>
    )
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <h2 className="font-semibold text-slate-800">
            Vehículos{' '}
            <span className="text-slate-400 font-normal text-sm">({total.toLocaleString('es-ES')})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Info size={11} />
            Haz clic en una fila para ver el desglose completo de costes
          </p>
        </div>
        <div className="text-xs text-slate-500 hidden sm:block">
          Ordenado por: <span className="text-slate-700 font-medium">{sortKey}</span>{' '}
          <span className="text-slate-400">({sortDir === 'desc' ? '↓' : '↑'})</span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <Th label="Marca" colKey="make" align="left" />
              <Th label="Modelo" colKey="model" align="left" />
              <Th label="Año" colKey="year" />
              <Th label="Km" colKey="km" />
              <Th label="Precio DE" colKey="price" />
              <Th label="Precio ES" colKey="precioVentaEspana" />
              <Th label="Imp.%" colKey="matriculacionTaxRate" align="center" />
              <Th label="Coste total" colKey="totalCost" />
              <Th label="Beneficio" colKey="profit" />
              <Th label="Margen" colKey="marginPct" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cars.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400">
                  No hay vehículos que coincidan con los filtros actuales
                </td>
              </tr>
            ) : (
              cars.map(car => {
                const b = car.breakdown
                const taxCat = getTaxCategory(b.matriculacionTaxRate)
                return (
                  <tr
                    key={car.id}
                    className="hover:bg-indigo-50 cursor-pointer transition-colors"
                    onClick={() => onRowClick(car)}
                  >
                    <td className="px-3 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {car.make.charAt(0).toUpperCase() + car.make.slice(1)}
                    </td>
                    <td className="px-3 py-3 text-slate-700 max-w-[140px] truncate">{car.model}</td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{car.year || '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                      {car.km !== null ? `${formatNum(car.km)} km` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-800 tabular-nums whitespace-nowrap">
                      {formatEur(car.price)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                      {formatEur(car.precioVentaEspana)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', TAX_BADGE[taxCat] || 'bg-slate-100 text-slate-600')}>
                        {taxCat}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 tabular-nums whitespace-nowrap">
                      {formatEur(b.totalCost)}
                    </td>
                    <td className={cn('px-3 py-3 text-right tabular-nums whitespace-nowrap', profitColorClass(b.profit))}>
                      {formatEur(b.profit)}
                    </td>
                    <td className={cn('px-3 py-3 text-right tabular-nums', profitColorClass(b.profit))}>
                      {formatPct(b.marginPct)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            Mostrando{' '}
            <span className="font-medium text-slate-700">{startIdx}–{endIdx}</span>{' '}
            de{' '}
            <span className="font-medium text-slate-700">{total.toLocaleString('es-ES')}</span>{' '}
            resultados
          </span>
          <div className="flex items-center gap-1">
            <button
              className="btn-outline p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-3 py-1.5 text-xs font-medium text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              className="btn-outline p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
