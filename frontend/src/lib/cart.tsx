import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './authContext'
import { CartContext } from './cartContext'
import type { CartLine, CartStatus } from './cartContext'
import { MAX_BUNDLES } from './pricing'

const STORAGE_KEY = 'cart:v1'
const SAVE_DELAY_MS = 400
const SERVER_CART = '/api/v1/me/cart'

interface ServerCart {
  lines: CartLine[]
}

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
function readLocal(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const lines = (JSON.parse(raw) as { lines?: unknown })?.lines
    if (!Array.isArray(lines)) return []
    const seen = new Set<number>() // one line per offer: keep the first of any duplicates
    return lines.filter(isLine).filter((l) => !seen.has(l.tier_id) && seen.add(l.tier_id))
  } catch {
    return []
  }
}

function writeLocal(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner: null, lines }))
  } catch {
    // ignore: the cart still works for this visit
  }
}

/**
 * The cart, in two modes.
 *  - Guest: lines live in localStorage. Only choices are stored (ids and a bundle count), never prices.
 *  - Signed in: the account's cart on the server is the source of truth. On sign-in the account's
 *    cart is fetched first; a guest cart is merged into it in one request and then cleared locally.
 *    Nothing is ever saved to the server before that first fetch has finished, or an empty local
 *    cart could wipe the account's cart.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null

  const [lines, setLines] = useState<CartLine[]>(readLocal)
  const linesRef = useRef(lines) // the latest lines, so quick successive changes never use stale ones
  // Which account's cart has been loaded, and the last load error.
  const [loaded, setLoaded] = useState<{ userId: number | null; error: unknown }>({
    userId: null,
    error: null,
  })
  const [retryTick, setRetryTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [syncError, setSyncError] = useState<unknown>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inflight = useRef(false)
  const again = useRef(false)
  const mode = useRef({ userId, ready: false })
  const loading = useRef<{ userId: number; promise: Promise<ServerCart> } | null>(null)

  const ready = userId !== null && loaded.userId === userId
  useEffect(() => {
    mode.current = { userId, ready }
  })

  // Signing out empties the cart on screen. (Adjusting state while rendering is React's way of
  // resetting state when a prop changes.)
  const [seenUser, setSeenUser] = useState(userId)
  if (seenUser !== userId) {
    setSeenUser(userId)
    if (userId === null) {
      setLines([])
      setSaving(false)
      setSyncError(null)
    }
  }
  const previousUser = useRef<number | null>(null)
  useEffect(() => {
    if (userId === null && previousUser.current !== null) {
      writeLocal([]) // the next visitor on this browser starts with an empty cart
      linesRef.current = []
      clearTimeout(timer.current)
      timer.current = undefined
      again.current = false
    }
    previousUser.current = userId
  }, [userId])

  // Several tabs of a guest cart stay in step.
  useEffect(() => {
    if (userId !== null) return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      linesRef.current = readLocal()
      setLines(linesRef.current)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId])

  // On sign-in: fetch the account's cart, merge a guest cart into it, then clear the guest cart.
  // The fetch is shared, so a repeated effect run cannot merge the same guest cart twice.
  useEffect(() => {
    if (userId === null) return
    let cancelled = false

    function load(): Promise<ServerCart> {
      if (loading.current?.userId === userId) return loading.current.promise
      const promise = (async () => {
        const saved = await api.get<ServerCart>(SERVER_CART)
        const local = readLocal()
        if (local.length === 0) return saved
        const merged = await api.post<ServerCart>(`${SERVER_CART}/merge`, { lines: local })
        writeLocal([]) // only after the merge has succeeded
        return merged
      })()
      loading.current = { userId: userId as number, promise }
      const done = () => {
        if (loading.current?.promise === promise) loading.current = null
      }
      promise.then(done, done)
      return promise
    }

    load().then(
      (cart) => {
        if (cancelled) return
        linesRef.current = cart.lines
        setLines(cart.lines)
        setLoaded({ userId, error: null })
      },
      (error) => {
        if (!cancelled) setLoaded({ userId: null, error })
      },
    )
    return () => {
      cancelled = true
    }
  }, [userId, retryTick])

  // Saving: wait a moment after the last change, then send the whole cart. One request at a time;
  // a change made during a save is sent straight after it. A failed save reloads the server's cart.
  async function flush() {
    timer.current = undefined
    if (inflight.current) {
      again.current = true
      return
    }
    inflight.current = true
    try {
      do {
        again.current = false
        await api.put(SERVER_CART, { lines: linesRef.current })
      } while (again.current)
      setSyncError(null)
    } catch (error) {
      setSyncError(error)
      try {
        const saved = await api.get<ServerCart>(SERVER_CART)
        linesRef.current = saved.lines
        setLines(saved.lines)
      } catch {
        // keep what is on screen; the error notice offers a retry
      }
    } finally {
      inflight.current = false
      if (timer.current === undefined && !again.current) setSaving(false)
    }
  }

  function scheduleSave() {
    setSaving(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  const value = useMemo(() => {
    function commit(next: CartLine[]) {
      linesRef.current = next
      setLines(next)
      if (mode.current.userId !== null && mode.current.ready) scheduleSave()
      else writeLocal(next)
    }
    const status: CartStatus =
      userId === null ? (authLoading ? 'loading' : 'guest') : ready ? 'ready' : 'loading'
    return {
      lines,
      // Bundles in total, so adding a second bundle of the same offer is visible in the count.
      count: lines.reduce((sum, l) => sum + l.bundles, 0),
      status,
      saving,
      syncError,
      loadError: userId !== null && !ready ? loaded.error : null,
      /** The same offer of the same product joins its line (capped at 99); another offer is its own line. */
      add: (productId: number, tierId: number, bundles: number) => {
        const amount = Math.min(MAX_BUNDLES, Math.max(1, Math.trunc(bundles)))
        const current = linesRef.current
        const existing = current.find((l) => l.tier_id === tierId)
        commit(
          existing
            ? current.map((l) =>
                l === existing ? { ...l, bundles: Math.min(MAX_BUNDLES, l.bundles + amount) } : l,
              )
            : [...current, { product_id: productId, tier_id: tierId, bundles: amount }],
        )
      },
      setBundles: (tierId: number, bundles: number) => {
        if (!Number.isInteger(bundles) || bundles < 1 || bundles > MAX_BUNDLES) return
        commit(linesRef.current.map((l) => (l.tier_id === tierId ? { ...l, bundles } : l)))
      },
      remove: (tierId: number) => commit(linesRef.current.filter((l) => l.tier_id !== tierId)),
      clear: () => commit([]),
      retry: () => {
        if (userId !== null && !ready) {
          setLoaded((s) => ({ ...s, error: null }))
          setRetryTick((t) => t + 1)
        } else if (userId !== null) {
          scheduleSave()
        }
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, userId, ready, authLoading, saving, syncError, loaded.error])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
