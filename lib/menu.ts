import menuData from '@/menu.json'

export type Dish = {
  slug: string
  name: string
  description: string
  price: string
  image: string
  tags?: string[]
}

export type Menu = {
  restaurant: { name: string; tagline: string }
  dishes: Dish[]
}

export const menu = menuData as Menu

export function getDish(slug: string): Dish | undefined {
  return menu.dishes.find((d) => d.slug === slug)
}

/** Public path to the photo the 3D model was generated from. */
export function photoUrl(dish: Dish): string {
  return `/photos/${dish.image}`
}
