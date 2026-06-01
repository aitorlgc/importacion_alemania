'use client'

import { useMemo } from 'react'
import { TrendingUp, Euro, BarChart3, Car } from 'lucide-react'
import type { EnrichedCar } from '@/lib/types'
import { formatEur, formatPct } from '@/lib/costCalculator'

interface Props {
  cars: EnrichedCar[]
}

export default function StatsCards({ cars }: Props) {
  const stats = useMemo(() => {
    if (cars.length === 0) return null

    const profits = cars.map(c => c.breakdown.profit)
    const margins = cars.map(c => c.breakdown.marginPct)
    const opportunities = cars.filter(c => c.breakdown.profit > 0)

    const bestProfit = Math.max(...profits)
    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length
    const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length

    return { bestProfit, avgProfit, avgMargin, opportunitiesCount: opportunities.length, total: cars.length }
  }, [cars])

  if (!stats) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
            <div className="h-8 bg-slate-100 rounded w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: 'Oportunidades',
      value: stats.opportunitiesCount.toLocaleString('es-ES'),
      sub: `de ${stats.total.toLocaleString('es-ES')} vehículos`,
      icon: <Car size={20} />,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Mejor beneficio',
      value: formatEur(stats.bestProfit),
      sub: 'vehículo individual',
      icon: <TrendingUp size={20} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Beneficio medio',
      value: formatEur(stats.avgProfit),
      sub: 'por vehículo filtrado',
      icon: <Euro size={20} />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Margen medio',
      value: formatPct(stats.avgMargin),
      sub: 'sobre coste total',
      icon: <BarChart3 size={20} />,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="stat-card flex flex-col gap-3">
          <div className={`${card.bg} ${card.color} w-9 h-9 rounded-lg flex items-center justify-center`}>
            {card.icon}
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{card.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{card.label}</p>
            {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
