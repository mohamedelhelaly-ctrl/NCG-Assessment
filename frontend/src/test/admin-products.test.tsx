import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import {
  apiError,
  asAdmin,
  callsTo,
  json,
  listItem,
  mockApi,
  page,
  refRoutes,
  renderApp,
} from './helpers'

afterEach(() => vi.unstubAllGlobals())

const LIST = 'GET /api/v1/admin/products'

const items = [
  listItem(),
  listItem({
    id: 2,
    name: 'Pulse Oximeter (draft)',
    display_name: 'Pulse Oximeter (draft)',
    name_ar: null,
    missing_ar: true,
    is_active: false,
    tier_count: 0,
    image_count: 0,
    main_image_url: null,
    brand: 'PureCare',
    category: 'Devices',
  }),
]

test('lists products with status, tier and missing-Arabic markers', async () => {
  mockApi(asAdmin({ [LIST]: json(page(items)), ...refRoutes }))
  renderApp('/admin/products')
  const rows = await screen.findAllByRole('listitem')
  const first = within(rows[0])
  expect(first.getByText('Sterile Gauze Pads')).toBeInTheDocument()
  expect(first.getByText('Nova Health · Wound Care')).toBeInTheDocument()
  expect(first.getByText('Active')).toBeInTheDocument()
  expect(first.getByText('Tiers: 1')).toBeInTheDocument()
  expect(first.queryByText('No Arabic name')).not.toBeInTheDocument()

  const draft = within(rows[1])
  expect(draft.getByText('Inactive')).toBeInTheDocument()
  expect(draft.getByText('No tiers')).toBeInTheDocument() // admin-only: nothing to sell yet
  expect(draft.getByText('No Arabic name')).toBeInTheDocument()
  expect(screen.getByText('Results: 2')).toBeInTheDocument()
})

test('each product links to its edit page and "New product" opens the create page', async () => {
  mockApi(asAdmin({ [LIST]: json(page(items)), ...refRoutes }))
  renderApp('/admin/products')
  expect(await screen.findByRole('link', { name: 'Sterile Gauze Pads' })).toHaveAttribute(
    'href',
    '/admin/products/1',
  )
  expect(screen.getByRole('link', { name: 'New product' })).toHaveAttribute(
    'href',
    '/admin/products/new',
  )
})

test('shows an empty state, a filtered empty state and an error with retry', async () => {
  mockApi(asAdmin({ [LIST]: json(page([])), ...refRoutes }))
  renderApp('/admin/products')
  expect(await screen.findByText('No products yet. Create the first one.')).toBeInTheDocument()
})

test('an active filter with no matches says so and offers to clear the filters', async () => {
  const calls = mockApi(asAdmin({ [LIST]: json(page([])), ...refRoutes }))
  renderApp('/admin/products?status=inactive')
  expect(await screen.findByText('No products match these filters.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  await screen.findByText('No products yet. Create the first one.')
  expect(callsTo(calls, LIST).at(-1)!.url.search).not.toContain('status')
})

test('a failed load shows the error and retrying works', async () => {
  let fail = true
  mockApi(
    asAdmin({
      [LIST]: () => (fail ? apiError(500, 'http_error', 'Server error') : { body: page(items) }),
      ...refRoutes,
    }),
  )
  renderApp('/admin/products')
  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Sterile Gauze Pads')).toBeInTheDocument()
})

test('filters come from the address, so a filtered page survives a reload', async () => {
  const calls = mockApi(asAdmin({ [LIST]: json(page(items)), ...refRoutes }))
  renderApp('/admin/products?q=gauze&brand=1&category=2&status=active&missing_ar=true&page=2')
  await screen.findByText('Sterile Gauze Pads')
  const search = callsTo(calls, LIST)[0].url.searchParams
  expect(Object.fromEntries(search)).toEqual({
    page: '2',
    page_size: '20',
    search: 'gauze',
    brand_id: '1',
    category_id: '2',
    status: 'active',
    missing_ar: 'true',
  })
  expect(screen.getByLabelText('Search')).toHaveValue('gauze')
  expect(screen.getByLabelText('Brand')).toHaveValue('1')
  expect(screen.getByLabelText('Status')).toHaveValue('active')
})

test('changing a filter refetches and goes back to page 1', async () => {
  const calls = mockApi(asAdmin({ [LIST]: json(page(items)), ...refRoutes }))
  renderApp('/admin/products?page=3')
  await screen.findByText('Sterile Gauze Pads')
  await screen.findByRole('option', { name: 'PureCare' })
  await userEvent.selectOptions(screen.getByLabelText('Brand'), 'PureCare')
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('brand_id')).toBe('2'))
  expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('page')).toBe('1')
})

test('the status and missing-Arabic filters are sent to the server', async () => {
  const calls = mockApi(asAdmin({ [LIST]: json(page(items)), ...refRoutes }))
  renderApp('/admin/products')
  await screen.findByText('Sterile Gauze Pads')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'No tiers')
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('status')).toBe('no_tiers'))
  await userEvent.click(screen.getByLabelText('Only products without an Arabic name'))
  await waitFor(() =>
    expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('missing_ar')).toBe('true'),
  )
})

test('searching waits for a pause in typing, then searches (any language)', async () => {
  const calls = mockApi(asAdmin({ [LIST]: json(page(items)), ...refRoutes }))
  renderApp('/admin/products')
  await screen.findByText('Sterile Gauze Pads')
  const before = callsTo(calls, LIST).length
  await userEvent.type(screen.getByLabelText('Search'), 'شاش')
  expect(callsTo(calls, LIST).length).toBe(before) // not on every keystroke
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('search')).toBe('شاش'))
})

test('pagination moves between pages', async () => {
  const calls = mockApi(
    asAdmin({ [LIST]: json(page(items, { total: 45, total_pages: 3 })), ...refRoutes }),
  )
  renderApp('/admin/products')
  expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('page')).toBe('2'))
})

test('there is no pagination when everything fits on one page', async () => {
  mockApi(asAdmin({ [LIST]: json(page(items)), ...refRoutes }))
  renderApp('/admin/products')
  await screen.findByText('Sterile Gauze Pads')
  expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
})

test('deleting a product asks first, then deletes and reloads', async () => {
  let gone = false
  const calls = mockApi(
    asAdmin({
      [LIST]: () => ({ body: page(gone ? [items[1]] : items) }),
      'DELETE /api/v1/admin/products/1': () => {
        gone = true
        return { status: 204 }
      },
      ...refRoutes,
    }),
  )
  renderApp('/admin/products')
  const row = (await screen.findAllByRole('listitem'))[0]
  await userEvent.click(within(row).getByRole('button', { name: 'Delete' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete this product?' })
  expect(dialog).toHaveTextContent('its pricing tiers and its images will be permanently deleted')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText('Deleted.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText('Sterile Gauze Pads')).not.toBeInTheDocument())
  expect(callsTo(calls, 'DELETE /api/v1/admin/products/1')).toHaveLength(1)
})

test('product names follow the interface language', async () => {
  mockApi(
    asAdmin({
      [LIST]: (_init, _url) => ({ body: page(items) }),
      ...refRoutes,
    }),
  )
  renderApp('/admin/products')
  await screen.findByText('Sterile Gauze Pads')
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByRole('heading', { name: 'المنتجات' })).toBeInTheDocument()
  expect(screen.getByText('بلا اسم عربي')).toBeInTheDocument()
})
