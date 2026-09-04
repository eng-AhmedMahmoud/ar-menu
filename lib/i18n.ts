import { menu, type Dish, type Variant, type Addon, type Hotspot } from './menu'

export type Lang = 'en' | 'ar'

/**
 * UI strings. Kept beside the menu data rather than in a translation framework
 * because the surface is small and every string here is customer-facing copy
 * the restaurant may want to reword.
 */
export const STRINGS = {
  en: {
    size: 'Size',
    addons: 'Add-ons',
    addToOrder: 'Add to order',
    yourOrder: 'Your order',
    total: 'Total',
    sendOrder: 'Send order to the kitchen',
    viewOnTable: 'View on your table',
    scaleHint: 'The model resizes to the real portion — check it in AR.',
    noModel: '3D model not generated yet',
    minutes: 'min',
    kcal: 'kcal',
    scanPlaceOrder: 'Scan · Place · Order',
    arHelp:
      'Point your camera at the dish to place it life-size on your table. Works in Safari and Chrome — nothing to install.',
    dishes: 'Dishes',
    removeOne: 'Remove one',
    addOne: 'Add one',
    close: 'Close',
    theme: 'Theme',
    language: 'Language',
  },
  ar: {
    size: 'الحجم',
    addons: 'الإضافات',
    addToOrder: 'أضف إلى الطلب',
    yourOrder: 'طلبك',
    total: 'الإجمالي',
    sendOrder: 'أرسل الطلب إلى المطبخ',
    viewOnTable: 'شاهده على طاولتك',
    scaleHint: 'يتغيّر حجم النموذج ليطابق الحصة الحقيقية — تحقّق منه بالواقع المعزز.',
    noModel: 'لم يُنشأ النموذج بعد',
    minutes: 'دقيقة',
    kcal: 'سعرة',
    scanPlaceOrder: 'امسح · ضع · اطلب',
    arHelp:
      'وجّه الكاميرا نحو الطاولة لتضع الطبق بحجمه الحقيقي أمامك. يعمل على سفاري وكروم دون تثبيت أي تطبيق.',
    dishes: 'الأصناف',
    removeOne: 'إنقاص واحد',
    addOne: 'إضافة واحد',
    close: 'إغلاق',
    theme: 'المظهر',
    language: 'اللغة',
  },
} as const

export type Strings = (typeof STRINGS)['en']

export const t = (lang: Lang): Strings => STRINGS[lang] as Strings

/* Field pickers — fall back to English whenever a translation is missing, so a
   half-translated menu degrades to readable rather than blank. */

export const dishName = (d: Dish, lang: Lang) => (lang === 'ar' && d.ar?.name) || d.name
export const dishDesc = (d: Dish, lang: Lang) => (lang === 'ar' && d.ar?.description) || d.description
export const dishTags = (d: Dish, lang: Lang) => (lang === 'ar' && d.ar?.tags) || d.tags || []
export const variantLabel = (v: Variant, lang: Lang) => (lang === 'ar' && v.labelAr) || v.label
export const addonLabel = (a: Addon, lang: Lang) => (lang === 'ar' && a.labelAr) || a.label
export const spotLabel = (h: Hotspot, lang: Lang) => (lang === 'ar' && h.labelAr) || h.label
export const spotDetail = (h: Hotspot, lang: Lang) => (lang === 'ar' && h.detailAr) || h.detail
export const brandName = (lang: Lang) =>
  (lang === 'ar' && menu.restaurant.ar?.name) || menu.restaurant.name
export const brandTagline = (lang: Lang) =>
  (lang === 'ar' && menu.restaurant.ar?.tagline) || menu.restaurant.tagline
