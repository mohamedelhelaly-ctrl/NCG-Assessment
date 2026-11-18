import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CartContext } from './cartContext'
import type { CartLine } from './cartContext'
import { MAX_BUNDLES } from './pricing'

const STORAGE_KEY = 'cart:v1'

function isLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Number.isInteger(v.product_id) &&
    Number.isInteger(v.tier_id) &&
    Number.isInteger(v.bundles) &&
    (v.bundles as number) >= 1 &&
    (v.bundles as number) <= MAX_BUNDLES
  )
}

// Storage can be empty, blocked or corrupted; the cart must still work (and start empty).
function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const lines = (parsed as { lines?: unknown })?.lines
    if (!Array.isArray(lines)) return []
    // One line per tier: keep the first of any duplicates.
    const seen = new Set<number>()
    return lines.filter(isLine).filter((l) => !seen.has(l.tier_id) && seen.add(l.tier_id))
  } catch {
    return []
  }
}

function write(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner: null, lines }))
  } catch {
    // ignore: the cart still works for this visit
  }
}

/** A guest cart in the browser. Lines hold choices only (ids and a bundle count), never prices. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(read)

  // Keep several tabs in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const commit = useCallback((next: CartLine[]) => {
    write(next)
    setLines(next)
  }, [])

  const value = useMemo(
    () => ({
      lines,
      // Bundles in total, so adding a second bundle of the same offer is visible in the count.
      count: lines.reduce((sum, l) => sum + l.bundles, 0),
      /** Adds bundles to a line. The same offer of the same product joins its line (capped at 99);
       * a different offer becomes its own line. */
      add: (productId: number, tierId: number, bundles: number) => {
        const amount = Math.min(MAX_BUNDLES, Math.max(1, Math.trunc(bundles)))
        const existing = lines.find((l) => l.tier_id === tierId)
        commit(
          existing
            ? lines.map((l) =>
                l === existing ? { ...l, bundles: Math.min(MAX_BUNDLES, l.bundles + amount) } : l,
              )
            : [...lines, { product_id: productId, tier_id: tierId, bundles: amount }],
        )
      },
      setBundles: (tierId: number, bundles: number) => {
        if (!Number.isInteger(bundles) || bundles < 1 || bundles > MAX_BUNDLES) return
        commit(lines.map((l) => (l.tier_id === tierId ? { ...l, bundles } : l)))
      },
      remove: (tierId: number) => commit(lines.filter((l) => l.tier_id !== tierId)),
      clear: () => commit([]),
    }),
    [lines, commit],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
