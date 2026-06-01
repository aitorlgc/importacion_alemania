'use client'

import { X, RotateCcw } from 'lucide-react'
import type { CostConfig } from '@/lib/types'
import { DEFAULT_COST_CONFIG } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  config: CostConfig
  onChange: (config: CostConfig) => void
  onClose: () => void
}

export default function CostConfigPanel({ open, config, onChange, onClose }: Props) {
  function update(field: keyof CostConfig, value: number) {
    onChange({ ...config, [field]: value })
  }

  const totalFixed =
    config.transport + config.gestoria + config.itv + config.dgt + config.insurance

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-2xl z-50',
          'transform transition-transform duration-300 ease-in-out flex flex-col',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-semibold text-slate-800">Configuración de costes</h2>
            <p className="text-xs text-slate-400 mt-0.5">Los cambios se aplican al instante</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5">
          {/* Fixed cost inputs */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Costes fijos por vehículo
            </h3>
            <div className="space-y-3">
              <ConfigField
                label="Transporte (DE → ES)"
                hint="Camión portacoches"
                value={config.transport}
                onChange={v => update('transport', v)}
                step={50}
              />
              <ConfigField
                label="Gestoría"
                hint="Gestión administrativa y trámites"
                value={config.gestoria}
                onChange={v => update('gestoria', v)}
                step={10}
              />
              <ConfigField
                label="ITV"
                hint="Inspección Técnica de Vehículos"
                value={config.itv}
                onChange={v => update('itv', v)}
                step={5}
              />
              <ConfigField
                label="Tasas DGT"
                hint="Matriculación y permisos"
                value={config.dgt}
                onChange={v => update('dgt', v)}
                step={5}
              />
              <ConfigField
                label="Seguro transporte"
                hint="Seguro durante el traslado"
                value={config.insurance}
                onChange={v => update('insurance', v)}
                step={10}
              />
            </div>
          </section>

          {/* Total summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Total costes fijos</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {totalFixed.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              + Impuesto matriculación (IEDMT) calculado por vehículo
            </p>
          </div>

          {/* IEDMT info table */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Impuesto IEDMT (automático)
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-200 px-3 py-2">
                <span className="font-semibold text-slate-500">Emisiones CO₂</span>
                <span className="font-semibold text-slate-500 text-right">Tasa</span>
              </div>
              {[
                { label: 'Eléctrico / H₂', rate: '0%', color: 'text-emerald-600' },
                { label: '0 – 120 g/km', rate: '0%', color: 'text-emerald-600' },
                { label: '121 – 160 g/km', rate: '4,75%', color: 'text-amber-600' },
                { label: '161 – 200 g/km', rate: '9,75%', color: 'text-orange-600' },
                { label: '> 200 g/km', rate: '14,75%', color: 'text-rose-600' },
              ].map(row => (
                <div key={row.label} className="grid grid-cols-2 px-3 py-2 border-b border-slate-100 last:border-0">
                  <span className="text-slate-600">{row.label}</span>
                  <span className={`font-semibold text-right ${row.color}`}>{row.rate}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Aplicado sobre la base fiscal (precio + transporte). Se calcula automáticamente
              a partir del tipo de combustible de cada vehículo.
            </p>
          </section>
        </div>

        <footer className="px-5 py-4 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={() => onChange(DEFAULT_COST_CONFIG)}
            className="btn-ghost w-full flex items-center justify-center gap-2 border border-slate-200"
          >
            <RotateCcw size={14} />
            Restablecer valores por defecto
          </button>
        </footer>
      </aside>
    </>
  )
}

function ConfigField({
  label,
  hint,
  value,
  onChange,
  step = 10,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-0.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1">{hint}</p>}
      <div className="relative">
        <input
          type="number"
          className="input-base pr-6"
          value={value}
          min={0}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">€</span>
      </div>
    </div>
  )
}
