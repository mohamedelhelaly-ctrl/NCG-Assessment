import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { apiError, healthy, json, kwd, mockApi, renderApp, storeDetail, tier } from './helpers'

const PRODUCT = 'GET /api/v1/products/7'
const stored = () => JSON.parse(localStorage.getItem('cart:v1') ?? '{"lines":[]}').lines

async function openProduct(over: Record<string, unknown> = {}) {
  const calls = mockApi({ ...healthy, [PRODUCT]: json(storeDetail(over)) })
  renderApp('/products/7')
  await screen.findByRole('heading', { level: 1, name: 'Nitrile Examination Gloves' })
  return calls
}

const radios = () => screen.getAllByRole('radio')
const total = () => screen.getByText('Total').nextElementSibling as HTMLElement

// -------------------------------------------------------------------- the details

test('shows the name, brand, category, description and every offer', async () => {
  await openProduct()
  expect(screen.getByText('Powder-free nitrile gloves for examinations.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Nuvexa Medical' })).toHaveAttribute('href', '/shop?brand=1')
  expect(screen.getByRole('link', { name: 'Medical Consumables' })).toHaveAttribute('href', '/shop?category=1')
  expect(radios()).toHaveLength(3)
  expect(radios()[2].closest('label')).toHaveTextContent(/12 packs/)
  expect(radios()[2].closest('label')).toHaveTextContent('Best value')
  expect(radios()[2].closest('label')).toHaveTextContent('Save 17% per pack')
  await waitFor(() => expect(document.title).toBe('Nitrile Examination Gloves · MedicStore'))
})

test('works for a product with a single offer', async () => {
  await openProduct({ tiers: [tier(11, 1, 15750)] })
  expect(radios()).toHaveLength(1)
  expect(screen.queryByText('Best value')).not.toBeInTheDocument()
  expect(total()).toHaveTextContent(kwd('15.750'))
})

test('works for a product with two offers', async () => {
  await openProduct({ tiers: [tier(21, 1, 3000), tier(22, 4, 10500)] })
  expect(radios()).toHaveLength(2)
  await userEvent.click(radios()[1])
  expect(total()).toHaveTextContent(kwd('10.500'))
})

test('has a way back to all products', async () => {
  await openProduct()
  expect(screen.getByRole('link', { name: 'All products' })).toHaveAttribute('href', '/shop')
})

// ------------------------------------------------------------------ the gallery

test('the gallery shows the first picture and switches when a thumbnail is chosen', async () => {
  await openProduct()
  const gallery = screen.getByRole('group', { name: 'Product pictures' })
  const main = () => gallery.querySelectorAll('img')[0]
  expect(main()).toHaveAttribute('src', 'http://img.test/7a.svg')
  expect(main()).toHaveAttribute('alt', 'Front view')

  const thumbs = within(gallery).getAllByRole('button')
  expect(thumbs).toHaveLength(2)
  expect(thumbs[0]).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(within(gallery).getByRole('button', { name: 'Show picture 2' }))
  expect(main()).toHaveAttribute('src', 'http://img.test/7b.svg')
  expect(within(gallery).getByRole('button', { name: 'Show picture 2' })).toHaveAttribute('aria-pressed', 'true')
})

test('a single picture shows no thumbnails', async () => {
  await openProduct({ images: [{ id: 1, url: 'http://img.test/only.svg', alt: 'Only view' }] })
  expect(within(screen.getByRole('group', { name: 'Product pictures' })).queryAllByRole('button')).toHaveLength(0)
})

test('a product with no pictures shows a quiet placeholder', async () => {
  await openProduct({ images: [], main_image: null })
  expect(screen.getByText('No picture yet')).toBeInTheDocument()
})

// ------------------------------------------------------------ price calculation

test('starts with one bundle of the first offer and its price', async () => {
  await openProduct()
  expect(radios()[0]).toBeChecked()
  expect(screen.getByLabelText('Number of bundles')).toHaveValue('1')
  expect(total()).toHaveTextContent(kwd('5.500'))
  expect(screen.getByText('1 × 1 pack')).toBeInTheDocument()
  expect(screen.getByText('Total packs: 1')).toBeInTheDocument()
})

test('two bundles of the 4-pack offer at 19.500 total 39.000 for 8 packs (the brief)', async () => {
  await openProduct()
  await userEvent.click(radios()[1])
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  expect(screen.getByLabelText('Number of bundles')).toHaveValue('2')
  expect(screen.getByText('2 × 4 packs')).toBeInTheDocument()
  expect(screen.getByText('Total packs: 8')).toBeInTheDocument()
  expect(total()).toHaveTextContent(kwd('39.000'))
})

test('the total updates when the offer changes and the bundle price is not a per-pack price', async () => {
  await openProduct()
  await userEvent.click(radios()[2]) // 12 packs at 55.000 in total
  expect(total()).toHaveTextContent(kwd('55.000'))
  expect(screen.getByText('Total packs: 12')).toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('Number of bundles'))
  await userEvent.type(screen.getByLabelText('Number of bundles'), '3')
  expect(total()).toHaveTextContent(kwd('165.000'))
  expect(screen.getByText('Total packs: 36')).toBeInTheDocument()
})

