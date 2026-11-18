import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import App from '../App'
import { AuthProvider } from '../lib/auth'

export type Handler = (init: RequestInit | undefined) => { status?: number; body: unknown }

/** Route-based fetch mock: keys look like "POST /api/v1/auth/login". */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname
      const key = `${init?.method ?? 'GET'} ${path}`
      calls.push({ key, init })
      const handler = routes[key]
      if (!handler) return new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 })
      const { status = 200, body } = handler(init)
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
