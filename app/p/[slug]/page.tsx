import { notFound } from 'next/navigation'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import MenuExperience from '@/components/MenuExperience'
import { SettingsControls } from '@/components/Settings'
import ProductChrome from '@/components/ProductChrome'
import { menu, getDish, photoUrl, money } from '@/lib/menu'

/**
 * Standalone product page.
 *
 * Same experience as a menu entry, minus the rail and the way back to the rest
 * of the menu — so a code printed on a cup, a sticker or an Instagram bio opens
 * that one product and nothing else.
 */

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
  const title = `${dish.name} — ${menu.restaurant.name}`
  return {
    title,
    description: dish.description,
    openGraph: {
      title: dish.name,
      description: dish.description,
      images: [photoUrl(dish)],
      type: 'website',
    },
  }
}

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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const dish = getDish(slug)
  if (!dish) notFound()

  return (
    <main className="page product-page">
      <ProductChrome>
        <MenuExperience initialSlug={slug} assets={assetMap()} standalone />
      </ProductChrome>
    </main>
  )
}
