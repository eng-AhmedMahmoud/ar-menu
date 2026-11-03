/**
 * The viewer picks Light or Dark; there is no "follow the device" option.
 * Light is the designed default: it is the base palette on :root in
 * globals.css, so it is what renders whenever nothing has been chosen.
 *
 * Kept free of imports so the unit test can load it with plain `node --test`.
 */
export const THEMES = ['light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'light'

/** Mirrors --bg for each palette, for the browser chrome (<meta name="theme-color">). */
export const THEME_COLOR: Record<Theme, string> = { light: '#faf8f5', dark: '#0d0b09' }

/* Earlier visits could store "system" from the old three-way toggle. Anything
   that is not a current choice resolves to the default, and the next pick
   overwrites it. */
export const resolveTheme = (stored: string | null): Theme =>
  (THEMES as readonly string[]).includes(stored ?? '') ? (stored as Theme) : DEFAULT_THEME
