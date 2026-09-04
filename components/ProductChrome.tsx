'use client'

import { useSettings, SettingsControls } from './Settings'
import { brandName } from '@/lib/i18n'

/**
 * Brand frame for the standalone product page. Client-side because the brand
 * name and the help text both follow the active language.
 */
export default function ProductChrome({ children }: { children: React.ReactNode }) {
  const { lang, s } = useSettings()
  return (
    <>
      <header className="product-brand">
        <span className="brand-name">{brandName(lang)}</span>
        <span className="brand-tag">{s.scanPlaceOrder}</span>
        <SettingsControls />
      </header>

      {children}

      <footer className="product-foot">
        <p>{s.arHelp}</p>
      </footer>
    </>
  )
}
