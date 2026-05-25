'use client'

import { useEffect } from 'react'
import { X, Fuel, Gauge, Zap, AlertCircle } from 'lucide-react'
import type { EnrichedCar } from '@/lib/types'
import { formatEur, formatPct, formatNum, getTaxCategory, profitColorClass } from '@/lib/costCalculator'
import { cn } from '@/lib/utils'

const FUEL_ES: Record<string, string> = {
  diesel: 'Diésel',
  gasoline: 'Gasolina',
  electric: 'Eléctrico',
  hybrid: 'Híbrido',
  phev: 'PHEV',
  unknown: 'Desconocido',
}

interface Props {
  car: EnrichedCar
  onClose: () => void
}

export default function CostBreakdownModal({ car, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const b = car.breakdown
  const taxCategory = getTaxCategory(b.matriculacionTaxRate)

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">
              {car.make.charAt(0).toUpperCase() + car.make.slice(1)} {car.model}
            </h2>
            <p className="text-slate-400 text-sm mt-0.5">Desglose de costes de importación</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700">
            <X size={20} />
          </button>
        </div>

        {/* Car specs */}
        <div className="grid grid-cols-3 gap-px bg-slate-100 text-sm border-b border-slate-200">
          <SpecItem label="Año" value={car.year ? String(car.year) : '—'} icon={<Gauge size={13} />} />
          <SpecItem label="Km" value={car.km !== null ? `${formatNum(car.km)} km` : '—'} icon={<Gauge size={13} />} />
          <SpecItem label="Motor" value={car.hp !== null ? `${car.hp} CV` : '—'} icon={<Zap size={13} />} />
          <SpecItem label="Combustible" value={FUEL_ES[car.fuel] || '—'} icon={<Fuel size={13} />} />
          <SpecItem label="Impuesto" value={taxCategory} icon={null} />
          <SpecItem label="CO₂ base" value={`${b.co2Used} g/km`} icon={null} />
        </div>

        {/* CO2 estimated warning */}
        {b.co2Source === 'estimated' && (
          <div className="mx-5 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>
              CO₂ estimado según tipo de combustible ({FUEL_ES[car.fuel]}). El impuesto exacto puede variar
              si el vehículo tiene datos técnicos certificados.
            </span>
          </div>
        )}

        {/* Cost breakdown */}
        <div className="px-5 py-4 space-y-1.5">
          <LineItem label="Precio de compra (Alemania)" value={b.purchasePrice} />
          <LineItem label="Transporte (DE → ES)" value={b.transport} />
          <div className="pl-4 py-0.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Base fiscal (precio + transporte)</span>
              <span className="tabular-nums">{formatEur(b.fiscalBase)}</span>
            </div>
          </div>
          <LineItem
            label={`Impuesto matriculación (${(b.matriculacionTaxRate * 100).toFixed(2)}% IEDMT)`}
            value={b.matriculacionTaxAmount}
            highlight
          />
          <LineItem label="Gestoría" value={b.gestoria} />
          <LineItem label="ITV" value={b.itv} />
          <LineItem label="Tasas DGT" value={b.dgt} />
          <LineItem label="Seguro transporte" value={b.insurance} />

          <div className="border-t border-slate-200 pt-2 mt-2" />
          <LineItem label="COSTE TOTAL en España" value={b.totalCost} bold />
          <LineItem label="Precio de mercado (España)" value={b.marketPriceSpain} muted />
          <div className="border-t border-slate-200 pt-2 mt-2" />
          <LineItem label="BENEFICIO POTENCIAL" value={b.profit} profit />
        </div>

        {/* Margin highlight */}
        <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 py-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Margen sobre coste total</p>
          <p className={cn('text-4xl font-bold tabular-nums', profitColorClass(b.profit))}>
            {formatPct(b.marginPct)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {b.profit >= 0
              ? `Ganancia neta estimada: ${formatEur(b.profit)}`
              : `Pérdida estimada: ${formatEur(b.profit)}`}
          </p>
        </div>
      </div>
    </div>
  )
}

function SpecItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-xs text-slate-400 flex items-center gap-1 mb-0.5">{icon}{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

function LineItem({
  label,
  value,
  bold,
  muted,
  profit,
  highlight,
}: {
  label: string
  value: number
  bold?: boolean
  muted?: boolean
  profit?: boolean
  highlight?: boolean
}) {
  return (
    <div className={cn(
      'flex justify-between items-center py-1 text-sm',
      muted && 'text-slate-500',
      highlight && 'text-indigo-700',
    )}>
      <span className={cn(bold && 'font-semibold text-slate-800', profit && 'font-bold text-base')}>
        {label}
      </span>
      <span className={cn(
        'tabular-nums',
        bold && 'font-semibold text-slate-800',
        profit && cn('font-bold text-base', profitColorClass(value)),
      )}>
        {formatEur(value)}
      </span>
    </div>
  )
}
