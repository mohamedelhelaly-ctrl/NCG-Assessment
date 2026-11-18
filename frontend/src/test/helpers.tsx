import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../lib/auth'
import { CartProvider } from '../lib/cart'

export interface Call {
  key: string
  init?: RequestInit
  url: URL
}
type Result = { status?: number; body?: unknown }
/** A handler may return a promise, for example one that never settles to test loading states. */
export type Handler = (init: RequestInit | undefined, url: URL) => Result | Promise<Result>

/** Route-based fetch mock: keys look like "POST /api/v1/auth/login" (path only, no query). */
export function mockApi(routes: Record<string, Handler>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input)
      const key = `${init?.method ?? 'GET'} ${url.pathname}`
      calls.push({ key, init, url })
      const handler = routes[key]
      if (!handler) {
        return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }), {
          status: 404,
        })
      }
      const { status = 200, body } = await handler(init, url)
      if (status === 204 || body === undefined) return new Response(null, { status })
      return new Response(JSON.stringify(body), { status })
    }),
  )
  return calls
}

export function renderApp(path = '/', options: { strict?: boolean } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  )
  // React's development double-run of effects; the real app runs in StrictMode.
  return render(options.strict ? <StrictMode>{tree}</StrictMode> : tree)
}

export const customer = { id: 1, email: 'c@shop.example', full_name: 'Cara Customer', role: 'customer' }
export const admin = { id: 2, email: 'a@shop.example', full_name: 'Adam Admin', role: 'admin' }
export const tokenFor = (user: object) => ({ access_token: 'tok', token_type: 'bearer', user })
export const healthy = { 'GET /healthz': () => ({ body: { status: 'ok', database: 'ok' } }) }

/** Signs in as the admin (token in storage + /auth/me) and merges in the given routes. */
export function asAdmin(routes: Record<string, Handler> = {}): Record<string, Handler> {
  localStorage.setItem('auth:token', 'tok')
  return { ...healthy, 'GET /api/v1/auth/me': () => ({ body: admin }), ...routes }
}

export const json = (body: unknown, status = 200) => () => ({ status, body })

export function apiError(status: number, code: string, message: string, params = {}, fields = {}) {
  return { status, body: { error: { code, message, fields, params } } }
}

/** Calls made to a route, in order. */
export const callsTo = (calls: Call[], key: string) => calls.filter((c) => c.key === key)
export const bodyOf = (call: Call) => JSON.parse(String(call.init?.body))

// ---- fixtures ----
export function listItem(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Sterile Gauze Pads',
    name_ar: 'ضمادات شاش',
    display_name: 'Sterile Gauze Pads',
    brand: 'Nova Health',
    category: 'Wound Care',
    is_active: true,
    tier_count: 1,
    image_count: 1,
    missing_ar: false,
    main_image_url: 'http://img.test/1.webp',
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export function page(items: unknown[], over: Record<string, unknown> = {}) {
  return { items, total: items.length, page: 1, page_size: 20, total_pages: 1, ...over }
}

export function named(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Nova Health',
    name_ar: 'نوفا هيلث',
    display_name: 'Nova Health',
    product_count: 2,
    ...over,
  }
}

export function productDetail(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    brand_id: 1,
    category_id: 1,
    name: 'Vitamin C 500 mg',
    name_ar: null,
    description: 'Daily tablets',
    description_ar: null,
    is_active: true,
    tiers: [
      { id: 11, label: '1 pack', label_ar: null, units: 1, price_fils: 5500 },
      { id: 12, label: '4 packs', label_ar: null, units: 4, price_fils: 19500 },
    ],
    images: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

export const refRoutes = {
  'GET /api/v1/admin/brands': json([named(), named({ id: 2, name: 'PureCare', display_name: 'PureCare', name_ar: null })]),
  'GET /api/v1/admin/categories': json([
    named({ id: 1, name: 'Wound Care', display_name: 'Wound Care', name_ar: null }),
    named({ id: 2, name: 'Vitamins', display_name: 'Vitamins', name_ar: null }),
  ]),
}

// ---- storefront fixtures ----
export const tier = (id: number, units: number, price_fils: number) => ({
  id,
  units,
  price_fils,
  label: `${units} pack${units > 1 ? 's' : ''}`,
})

export function storeProduct(over: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Nitrile Examination Gloves',
    description: 'Powder-free nitrile gloves for examinations.',
    brand: { id: 1, name: 'Nuvexa Medical' },
    category: { id: 1, name: 'Medical Consumables' },
    main_image: { id: 1, url: 'http://img.test/7.svg', alt: 'Nitrile Examination Gloves' },
    tiers: [tier(11, 1, 5500), tier(12, 4, 19500), tier(13, 12, 55000)],
    ...over,
  }
}

export const storeDetail = (over: Record<string, unknown> = {}) => ({
  ...storeProduct(),
  images: [
    { id: 1, url: 'http://img.test/7a.svg', alt: 'Front view' },
    { id: 2, url: 'http://img.test/7b.svg', alt: 'Side view' },
  ],
  ...over,
})

