import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoImport DE→ES | Dashboard de Arbitraje',
  description: 'Herramienta profesional para concesionarios: descubre oportunidades de importación de vehículos Alemania → España con cálculo exacto de matriculación y costes de gestión.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full">
        {children}
      </body>
    </html>
  )
}
