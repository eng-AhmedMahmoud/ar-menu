import Link from 'next/link'
import { notFound } from 'next/navigation'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import MenuExperience from '@/components/MenuExperience'
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

/**
 * Which dishes have models is a filesystem fact, and the experience is a client
 * component, so resolve it once at build time and pass it down.
 */
function assetMap() {
  const dir = path.join(process.cwd(), 'public', 'models')
  return Object.fromEntries(
    menu.dishes.map((d) => [
      d.slug,
      {
        glb: existsSync(path.join(dir, `${d.slug}.glb`)),
        usdz: existsSync(path.join(dir, `${d.slug}.usdz`)),
      },
    ])
  )
}

export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!getDish(slug)) notFound()

  return (
    <main className="page dish-page">
      <Link href="/" className="back">
        &larr; {menu.restaurant.name}
      </Link>
      <MenuExperience initialSlug={slug} assets={assetMap()} />
    </main>
  )
}
