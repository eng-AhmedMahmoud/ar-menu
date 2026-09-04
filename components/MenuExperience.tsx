'use client'

import { useCallback, useMemo, useState } from 'react'
import ArViewer from './ArViewer'
import { menu, money, lineTotal, photoUrl, type Dish } from '@/lib/menu'
import { useSettings } from './Settings'
import { addonLabel, dishDesc, dishName, dishTags, variantLabel } from '@/lib/i18n'

type OrderLine = {
  key: string
  slug: string
  name: string
  variantLabel?: string
  addonLabels: string[]
  unit: number
  qty: number
}

type Props = {
  initialSlug: string
  /** Computed at build time — which dishes actually have models on disk. */
  assets: Record<string, { glb: boolean; usdz: boolean }>
  /**
   * Standalone mode drops the dish rail and never rewrites the URL, so a
   * single-product link stays on that product — the whole point of giving it
   * its own address.
   */
  standalone?: boolean
}

export default function MenuExperience({ initialSlug, assets, standalone = false }: Props) {
  const { lang, s: txt } = useSettings()
  const [slug, setSlug] = useState(initialSlug)
  const [variantId, setVariantId] = useState<string | undefined>()
  const [addonIds, setAddonIds] = useState<string[]>([])
  const [order, setOrder] = useState<OrderLine[]>([])
  const [trayOpen, setTrayOpen] = useState(false)

  const dish = useMemo(
    () => menu.dishes.find((d) => d.slug === slug) ?? menu.dishes[0],
    [slug]
  )
  // Default to the variant that costs nothing extra — that is the standard
  // size the price on the card refers to. Picking by position put an 8oz
  // "small" in front of customers and quoted a discounted price.
  const activeVariantId =
    variantId ??
    dish.variants?.find((v) => v.priceDelta === 0)?.id ??
    dish.variants?.[0]?.id
  const variant = dish.variants?.find((v) => v.id === activeVariantId)
  const unit = lineTotal(dish, activeVariantId, addonIds)

  // Swapping dishes must reset the selections, otherwise a "Large" chosen on one
  // dish silently prices the next one.
  const swapTo = useCallback((next: Dish) => {
    setSlug(next.slug)
    setVariantId(undefined)
    setAddonIds([])
    if (!standalone && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/dish/${next.slug}`)
    }
  }, [standalone])

  const toggleAddon = (id: string) =>
    setAddonIds((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : [...cur, id]))

  const addToOrder = useCallback(() => {
    const addonLabels = (dish.addons ?? [])
      .filter((a) => addonIds.includes(a.id))
      .map((a) => addonLabel(a, lang))
    const key = `${dish.slug}|${activeVariantId ?? ''}|${addonIds.slice().sort().join(',')}`
    setOrder((cur) => {
      const found = cur.find((l) => l.key === key)
      if (found) return cur.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
      return [
        ...cur,
        {
          key,
          slug: dish.slug,
          name: dishName(dish, lang),
          variantLabel: variant ? variantLabel(variant, lang) : undefined,
          addonLabels,
          unit,
          qty: 1,
        },
      ]
    })
    setTrayOpen(true)
  }, [dish, addonIds, activeVariantId, variant, unit, lang])

  const setQty = (key: string, delta: number) =>
    setOrder((cur) =>
      cur
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    )

  const total = order.reduce((sum, l) => sum + l.unit * l.qty, 0)
  const count = order.reduce((sum, l) => sum + l.qty, 0)

  const sendOrder = () => {
    const lines = order.map(
      (l) =>
        `${l.qty}x ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ''}` +
        `${l.addonLabels.length ? ` + ${l.addonLabels.join(', ')}` : ''} — ${money(l.unit * l.qty)}`
    )
    const text = `${menu.restaurant.name}:\n${lines.join('\n')}\n\nTotal: ${money(total)}`
    const phone = menu.restaurant.whatsapp
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
    } else {
      // No number configured — hand the summary to the diner rather than failing.
      navigator.clipboard?.writeText(text)
      alert(`Order copied to clipboard:\n\n${text}`)
    }
  }

  const asset = assets[dish.slug] ?? { glb: false, usdz: false }

  return (
    <div className="experience">
      <ArViewer
        dish={dish}
        variant={variant}
        poster={photoUrl(dish)}
        hasModel={asset.glb}
        hasUsdz={asset.usdz}
        priceLabel={money(unit)}
        onOrder={addToOrder}
      />

      {!standalone && menu.dishes.length > 1 ? (
        <div className="rail" role="tablist" aria-label={txt.dishes}>
          {menu.dishes.map((d) => (
            <button
              key={d.slug}
              role="tab"
              aria-selected={d.slug === dish.slug}
              className={`rail-item${d.slug === dish.slug ? ' rail-item-active' : ''}`}
              onClick={() => swapTo(d)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(d)} alt="" />
              <span>{dishName(d, lang)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <section className="detail">
        <div className="detail-head">
          <h1>{dishName(dish, lang)}</h1>
          <span className="price">{money(unit)}</span>
        </div>
        <p className="desc">{dishDesc(dish, lang)}</p>

        <ul className="meta">
          {dish.prepMinutes ? <li>{dish.prepMinutes} {txt.minutes}</li> : null}
          {dish.calories ? <li>{dish.calories} {txt.kcal}</li> : null}
          {dishTags(dish, lang).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        {dish.variants?.length ? (
          <div className="group">
            <h2>{txt.size}</h2>
            <div className="chips">
              {dish.variants.map((v) => (
                <button
                  key={v.id}
                  className={`chip${v.id === activeVariantId ? ' chip-on' : ''}`}
                  onClick={() => setVariantId(v.id)}
                >
                  {variantLabel(v, lang)}
                  {v.priceDelta ? (
                    <em>
                      {v.priceDelta > 0 ? '+' : '−'}
                      {money(Math.abs(v.priceDelta))}
                    </em>
                  ) : null}
                </button>
              ))}
            </div>
            <p className="hint">{txt.scaleHint}</p>
          </div>
        ) : null}

        {dish.addons?.length ? (
          <div className="group">
            <h2>{txt.addons}</h2>
            <div className="chips">
              {dish.addons.map((a) => (
                <button
                  key={a.id}
                  className={`chip${addonIds.includes(a.id) ? ' chip-on' : ''}`}
                  onClick={() => toggleAddon(a.id)}
                >
                  {addonLabel(a, lang)}
                  <em>+{money(a.price)}</em>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button className="primary" onClick={addToOrder}>
          {txt.addToOrder} · {money(unit)}
        </button>
      </section>

      {count > 0 ? (
        <>
          <button className="tray-fab" onClick={() => setTrayOpen((o) => !o)}>
            <span className="tray-count">{count}</span>
            {money(total)}
          </button>

          {trayOpen ? (
            <div className="tray">
              <div className="tray-head">
                <h2>{txt.yourOrder}</h2>
                <button className="tray-close" onClick={() => setTrayOpen(false)}>
                  ✕
                </button>
              </div>
              <ul className="tray-lines">
                {order.map((l) => (
                  <li key={l.key}>
                    <div>
                      <strong>{l.name}</strong>
                      {l.variantLabel ? <em>{l.variantLabel}</em> : null}
                      {l.addonLabels.length ? <em>+ {l.addonLabels.join(', ')}</em> : null}
                    </div>
                    <div className="qty">
                      <button onClick={() => setQty(l.key, -1)} aria-label={txt.removeOne}>
                        −
                      </button>
                      <span>{l.qty}</span>
                      <button onClick={() => setQty(l.key, 1)} aria-label={txt.addOne}>
                        +
                      </button>
                    </div>
                    <span className="line-total">{money(l.unit * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="tray-foot">
                <span>{txt.total}</span>
                <strong>{money(total)}</strong>
              </div>
              <button className="primary" onClick={sendOrder}>
                {txt.sendOrder}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
