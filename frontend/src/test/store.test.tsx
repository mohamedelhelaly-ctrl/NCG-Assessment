import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  apiError,
  callsTo,
  healthy,
  json,
  kwd,
  mockApi,
  page,
  renderApp,
  storeProduct,
  storeRoutes,
  tier,
} from './helpers'

const LIST = 'GET /api/v1/products'

const gloves = storeProduct() // 3 offers
const syringes = storeProduct({
  id: 9,
  name: 'Disposable Syringes (5ml)',
  brand: { id: 1, name: 'Nuvexa Medical' },
  tiers: [tier(21, 1, 3000), tier(22, 4, 10500)], // 2 offers
})
const scales = storeProduct({
  id: 14,
  name: 'Digital Weighing Scales',
  brand: { id: 2, name: 'Orvanta Health' },
  category: { id: 2, name: 'Medical Devices' },
  main_image: null,
  tiers: [tier(31, 1, 15750)], // 1 offer, no picture
})

const card = (name: string) =>
  screen.getByRole('heading', { name, level: 2 }).closest('article') as HTMLElement

async function openStore(products = [gloves, syringes, scales], path = '/shop') {
  const calls = mockApi({ ...healthy, ...storeRoutes(products) })
  renderApp(path)
  await screen.findByRole('heading', { name: 'Nitrile Examination Gloves', level: 2 }).catch(() => null)
  return calls
}

// ----------------------------------------------------------------- the listing

test('the shop shows the headline, a search box and the products', async () => {
  await openStore()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Stock up today and pay less for every pack.',
  )
  expect(screen.getByRole('search')).toBeInTheDocument()
  expect(screen.getByText('Products: 3')).toBeInTheDocument()
  await waitFor(() => expect(document.title).toBe('Shop · MedicStore'))
})

test('each card shows the picture, brand, category and name', async () => {
  await openStore()
  const c = within(card('Nitrile Examination Gloves'))
  expect(c.getByText('Nuvexa Medical')).toBeInTheDocument()
  expect(c.getByText('Medical Consumables')).toBeInTheDocument()
  expect(card('Nitrile Examination Gloves').querySelector('img')).toHaveAttribute('src', 'http://img.test/7.svg')
  expect(card('Nitrile Examination Gloves').querySelector('img')).toHaveAttribute('alt', 'Nitrile Examination Gloves')
  expect(c.getByRole('link', { name: 'Nitrile Examination Gloves' })).toHaveAttribute('href', '/products/7')
})

test('a product with no picture shows a quiet placeholder, not a broken image', async () => {
  await openStore()
  const c = card('Digital Weighing Scales')
  expect(c.querySelector('img')).toBeNull()
  expect(within(c).getByText('No picture yet')).toBeInTheDocument()
})

test('products with one, two and three bundles all show a chip for each bundle', async () => {
  await openStore()
  const three = within(card('Nitrile Examination Gloves')).getAllByRole('radio')
  expect(three.map((r) => r.closest('label')!.textContent)).toEqual(['1 pack', '4 packs', '12 packs'])
  expect(within(card('Disposable Syringes (5ml)')).getAllByRole('radio')).toHaveLength(2)
  expect(within(card('Digital Weighing Scales')).getAllByRole('radio')).toHaveLength(1)
})

test('the card shows the price of the chosen bundle, its price per pack and best value', async () => {
  await openStore()
  const c = within(card('Nitrile Examination Gloves'))
  const radios = c.getAllByRole('radio')
  expect(c.getByText(kwd('5.500'))).toBeInTheDocument()
  expect(c.queryByText(/per pack/)).not.toBeInTheDocument() // a single pack has no "per pack" line
  expect(c.queryByText('Best value')).not.toBeInTheDocument()
  await userEvent.click(radios[1])
  expect(c.getByText(kwd('19.500'))).toBeInTheDocument()
  expect(c.getByText(kwd('4.875') )).toBeInTheDocument()
  expect(c.queryByText('Best value')).not.toBeInTheDocument()
  await userEvent.click(radios[2])
  expect(c.getByText(kwd('55.000'))).toBeInTheDocument()
  expect(c.getByText(kwd('4.583'))).toBeInTheDocument()
  expect(c.getByText('Best value')).toBeInTheDocument()
})

test('a product with one bundle has no best value marker', async () => {
  await openStore()
  expect(within(card('Digital Weighing Scales')).queryByText('Best value')).not.toBeInTheDocument()
})

test('the first offer is selected by default and the choice can change', async () => {
  await openStore()
  const radios = within(card('Nitrile Examination Gloves')).getAllByRole('radio')
  expect(radios[0]).toBeChecked()
  await userEvent.click(radios[2])
  expect(radios[2]).toBeChecked()
  expect(radios[0]).not.toBeChecked()
})

