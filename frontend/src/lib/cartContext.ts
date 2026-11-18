import { createContext, useContext } from 'react'

export interface CartLine {
  product_id: number
  tier_id: number
  bundles: number
}

export interface CartContextValue {
  lines: CartLine[]
  /** Total bundles in the cart. */
  count: number
  add: (productId: number, tierId: number, bundles: number) => void
  setBundles: (tierId: number, bundles: number) => void
  remove: (tierId: number) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
