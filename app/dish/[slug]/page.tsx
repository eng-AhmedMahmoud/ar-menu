import Link from 'next/link'
import { notFound } from 'next/navigation'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import ArViewer from '@/components/ArViewer'
import { menu, getDish, photoUrl } from '@/lib/menu'

export function generateStaticParams() {
  return menu.dishes.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const dish = getDish((await params).slug)
  if (!dish) return {}
  return {
    title: `${dish.name} — ${menu.restaurant.name}`,
    description: dish.description,
    openGraph: { title: dish.name, description: dish.description, images: [photoUrl(dish)] },
  }
}

export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const dish = getDish(slug)
  if (!dish) notFound()

  // Checked at build time: Tripo (and a failed Meshy usdz download) leaves the
  // glb without its iOS counterpart, and a missing ios-src is better than a 404
  // inside Quick Look.
  const hasUsdz = existsSync(path.join(process.cwd(), 'public', 'models', `${slug}.usdz`))
  const hasModel = existsSync(path.join(process.cwd(), 'public', 'models', `${slug}.glb`))

  return (
    <main className="page dish-page">
      <Link href="/" className="back">
        &larr; {menu.restaurant.name}
      </Link>

      {hasModel ? (
        <ArViewer slug={dish.slug} name={dish.name} poster={photoUrl(dish)} hasUsdz={hasUsdz} />
      ) : (
        <div className="viewer viewer-empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(dish)} alt={dish.name} className="viewer-poster" />
          <p className="note">3D model not generated yet — run <code>pnpm models</code>.</p>
        </div>
      )}

      <section className="dish-detail">
        <div className="dish-card-head">
          <h1>{dish.name}</h1>
          <span className="price">{dish.price}</span>
        </div>
        <p className="desc">{dish.description}</p>
        {dish.tags?.length ? (
          <ul className="tags">
            {dish.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
        <p className="hint">
          Drag to spin. Tap <strong>View on your table</strong> to place it life-size in the room.
        </p>
      </section>
    </main>
  )
}
