'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, Cell,
} from 'recharts'
import type { EnrichedCar } from '@/lib/types'
import { formatEur } from '@/lib/costCalculator'

interface Props {
  cars: EnrichedCar[]
}

const MARGIN_BUCKETS = [
  { label: '< 0%',   min: -Infinity, max: 0 },
  { label: '0–5%',   min: 0,         max: 5 },
  { label: '5–10%',  min: 5,         max: 10 },
  { label: '10–15%', min: 10,        max: 15 },
  { label: '15–20%', min: 15,        max: 20 },
  { label: '20–25%', min: 20,        max: 25 },
  { label: '> 25%',  min: 25,        max: Infinity },
]

const BUCKET_COLORS = ['#f43f5e', '#f97316', '#fbbf24', '#a3e635', '#34d399', '#10b981', '#059669']

const EUR_FORMATTER = (v: number) => `${(v / 1000).toFixed(0)}k€`

function CustomTooltipEur({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="text-indigo-600 font-semibold">{formatEur(payload[0].value)}</p>
    </div>
  )
}

function CustomTooltipCount({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="text-indigo-600 font-semibold">{payload[0].value} vehículos</p>
    </div>
  )
}

export default function ChartsSection({ cars }: Props) {
  const brandData = useMemo(() => {
    const map = new Map<string, number[]>()
    cars.forEach(c => {
      const key = c.make.charAt(0).toUpperCase() + c.make.slice(1)
      const arr = map.get(key) ?? []
      arr.push(c.breakdown.profit)
      map.set(key, arr)
    })
    return [...map.entries()]
      .map(([make, profits]) => ({
        make,
        avgProfit: Math.round(profits.reduce((a, b) => a + b, 0) / profits.length),
        count: profits.length,
      }))
      .filter(d => d.count >= 2)
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 10)
  }, [cars])

  const marginData = useMemo(() => {
    return MARGIN_BUCKETS.map((bucket, i) => ({
      label: bucket.label,
      count: cars.filter(c => c.breakdown.marginPct >= bucket.min && c.breakdown.marginPct < bucket.max).length,
      color: BUCKET_COLORS[i],
    })).filter(b => b.count > 0)
  }, [cars])

  const scatterData = useMemo(() => {
    const sample = cars.length > 500
      ? cars.slice().sort(() => Math.random() - 0.5).slice(0, 500)
      : cars
    return sample.map(c => ({
      x: c.price,
      y: c.breakdown.profit,
      profit: c.breakdown.profit,
    }))
  }, [cars])

  if (cars.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Bar chart — top brands */}
        <div className="section-card xl:col-span-3">
          <div className="section-header">
            <h3 className="font-semibold text-slate-800 text-sm">Top 10 marcas por beneficio medio</h3>
            <span className="text-xs text-slate-400">mín. 2 vehículos</span>
          </div>
          <div className="p-4 min-h-[280px]">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={brandData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <YAxis dataKey="make" type="category" width={72} tick={{ fontSize: 12, fill: '#64748b' }} />
                <XAxis type="number" tickFormatter={EUR_FORMATTER} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltipEur />} />
                <Bar dataKey="avgProfit" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Margin histogram */}
        <div className="section-card xl:col-span-2">
          <div className="section-header">
            <h3 className="font-semibold text-slate-800 text-sm">Distribución de márgenes</h3>
          </div>
          <div className="p-4 min-h-[280px]">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={marginData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltipCount />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {marginData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Scatter: price vs profit */}
      <div className="section-card">
        <div className="section-header">
          <h3 className="font-semibold text-slate-800 text-sm">Precio en Alemania vs. Beneficio potencial</h3>
          {cars.length > 500 && (
            <span className="text-xs text-slate-400">Muestra de 500 vehículos</span>
          )}
        </div>
        <div className="p-4 min-h-[240px]">
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="x"
                name="Precio DE"
                tickFormatter={EUR_FORMATTER}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                label={{ value: 'Precio compra (DE)', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                dataKey="y"
                name="Beneficio"
                tickFormatter={EUR_FORMATTER}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                      <p>Precio DE: <span className="font-semibold">{formatEur(d.x)}</span></p>
                      <p>Beneficio: <span className="font-semibold">{formatEur(d.y)}</span></p>
                    </div>
                  )
                }}
              />
              <Scatter data={scatterData} fill="#4f46e5" opacity={0.5} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
