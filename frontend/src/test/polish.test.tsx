import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import faviconSvg from '../../public/favicon.svg?raw'
import vercelConfig from '../../vercel.json'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import i18n from '../lib/i18n'
import {
  admin,
  healthy,
  json,
  mockApi,
  page,
  refRoutes,
  renderApp,
  storeDetail,
  storeProduct,
  storeRoutes,
} from './helpers'
import type { Handler } from './helpers'

afterEach(() => vi.restoreAllMocks())

const asAdmin = () => {
  localStorage.setItem('auth:token', 'tok')
  return { 'GET /api/v1/auth/me': json(admin) }
}

// ----------------------------------------------------------------- landmarks

const publicPages: [string, Record<string, Handler>][] = [
  ['/', storeRoutes([storeProduct()])],
  ['/products/7', { 'GET /api/v1/products/7': json(storeDetail()) }],
  ['/cart', {}],
  ['/login', {}],
  ['/register', {}],
  ['/nowhere', {}],
]

test.each(publicPages)('%s has exactly one main landmark', async (path, routes) => {
  mockApi({ ...healthy, ...routes })
  renderApp(path)
  expect(await screen.findByRole('main')).toBeInTheDocument()
  await screen.findAllByRole('heading')
  expect(screen.getAllByRole('main')).toHaveLength(1)
  expect(screen.getAllByRole('banner')).toHaveLength(1) // the site header, and no second one
})

test.each(['/admin/products', '/admin/products/new', '/admin/brands', '/admin/categories'])(
  'the admin page %s has exactly one main landmark and one banner',
  async (path) => {
    mockApi({
      ...healthy,
      ...asAdmin(),
      'GET /api/v1/admin/products': json(page([])),
      ...refRoutes,
    })
    renderApp(path)
    await screen.findByRole('heading', { level: 1, name: 'Admin area' })
    await screen.findAllByRole('heading', { level: 2 })
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('banner')).toHaveLength(1)
  },
)

test('the product edit page has a single banner (its heading block is not a second one)', async () => {
  mockApi({
    ...healthy,
    ...asAdmin(),
    ...refRoutes,
    'GET /api/v1/admin/products/7': json({
      id: 7, brand_id: 1, category_id: 1, name: 'Vitamin C', name_ar: null, description: 'd',
      description_ar: null, is_active: false, tiers: [], images: [], created_at: 'x', updated_at: 'x',
    }),
  })
  renderApp('/admin/products/7')
  await screen.findByRole('heading', { level: 2, name: 'Edit product' })
  expect(screen.getAllByRole('banner')).toHaveLength(1)
})

// ----------------------------------------------------------- headings in order

test('the home page headings go h1, then h2 (never skipping to h3)', async () => {
  mockApi({ ...healthy, ...storeRoutes([storeProduct(), storeProduct({ id: 8, name: 'Other' })]) })
  renderApp('/')
  await screen.findByRole('heading', { name: 'Other' })
  const levels = screen.getAllByRole('heading').map((h) => Number(h.tagName[1]))
  expect(levels[0]).toBe(1)
  expect(levels.every((level, i) => i === 0 || level - levels[i - 1] <= 1)).toBe(true)
  expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
})

// ------------------------------------------------------------ keyboard and focus

test('the first thing a keyboard user reaches is a "Skip to content" link to the main area', async () => {
  mockApi({ ...healthy, ...storeRoutes([storeProduct()]) })
  renderApp('/')
  await screen.findByRole('main')
  await userEvent.tab()
  const skip = screen.getByRole('link', { name: 'Skip to content' })
  expect(skip).toHaveFocus()
  expect(skip).toHaveAttribute('href', '#content')
  const main = screen.getByRole('main')
  expect(main).toHaveAttribute('id', 'content')
  expect(main).toHaveAttribute('tabindex', '-1') // so it can receive focus
})

test('the skip link is translated', async () => {
  mockApi({ ...healthy, ...storeRoutes([storeProduct()]) })
  renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'العربية' }))
  expect(await screen.findByRole('link', { name: 'تخطَّ إلى المحتوى' })).toBeInTheDocument()
})

test('going to another page scrolls to the top and moves focus to the content', async () => {
  const scrollTo = vi.fn()
  vi.stubGlobal('scrollTo', scrollTo)
  mockApi({ ...healthy, ...storeRoutes([storeProduct()]) })
  renderApp('/')
  await userEvent.click(await screen.findByRole('link', { name: 'Sign in' }))
  await screen.findByRole('heading', { level: 1, name: 'Sign in' })
  await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  expect(scrollTo).toHaveBeenCalledWith(0, 0)
})

test('changing a search or filter does NOT take focus away from the search box', async () => {
  const scrollTo = vi.fn()
  vi.stubGlobal('scrollTo', scrollTo)
  mockApi({ ...healthy, ...storeRoutes([storeProduct()]) })
  renderApp('/')
  const search = await screen.findByLabelText('Search products, brands or categories')
  await userEvent.type(search, 'gloves')
  await waitFor(() => expect(screen.getByRole('button', { name: /Remove filter: “gloves”/ })).toBeInTheDocument())
  expect(search).toHaveFocus() // the address changed (?q=gloves) but the page did not
  expect(scrollTo).not.toHaveBeenCalled()
})

// ---------------------------------------------------------------- crash screen

function Boom(): never {
  throw new Error('boom')
}

test('an unexpected crash shows a calm screen with a way out, not a blank page', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
})

test('the reload button reloads the page', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const reload = vi.fn()
  const original = window.location
  Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } })
  try {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Reload the page' }))
    expect(reload).toHaveBeenCalledOnce()
  } finally {
    Object.defineProperty(window, 'location', { configurable: true, value: original })
  }
})

test('the crash screen is available in Arabic', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await i18n.changeLanguage('ar')
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'حدث خطأ ما' })).toBeInTheDocument()
})

test('the error is still reported to the console for debugging', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  )
  expect(spy.mock.calls.some((call) => String(call[0]).includes('Unexpected error'))).toBe(true)
})

test('a healthy page is shown as it is', () => {
  render(
    <ErrorBoundary>
      <p>all good</p>
    </ErrorBoundary>,
  )
  expect(screen.getByText('all good')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

// ------------------------------------------------------------ static assets

test('the favicon is the store mark (four green squares), not the template icon', () => {
  const svg = faviconSvg
  expect(svg).toContain('#15634f')
  expect((svg.match(/<rect /g) ?? []).length).toBe(5) // the white tile and the four squares
  expect(svg).not.toContain('863bff') // the Vite template's purple
})

test('the page head has a description, a theme colour and the icon', () => {
  const html = indexHtml
  expect(html).toContain('<title>MedicStore</title>')
  expect(html).toMatch(/name="description"\s+content="MedicStore/)
  expect(html).toContain('name="theme-color" content="#15634f"')
  expect(html).toContain('rel="icon" type="image/svg+xml" href="/favicon.svg"')
})

test('the site is served with basic security headers', () => {
  const config = vercelConfig
  const all = config.headers.find((h) => h.source === '/(.*)')!
  const headers = Object.fromEntries(all.headers.map((h) => [h.key, h.value]))
  expect(headers['X-Content-Type-Options']).toBe('nosniff')
  expect(headers['X-Frame-Options']).toBe('DENY')
  expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  // the page-specific cache rules are still there
  expect(config.headers.some((h) => h.source === '/index.html')).toBe(true)
})
