import { existsSync } from 'node:fs'
import path from 'node:path'
import { menu, money } from '@/lib/menu'

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

      <h2 className="sheet-head">Table tents — full menu</h2>
      <p className="note no-print">Each code opens that dish inside the menu, so a diner can browse on from it.</p>
      <div className="tent-grid">
        {menu.dishes.map((dish) => (
          <article key={dish.slug} className="tent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/qr/${dish.slug}.png`} alt={`QR code for ${dish.name}`} className="tent-qr" />
            <h2>{dish.name}</h2>
            <p className="tent-price">{money(dish.price)}</p>
            <p className="tent-cta">Scan to see it on your table</p>
          </article>
        ))}
      </div>

      <h2 className="sheet-head">Single-product codes</h2>
      <p className="note no-print">
        These open one product on its own, with no route through to the rest of the menu —
        for cup sleeves, packaging, stickers and bio links.
      </p>
      <div className="tent-grid">
        {menu.dishes.map((dish) => (
          <article key={`${dish.slug}-solo`} className="tent tent-solo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/qr/${dish.slug}-solo.png`}
              alt={`Standalone QR code for ${dish.name}`}
              className="tent-qr"
            />
            <h2>{dish.name}</h2>
            <p className="tent-price">{money(dish.price)}</p>
            <p className="tent-cta">See it life-size</p>
          </article>
        ))}
      </div>
    </main>
  )
}