test('choosing an offer on one card does not change another card', async () => {
  await openStore()
  const a = within(card('Nitrile Examination Gloves')).getAllByRole('radio')
  const b = within(card('Disposable Syringes (5ml)')).getAllByRole('radio')
  await userEvent.click(a[1])
  expect(b[0]).toBeChecked()
})

// ------------------------------------------------------------------- the filters

test('category and brand are dropdowns with their product counts', async () => {
  await openStore()
  const category = screen.getByRole('combobox', { name: 'Category' })
  const brand = screen.getByRole('combobox', { name: 'Brand' })
  expect(within(category).getByRole('option', { name: 'All categories' })).toBeInTheDocument()
  expect(within(category).getByRole('option', { name: 'Medical Devices (2)' })).toBeInTheDocument()
  expect(within(brand).getByRole('option', { name: 'All brands' })).toBeInTheDocument()
  expect(within(brand).getByRole('option', { name: 'Orvanta Health (4)' })).toBeInTheDocument()
})

test('choosing a category filters on the server', async () => {
  const calls = await openStore()
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Category' }), '2')
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('category_id')).toBe('2'))
  expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('2')
})

test('brand and category filters combine', async () => {
  const calls = await openStore()
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Category' }), '2')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Brand' }), '2')
  await waitFor(() => {
    const params = callsTo(calls, LIST).at(-1)!.url.searchParams
    expect(params.get('category_id')).toBe('2')
    expect(params.get('brand_id')).toBe('2')
  })
})

test('a filter can be reset from its dropdown, and all filters can be cleared', async () => {
  const calls = await openStore([gloves], '/shop?category=2&brand=2')
  const category = await screen.findByRole('combobox', { name: 'Category' })
  await waitFor(() => expect(category).toHaveValue('2'))
  await userEvent.selectOptions(category, '')
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('category_id')).toBeNull())
  expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('brand_id')).toBe('2')
  await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }))
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('brand_id')).toBeNull())
})

test('filters in the address are applied on arrival', async () => {
  const calls = await openStore([gloves], '/shop?q=glove&category=1&brand=1&page=2')
  const params = callsTo(calls, LIST)[0].url.searchParams
  expect(Object.fromEntries(params)).toEqual({
    page: '2',
    page_size: '12',
    search: 'glove',
    category_id: '1',
    brand_id: '1',
  })
  expect(screen.getByLabelText('Search products, brands or categories')).toHaveValue('glove')
})

test('changing a filter goes back to the first page', async () => {
  const calls = await openStore([gloves], '/shop?page=3')
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Category' }), '2')
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('page')).toBe('1'))
})

// -------------------------------------------------------------------- the search

test('typing searches after a pause, in any language', async () => {
  const calls = await openStore()
  const before = callsTo(calls, LIST).length
  await userEvent.type(screen.getByLabelText('Search products, brands or categories'), 'قفازات')
  expect(callsTo(calls, LIST).length).toBe(before) // not on every keystroke
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('search')).toBe('قفازات'))
  expect(screen.getByRole('button', { name: 'Remove filter: “قفازات”' })).toBeInTheDocument()
})

test('pressing Search or Enter searches straight away', async () => {
  const calls = await openStore()
  await userEvent.type(screen.getByLabelText('Search products, brands or categories'), 'gauze{Enter}')
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('search')).toBe('gauze'))
})

test('clearing the search chip empties the box and searches everything again', async () => {
  const calls = await openStore([gloves], '/shop?q=glove')
  await userEvent.click(await screen.findByRole('button', { name: 'Remove filter: “glove”' }))
  expect(screen.getByLabelText('Search products, brands or categories')).toHaveValue('')
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('search')).toBeNull())
})

// ------------------------------------------------------- loading, errors, empty

test('shows a loading state while the products load', async () => {
  mockApi({ ...healthy, ...storeRoutes([], { [LIST]: () => new Promise(() => {}) }) })
  renderApp('/shop')
  expect(await screen.findByRole('status', { name: 'Loading products…' })).toBeInTheDocument()
})

test('a failed load says so and can be retried', async () => {
  let fail = true
  mockApi({
    ...healthy,
    ...storeRoutes([gloves], {
      [LIST]: () => (fail ? apiError(500, 'http_error', 'Server error') : { body: page([gloves]) }),
    }),
  })
  renderApp('/shop')
  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { name: 'Nitrile Examination Gloves', level: 2 })).toBeInTheDocument()
})

test('an empty shop says that nothing is on sale yet', async () => {
  mockApi({ ...healthy, ...storeRoutes([]) })
  renderApp('/shop')
  expect(await screen.findByText('No products are on sale yet. Please check back soon.')).toBeInTheDocument()
})

