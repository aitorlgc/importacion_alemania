'use client'

import { Car, Settings } from 'lucide-react'

interface Props {
  lastUpdated: string
  totalCars: number
  onConfigOpen: () => void
}

export default function DashboardHeader({ lastUpdated, totalCars, onConfigOpen }: Props) {
  const formattedDate = new Date(lastUpdated).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="h-16 bg-white border-b border-slate-200 shadow-sm px-6 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-indigo-600">
          <Car size={22} strokeWidth={2} />
        </div>
        <span className="font-semibold text-slate-900 text-lg tracking-tight">
          AutoImport <span className="text-indigo-600">DE→ES</span>
        </span>
        <span className="text-xs bg-indigo-100 text-indigo-700 font-medium px-2 py-0.5 rounded-full">
          B2B Dashboard
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{totalCars.toLocaleString('es-ES')} vehículos cargados</span>
          <span className="text-slate-300">·</span>
          <span>Datos: {formattedDate}</span>
        </div>

        <button
          onClick={onConfigOpen}
          className="btn-ghost flex items-center gap-2"
          title="Configurar costes"
        >
          <Settings size={16} />
          <span className="hidden md:inline">Costes</span>
        </button>
      </div>
    </header>
  )
}