export const brandCounts = [
  { id: 1, name: 'Nuvexa Medical', product_count: 2 },
  { id: 2, name: 'Orvanta Health', product_count: 4 },
]
export const categoryCounts = [
  { id: 1, name: 'Medical Consumables', product_count: 4 },
  { id: 2, name: 'Medical Devices', product_count: 2 },
]

/** The three public lists the storefront reads, with the given products on page 1. */
export function storeRoutes(products: unknown[], over: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    'GET /api/v1/products': json(page(products, { page_size: 12 })),
    'GET /api/v1/brands': json(brandCounts),
    'GET /api/v1/categories': json(categoryCounts),
    ...over,
  }
}

/** Formatted money as Intl writes it (a no-break space after "KWD"), as a regex-safe matcher. */
export const kwd = (amount: string) => new RegExp(`KWD\\s${amount.replace('.', '\\.')}`)


// ---- the cart ----
export interface CatalogTier {
  product_id: number
  name: string
  label: string
  units: number
  price: number
}

export const catalog: Record<number, CatalogTier> = {
  11: { product_id: 7, name: 'Nitrile Examination Gloves', label: '1 pack', units: 1, price: 5500 },
  12: { product_id: 7, name: 'Nitrile Examination Gloves', label: '4 packs', units: 4, price: 19500 },
  13: { product_id: 7, name: 'Nitrile Examination Gloves', label: '12 packs', units: 12, price: 55000 },
  41: { product_id: 15, name: 'Sterile Gauze Pads', label: '4 packs', units: 4, price: 6250 },
}

/** A fake of POST /cart/quote that prices exactly like the server: bundles x the bundle price. */
export function quoteHandler(cat: Record<number, CatalogTier> = catalog): Handler {
  return (init) => {
    const { lines } = JSON.parse(String(init?.body)) as {
      lines: { product_id: number; tier_id: number; bundles: number }[]
    }
    let line_count = 0, bundle_count = 0, pack_count = 0, total_fils = 0
    const problems: { code: string; index: number }[] = []
    const out = lines.map((l, index) => {
      const base = { ...l, product_name: null, tier_label: null, image_url: null, image_alt: null, units: null, bundle_price_fils: null, pack_quantity: null, line_total_fils: null }
      if (l.bundles < 1 || l.bundles > 99) {
        problems.push({ code: 'invalid_bundles', index })
        return { ...base, status: 'invalid' }
      }
      const t = cat[l.tier_id]
      if (!t || t.product_id !== l.product_id) {
        problems.push({ code: 'unavailable', index })
        return { ...base, status: 'unavailable' }
      }
      line_count += 1
      bundle_count += l.bundles
      pack_count += l.bundles * t.units
      total_fils += l.bundles * t.price
      return {
        ...base,
        status: 'ok',
        product_name: t.name,
        tier_label: t.label,
        image_url: `http://img.test/${t.product_id}.svg`,
        image_alt: t.name,
        units: t.units,
        bundle_price_fils: t.price,
        pack_quantity: l.bundles * t.units,
        line_total_fils: l.bundles * t.price,
      }
    })
    return { body: { lines: out, totals: { line_count, bundle_count, pack_count, total_fils }, problems } }
  }
}

export const cartLine = (product_id: number, tier_id: number, bundles: number) => ({ product_id, tier_id, bundles })
export const seedLocalCart = (lines: unknown[]) => localStorage.setItem('cart:v1', JSON.stringify({ owner: null, lines }))
export const localLines = () => JSON.parse(localStorage.getItem('cart:v1') ?? '{"lines":[]}').lines

/** A fake account cart on the server: GET, PUT and merge behave like the real endpoints. */
export function serverCart(initial: { product_id: number; tier_id: number; bundles: number }[] = []) {
  const state: { lines: typeof initial; lastMergeId: string | null; merges: number } = {
    lines: initial.map((l) => ({ ...l })),
    lastMergeId: null,
    merges: 0,
  }
  const routes: Record<string, Handler> = {
    'GET /api/v1/me/cart': () => ({ body: { lines: state.lines } }),
    'PUT /api/v1/me/cart': (init) => {
      state.lines = JSON.parse(String(init?.body)).lines
      return { body: { lines: state.lines } }
    },
    'POST /api/v1/me/cart/merge': (init) => {
      const body = JSON.parse(String(init?.body)) as { lines: typeof state.lines; merge_id?: string }
      if (body.merge_id && body.merge_id === state.lastMergeId) return { body: { lines: state.lines } } // a replay
      state.merges += 1
      if (body.merge_id) state.lastMergeId = body.merge_id
      const incoming = body.lines
      for (const l of incoming) {
        const same = state.lines.find((x) => x.tier_id === l.tier_id)
        if (same) same.bundles = Math.min(99, same.bundles + l.bundles)
        else state.lines.push({ ...l })
      }
      return { body: { lines: state.lines } }
    },
  }
  return { state, routes }
}
