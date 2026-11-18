import { createContext, useContext } from 'react'

export interface CartLine {
  product_id: number
  tier_id: number
  bundles: number
}

/**
 * guest   - not signed in: the cart lives in this browser.
 * loading - signing in or restoring a session: the account's cart is being fetched (and a guest
 *           cart merged into it). Changes are blocked for this moment so none can be lost.
 * ready   - signed in: the account's cart is loaded and every change is saved to the server.
 */
export type CartStatus = 'guest' | 'loading' | 'ready'

export interface CartContextValue {
  lines: CartLine[]
  /** Total bundles in the cart. */
  count: number
  status: CartStatus
  /** A change is waiting to be saved, or being saved. */
  saving: boolean
  /** The last save failed (the cart was reloaded from the server). */
  syncError: unknown
  /** Fetching or merging the account's cart failed. */
  loadError: unknown
  add: (productId: number, tierId: number, bundles: number) => void
  setBundles: (tierId: number, bundles: number) => void
  remove: (tierId: number) => void
  clear: () => void
  /** Try again after a load or save failure. */
  retry: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
