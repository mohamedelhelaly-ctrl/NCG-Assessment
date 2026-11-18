import { useApi } from './useApi'
import { api } from '../lib/api'
import type { CartLine } from '../lib/cartContext'
import type { Quote } from '../lib/types'

const EMPTY: Quote = {
  lines: [],
  totals: { line_count: 0, bundle_count: 0, pack_count: 0, total_fils: 0 },
  problems: [],
}

/**
 * The server's price for the cart's lines. Prices are never kept on the device, so they are always
 * current. It refetches when the lines or the language change; the previous quote stays on screen
 * meanwhile. An empty cart needs no request.
 */
export function useQuote(lines: CartLine[], enabled: boolean) {
  const key = `quote:${enabled}:${JSON.stringify(lines)}`
  return useApi<Quote>(key, async () => {
    if (!enabled || lines.length === 0) return EMPTY
    return api.post<Quote>('/api/v1/cart/quote', { lines })
  })
}
