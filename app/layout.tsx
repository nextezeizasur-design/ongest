// RUTA: app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ToastProvider } from '@/components/shared/Toast'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default:  'OnGest — Plataforma de Evaluaciones',
    template: '%s | OnGest',
  },
  description: 'OnGest — Plataforma de evaluaciones de inglés online',
  manifest: '/manifest.json',
  // Ícono de la pestaña del navegador (logo de OnGest)
  icons: {
    icon: [
      { url: '/favicon.ico',              sizes: 'any' },
      { url: '/icons/favicon-16.png',     sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png',     sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48.png',     sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-192.png',       sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple:    '/icons/icon-192.png',
  },
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'default',
    title:          'OnGest',
  },
}

export const viewport: Viewport = {
  themeColor: '#642f8d',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* iOS splash / icon */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