test('no matches explains what to change and offers to clear the filters', async () => {
  const calls = mockApi({ ...healthy, ...storeRoutes([]) })
  renderApp('/shop?q=zzz')
  expect(
    await screen.findByText('No products match your search or filters. Try another word, or clear the filters.'),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' })) // exactly one, below the message
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('search')).toBeNull())
})

test('pagination moves between pages', async () => {
  const calls = mockApi({
    ...healthy,
    ...storeRoutes([gloves], { [LIST]: json(page([gloves], { total: 30, total_pages: 3, page_size: 12 })) }),
  })
  renderApp('/shop')
  expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(callsTo(calls, LIST).at(-1)!.url.searchParams.get('page')).toBe('2'))
})

// ------------------------------------------------------------------ quick add

const cartPill = () => screen.getByText('Cart').closest('a') as HTMLElement
const stored = () => JSON.parse(localStorage.getItem('cart:v1') ?? '{"lines":[]}').lines

test('quick add puts one bundle of the chosen offer in the cart and shows the count', async () => {
  await openStore()
  // the cart link is always there; it has no count while the cart is empty
  expect(screen.getByRole('link', { name: 'Cart' })).toBeInTheDocument()
  const c = within(card('Nitrile Examination Gloves'))
  await userEvent.click(c.getAllByRole('radio')[1]) // 4 packs
  await userEvent.click(c.getByRole('button', { name: 'Add to cart' }))
  expect(await c.findByRole('button', { name: 'Added to cart' })).toBeInTheDocument()
  expect(cartPill()).toHaveTextContent('1')
  expect(stored()).toEqual([{ product_id: 7, tier_id: 12, bundles: 1 }])
})

test('adding the same offer twice makes one line of two bundles', async () => {
  await openStore()
  const c = within(card('Nitrile Examination Gloves'))
  await userEvent.click(c.getByRole('button', { name: 'Add to cart' }))
  await userEvent.click(await c.findByRole('button', { name: 'Added to cart' }))
  expect(stored()).toEqual([{ product_id: 7, tier_id: 11, bundles: 2 }])
  expect(cartPill()).toHaveTextContent('2')
})

test('different offers of the same product are separate cart lines', async () => {
  await openStore()
  const c = within(card('Nitrile Examination Gloves'))
  await userEvent.click(c.getByRole('button', { name: 'Add to cart' }))
  await userEvent.click(c.getAllByRole('radio')[2])
  await userEvent.click(c.getByRole('button', { name: /Add to cart|Added to cart/ }))
  expect(stored()).toEqual([
    { product_id: 7, tier_id: 11, bundles: 1 },
    { product_id: 7, tier_id: 13, bundles: 1 },
  ])
})

test('the confirmation fades back to "Add to cart" by itself', async () => {
  await openStore()
  const c = within(card('Nitrile Examination Gloves'))
  await userEvent.click(c.getByRole('button', { name: 'Add to cart' }))
  expect(await c.findByRole('button', { name: 'Added to cart' })).toBeInTheDocument()
  expect(await c.findByRole('button', { name: 'Add to cart' }, { timeout: 3000 })).toBeInTheDocument()
})

test('a cart from an earlier visit still shows its count', async () => {
  localStorage.setItem('cart:v1', JSON.stringify({ lines: [{ product_id: 7, tier_id: 12, bundles: 3 }] }))
  await openStore()
  expect(cartPill()).toHaveTextContent('3')
})

// -------------------------------------------------------------------- Arabic

test('in Arabic the page is translated, prices keep Latin digits and the Arabic currency sign', async () => {
  await openStore()
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'خزّن اليوم وادفع أقل عن كل عبوة.' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'أضف إلى السلة' })).toHaveLength(3)
  await userEvent.click(within(card('Nitrile Examination Gloves')).getAllByRole('radio')[2]) // 12 packs
  const text = card('Nitrile Examination Gloves').textContent ?? ''
  expect(text).toContain('55.000')
  expect(text).toContain('د.ك')
  expect(text).not.toMatch(/[٠-٩]/)
  expect(text).toContain('الأوفر') // best value, in Arabic
  expect(screen.getByRole('combobox', { name: 'الفئة' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'كل الفئات' })).toBeInTheDocument()
})

test('switching language refetches the products so names come back in that language', async () => {
  const calls = await openStore()
  const before = callsTo(calls, LIST).length
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  await waitFor(() => expect(callsTo(calls, LIST).length).toBeGreaterThan(before))
  const headers = callsTo(calls, LIST).at(-1)!.init!.headers as Record<string, string>
  expect(headers['Accept-Language']).toBe('ar')
})
