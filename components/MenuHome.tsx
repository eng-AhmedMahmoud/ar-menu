'use client'

import Link from 'next/link'
import { menu, money, photoUrl } from '@/lib/menu'
import { brandName, brandTagline, dishDesc, dishName } from '@/lib/i18n'
import { useSettings, SettingsControls } from './Settings'

export default function MenuHome() {
  const { lang, s } = useSettings()
  return (
    <main className="page">
      <header className="masthead">
        <div className="topbar">
          <h1>{brandName(lang)}</h1>
          <SettingsControls />
        </div>
        <p>{brandTagline(lang)}</p>
      </header>

      <ul className="dish-grid">
        {menu.dishes.map((dish) => (
          <li key={dish.slug}>
            <Link href={`/dish/${dish.slug}`} className="dish-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(dish)} alt={dishName(dish, lang)} className="dish-card-photo" />
              <div className="dish-card-body">
                <div className="dish-card-head">
                  <h2>{dishName(dish, lang)}</h2>
                  <span className="price">{money(dish.price)}</span>
                </div>
                <p>{dishDesc(dish, lang)}</p>
                <span className="cta">{s.viewOnTable} &rarr;</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
