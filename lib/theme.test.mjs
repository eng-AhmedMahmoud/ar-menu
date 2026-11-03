import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_THEME, THEMES, resolveTheme } from './theme.ts'

test('the switcher offers exactly Light and Dark', () => {
  assert.deepEqual([...THEMES], ['light', 'dark'])
  // The control renders one button per entry in THEMES and nothing else.
  const src = readFileSync(new URL('../components/Settings.tsx', import.meta.url), 'utf8')
  assert.match(src, /THEMES\.map\(/)
  assert.doesNotMatch(src, /system/i)
})

test('light is the default', () => {
  assert.equal(DEFAULT_THEME, 'light')
  assert.equal(resolveTheme(null), 'light')
})

test('a stored "system" from the old toggle resolves to the default', () => {
  assert.equal(resolveTheme('system'), 'light')
  assert.equal(resolveTheme('auto'), 'light')
  assert.equal(resolveTheme(''), 'light')
})

test('a stored choice is kept', () => {
  assert.equal(resolveTheme('light'), 'light')
  assert.equal(resolveTheme('dark'), 'dark')
})

test('the stylesheet no longer follows the OS colour scheme', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /prefers-color-scheme/)
})
