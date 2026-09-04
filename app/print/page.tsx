import { existsSync } from 'node:fs'
import path from 'node:path'
import { menu, photoUrl } from '@/lib/menu'

export const metadata = { title: `Table tents — ${menu.restaurant.name}`, robots: { index: false } }

export default function PrintPage() {
  const qrDir = path.join(process.cwd(), 'public', 'qr')
  const missing = menu.dishes.filter((d) => !existsSync(path.join(qrDir, `${d.slug}.png`)))

  return (
    <main className="print-sheet">
      {missing.length ? (
        <p className="note no-print">
          Missing QR for: {missing.map((d) => d.slug).join(', ')} — run{' '}
          <code>SITE_URL=https://… pnpm qr</code>
        </p>
      ) : null}

      <p className="note no-print">
        Press ⌘P. Print at 100% scale on card stock, then fold along the centre line.
      </p>

      <div className="tent-grid">
        {menu.dishes.map((dish) => (
          <article key={dish.slug} className="tent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/qr/${dish.slug}.png`} alt={`QR code for ${dish.name}`} className="tent-qr" />
            <h2>{dish.name}</h2>
            <p className="tent-price">{dish.price}</p>
            <p className="tent-cta">Scan to see it on your table</p>
          </article>
        ))}
      </div>
    </main>
  )
}