test('the plus and minus buttons stay between 1 and 99', async () => {
  await openProduct()
  const input = screen.getByLabelText('Number of bundles')
  expect(screen.getByRole('button', { name: 'Fewer bundles' })).toBeDisabled()
  await userEvent.clear(input)
  await userEvent.type(input, '99')
  expect(screen.getByRole('button', { name: 'More bundles' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Fewer bundles' }))
  expect(input).toHaveValue('98')
})

test.each(['0', '100', '-2', '1.5', 'abc', ''])('%j is not a valid number of bundles', async (text) => {
  await openProduct()
  const input = screen.getByLabelText('Number of bundles')
  await userEvent.clear(input)
  if (text) await userEvent.type(input, text)
  expect(await screen.findByText('Enter a whole number from 1 to 99')).toBeInTheDocument()
  expect(input).toBeInvalid()
  expect(total()).toHaveTextContent('—')
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled()
})

test('an invalid count can be fixed with the plus button', async () => {
  await openProduct()
  const input = screen.getByLabelText('Number of bundles')
  await userEvent.clear(input)
  await userEvent.type(input, 'abc')
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  expect(input).toHaveValue('2')
  expect(screen.queryByText('Enter a whole number from 1 to 99')).not.toBeInTheDocument()
})

// ---------------------------------------------------------------- add to cart

test('adding sends the chosen offer and bundle count to the cart and confirms it', async () => {
  await openProduct()
  await userEvent.click(radios()[1])
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(await screen.findByText('Added to your cart: 2 × 4 packs.')).toBeInTheDocument()
  expect(stored()).toEqual([{ product_id: 7, tier_id: 12, bundles: 2 }])
  expect(screen.getByText('Cart').closest('a')).toHaveTextContent('2')
})

test('adding the same offer again adds to its line; another offer is a new line', async () => {
  await openProduct()
  await userEvent.click(radios()[1])
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
  await userEvent.click(radios()[2])
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(stored()).toEqual([
    { product_id: 7, tier_id: 12, bundles: 2 },
    { product_id: 7, tier_id: 13, bundles: 1 },
  ])
})

test('the cart never holds more than 99 bundles of one offer', async () => {
  await openProduct()
  const input = screen.getByLabelText('Number of bundles')
  await userEvent.clear(input)
  await userEvent.type(input, '99')
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(stored()).toEqual([{ product_id: 7, tier_id: 11, bundles: 99 }])
})

test('nothing is added while the count is invalid', async () => {
  await openProduct()
  await userEvent.clear(screen.getByLabelText('Number of bundles'))
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
  expect(stored()).toEqual([])
})

// ------------------------------------------------------ unknown or failing

test('an unknown or hidden product says it is not available', async () => {
  mockApi({ ...healthy, [PRODUCT]: () => apiError(404, 'not_found', 'Product not found') })
  renderApp('/products/7')
  expect(await screen.findByRole('alert')).toHaveTextContent("This product isn't available")
  expect(screen.getByRole('link', { name: 'All products' })).toBeInTheDocument()
})

test('a server failure shows the error and can be retried', async () => {
  let fail = true
  mockApi({
    ...healthy,
    [PRODUCT]: () => (fail ? apiError(500, 'http_error', 'Server error') : { body: storeDetail() }),
  })
  renderApp('/products/7')
  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Nitrile Examination Gloves' })).toBeInTheDocument()
})

test('shows a loading state while the product loads', async () => {
  mockApi({ ...healthy, [PRODUCT]: () => new Promise(() => {}) })
  renderApp('/products/7')
  expect(await screen.findByRole('status', { name: 'Loading…' })).toBeInTheDocument()
})

// -------------------------------------------------------------------- Arabic

test('in Arabic the product page is translated and keeps Latin digits', async () => {
  const calls = await openProduct()
  await userEvent.click(radios()[1])
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByText('اختر حزمة', { selector: 'legend' })).toBeInTheDocument()
  expect(screen.getByText('إجمالي العبوات: 8')).toBeInTheDocument()
  const totalText = screen.getByText('الإجمالي').nextElementSibling!.textContent ?? ''
  expect(totalText).toContain('39.000')
  expect(totalText).toContain('د.ك')
  expect(totalText).not.toMatch(/[٠-٩]/)
  expect(screen.getByRole('button', { name: 'أضف إلى السلة' })).toBeInTheDocument()
  // the choice made before switching language is kept
  expect(screen.getByLabelText('عدد الحزم')).toHaveValue('2')
  const last = calls.filter((c) => c.key === PRODUCT).at(-1)!
  expect((last.init!.headers as Record<string, string>)['Accept-Language']).toBe('ar')
})

test('the stepper and the price stay left to right inside the Arabic page', async () => {
  await openProduct()
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  const input = await screen.findByLabelText('عدد الحزم')
  expect(input.parentElement).toHaveAttribute('dir', 'ltr')
  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
})
