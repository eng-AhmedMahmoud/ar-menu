'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { t, type Lang, type Strings } from '@/lib/i18n'
import { DEFAULT_THEME, THEMES, THEME_COLOR, resolveTheme, type Theme } from '@/lib/theme'

type Ctx = { lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void; s: Strings }

const SettingsCtx = createContext<Ctx | null>(null)

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx)
  if (!ctx) throw new Error('useSettings must be used inside <Settings>')
  return ctx
}

export function Settings({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  // Read the stored choice after mount rather than during render: the markup is
  // prerendered, so touching localStorage earlier would mismatch on hydration.
  useEffect(() => {
    const l = localStorage.getItem('lang')
    if (l === 'ar' || l === 'en') setLangState(l)
    setThemeState(resolveTheme(localStorage.getItem('theme')))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  }, [theme])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }, [])

  const setTheme = useCallback((th: Theme) => {
    setThemeState(th)
    localStorage.setItem('theme', th)
  }, [])

  return (
    <SettingsCtx.Provider value={{ lang, setLang, theme, setTheme, s: t(lang) }}>
      {children}
    </SettingsCtx.Provider>
  )
}

const THEME_ICON: Record<Theme, string> = { light: '☀', dark: '☾' }

export function SettingsControls() {
  const { lang, setLang, theme, setTheme, s } = useSettings()
  return (
    <div className="controls">
      <div className="seg" role="group" aria-label={s.language}>
        <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
          EN
        </button>
        <button aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>
          ع
        </button>
      </div>
      <div className="seg" role="group" aria-label={s.theme}>
        {THEMES.map((th) => (
          <button
            key={th}
            aria-pressed={theme === th}
            onClick={() => setTheme(th)}
            title={s.themeNames[th]}
            aria-label={s.themeNames[th]}
          >
            {THEME_ICON[th]}
          </button>
        ))}
      </div>
    </div>
  )
}
