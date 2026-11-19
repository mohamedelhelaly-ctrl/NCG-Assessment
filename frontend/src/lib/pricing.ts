// Bundle arithmetic shared by the listing, the product page and (later) the cart.
// All amounts are integer fils. The server stays the source of truth for the real totals.

import type { StoreProduct, Tier } from './types'

export const MAX_BUNDLES = 99

export interface PricedTier {
  id: number
  units: number
  price_fils: number
}

/** bundles x bundle price. The bundle price is the TOTAL for the bundle, never per pack. */
export function lineTotal(tier: PricedTier, bundles: number): number {
  return bundles * tier.price_fils
}

/** bundles x packs per bundle: "2 x 4-pack offer" is 8 packs. */
export function packCount(tier: PricedTier, bundles: number): number {
  return bundles * tier.units
}

/** Price of one pack inside a bundle, rounded to the nearest fil (the smallest chargeable amount). */
export function perPack(tier: PricedTier): number {
  return Math.round(tier.price_fils / tier.units)
}

/** The tier with the lowest price per pack, or null when there is only one tier to compare. */
export function bestValueId(tiers: PricedTier[]): number | null {
  if (tiers.length < 2) return null
  let best = tiers[0]
  for (const tier of tiers) {
    if (tier.price_fils * best.units < best.price_fils * tier.units) best = tier // cross-multiplied: no rounding
  }
  // Only call it "best value" when it really is cheaper per pack than the others.
  const cheaperThanSomeone = tiers.some(
    (t) => t.id !== best.id && best.price_fils * t.units < t.price_fils * best.units,
  )
  return cheaperThanSomeone ? best.id : null
}

/** How much cheaper per pack than the single-pack tier, as a whole percent. 0 if there is none to compare. */
export function savingsPercent(tier: PricedTier, tiers: PricedTier[]): number {
  const single = tiers.find((t) => t.units === 1)
  if (!single || tier.units === 1) return 0
  const saved = 1 - tier.price_fils / tier.units / single.price_fils
  return Math.max(0, Math.round(saved * 100))
}

/** Parse text from the bundle-count box: a whole number from 1 to 99, else null. */
export function parseBundles(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null
  const value = Number(text)
  return value >= 1 && value <= MAX_BUNDLES ? value : null
}

interface TopBundle {
  product: StoreProduct
  tier: Tier
  saving: number
}

/** The three products whose best bundle saves the most per pack against buying one pack. */
export function topBundles(products: StoreProduct[], count = 3): TopBundle[] {
  return products
    .map((product) => {
      const tier = product.tiers.find((x) => x.id === bestValueId(product.tiers))
      return tier ? { product, tier, saving: savingsPercent(tier, product.tiers) } : null
    })
    .filter((x): x is TopBundle => x !== null && x.saving > 0)
    .sort((a, b) => b.saving - a.saving || a.product.id - b.product.id)
    .slice(0, count)
}
