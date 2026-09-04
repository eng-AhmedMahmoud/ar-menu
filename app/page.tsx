import Link from 'next/link'
import { menu, photoUrl } from '@/lib/menu'

export default function MenuPage() {
  return (
    <main className="page">
      <header className="masthead">
        <h1>{menu.restaurant.name}</h1>
        <p>{menu.restaurant.tagline}</p>
      </header>

      <ul className="dish-grid">
        {menu.dishes.map((dish) => (
          <li key={dish.slug}>
            <Link href={`/dish/${dish.slug}`} className="dish-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(dish)} alt={dish.name} className="dish-card-photo" />
              <div className="dish-card-body">
                <div className="dish-card-head">
                  <h2>{dish.name}</h2>
                  <span className="price">{dish.price}</span>
                </div>
                <p>{dish.description}</p>
                <span className="cta">View in AR &rarr;</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
