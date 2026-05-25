import { statSync } from 'fs'
import path from 'path'
import { loadAnalysis } from '@/lib/loadAnalysis'
import DashboardClient from '@/components/DashboardClient'

export default function Home() {
  const cars = loadAnalysis()

  const csvPath = path.join(process.cwd(), 'data', 'analisis_arbitraje_coches_final.csv')
  const lastUpdated = statSync(csvPath).mtime.toISOString()

  return <DashboardClient cars={cars} lastUpdated={lastUpdated} />
}
