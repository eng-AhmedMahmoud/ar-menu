import type { Metadata, Viewport } from 'next'
import { menu } from '@/lib/menu'
import './globals.css'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: menu.restaurant.name,
  description: menu.restaurant.tagline,
}

export const viewport: Viewport = {
  themeColor: '#0d0b09',
  width: 'device-width',
  initialScale: 1,
  // Quick Look and Scene Viewer both overlay the page; locking zoom keeps the
  // AR button from drifting under the notch on iOS.
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
