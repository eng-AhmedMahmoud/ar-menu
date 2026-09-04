'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { t, type Lang, type Strings } from '@/lib/i18n'

type Theme = 'system' | 'light' | 'dark'

type Ctx = { lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void; s: Strings }

const SettingsCtx = createContext<Ctx | null>(null)

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx)
  if (!ctx) throw new Error('useSettings must be used inside <Settings>')
  return ctx
}

export function Settings({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [theme, setThemeState] = useState<Theme>('system')

  // Read the stored choice after mount rather than during render: the markup is
  // prerendered, so touching localStorage earlier would mismatch on hydration.
  useEffect(() => {
    const l = localStorage.getItem('lang')
    const th = localStorage.getItem('theme')
    if (l === 'ar' || l === 'en') setLangState(l)
    if (th === 'light' || th === 'dark' || th === 'system') setThemeState(th)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  useEffect(() => {
    const root = document.documentElement
    // "system" must remove the attribute entirely, not set a value — the CSS
    // relies on an unstamped root to fall through to prefers-color-scheme.
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
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
        <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')} title="Light">
          ☀
        </button>
        <button aria-pressed={theme === 'system'} onClick={() => setTheme('system')} title="System">
          ◐
        </button>
        <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} title="Dark">
          ☾
        </button>
      </div>
    </div>
  )
}
