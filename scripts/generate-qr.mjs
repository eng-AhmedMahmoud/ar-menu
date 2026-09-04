#!/usr/bin/env node
/**
 * Generates one QR per dish pointing at <SITE_URL>/dish/<slug>, plus a menu-wide
 * QR pointing at the index. Writes print-resolution PNG and vector SVG into
 * public/qr/ so the /print page and any print shop can both use them.
 *
 *   SITE_URL=https://menu.example.com node scripts/generate-qr.mjs
 *
 * Error correction is set to Q (25% recoverable) because table tents get sauce
 * on them and phone cameras read them at an angle.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const QR_DIR = path.join(ROOT, 'public', 'qr')

const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

const OPTS = {
  errorCorrectionLevel: 'Q',
  margin: 2,
  color: { dark: '#111111ff', light: '#ffffffff' },
}

async function emit(name, url) {
  await QRCode.toFile(path.join(QR_DIR, `${name}.png`), url, { ...OPTS, width: 1200 })
  await writeFile(path.join(QR_DIR, `${name}.svg`), await QRCode.toString(url, { ...OPTS, type: 'svg' }))
  console.log(`  ${name.padEnd(24)} -> ${url}`)
}

async function main() {
  if (!SITE_URL) {
    console.error(
      'Missing SITE_URL.\n\n' +
        '  SITE_URL=https://your-menu.vercel.app pnpm qr\n\n' +
        'Run this AFTER the first deploy — the QR encodes the live URL, so a\n' +
        'placeholder here means reprinting every table tent later.\n'
    )
    process.exit(1)
  }
  if (!/^https:\/\//.test(SITE_URL)) {
    console.error(`SITE_URL must be https (AR and camera access require it). Got: ${SITE_URL}`)
    process.exit(1)
  }

  const menu = JSON.parse(await readFile(path.join(ROOT, 'menu.json'), 'utf8'))
  await mkdir(QR_DIR, { recursive: true })

  console.log(`\nQR targets on ${SITE_URL}\n`)
  await emit('menu', SITE_URL)
  for (const dish of menu.dishes) {
    await emit(dish.slug, `${SITE_URL}/dish/${dish.slug}`)
    // Standalone product code: opens that product on its own, with no way
    // through to the rest of the menu. For packaging, stickers and bio links.
    await emit(`${dish.slug}-solo`, `${SITE_URL}/p/${dish.slug}`)
  }

  await writeFile(
    path.join(QR_DIR, 'manifest.json'),
    JSON.stringify({ siteUrl: SITE_URL, generatedFor: menu.dishes.map((d) => d.slug) }, null, 2) + '\n'
  )

  console.log(`\n${menu.dishes.length * 2 + 1} QR codes in public/qr/`)
  console.log(`Printable table tents: ${SITE_URL}/print\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
