import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../lib/auth'

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

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
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
