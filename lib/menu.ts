import menuData from '@/menu.json'

export type Variant = {
  id: string
  label: string
  labelAr?: string
  /** Added to the base price when this variant is selected. */
  priceDelta: number
  /** Multiplies the model's real-world size, so a large really looks large in AR. */
  scale: number
}

export type Addon = { id: string; label: string; labelAr?: string; price: number }

export type Hotspot = {
  id: string
  /**
   * "fx fy fz" as fractions of the model's bounding box (0-1). Resolved to
   * metres at load time, so a hotspot keeps meaning when the mesh is
   * regenerated at a different size — absolute coordinates would not.
   */
  anchor?: string
  /** Absolute "x y z" in metres. Used only when `anchor` is absent. */
  position?: string
  normal: string
  label: string
  detail: string
  labelAr?: string
  detailAr?: string
}

export type Dish = {
  slug: string
  name: string
  description: string
  price: number
  image: string
  tags?: string[]
  calories?: number
  prepMinutes?: number
  variants?: Variant[]
  addons?: Addon[]
  hotspots?: Hotspot[]
  ar?: { name: string; description: string; tags?: string[] }
}

export type Menu = {
  restaurant: {
    name: string
    tagline: string
    currency: string
    /** Digits only, country code first. Empty disables the order handoff. */
    whatsapp?: string
    ar?: { name: string; tagline: string }
  }
  dishes: Dish[]
}

export const menu = menuData as Menu

export function getDish(slug: string): Dish | undefined {
  return menu.dishes.find((d) => d.slug === slug)
}

export function photoUrl(dish: Dish): string {
  return `/photos/${dish.image}`
}

export function money(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return `${menu.restaurant.currency}${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`
}

/** Base + selected variant + selected add-ons, for one line of the order. */
export function lineTotal(dish: Dish, variantId?: string, addonIds: string[] = []): number {
  const variant = dish.variants?.find((v) => v.id === variantId)
  const addons = (dish.addons ?? []).filter((a) => addonIds.includes(a.id))
  return dish.price + (variant?.priceDelta ?? 0) + addons.reduce((sum, a) => sum + a.price, 0)
}
