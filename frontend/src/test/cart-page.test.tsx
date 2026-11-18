import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  apiError,
  callsTo,
  cartLine,
  customer,
  healthy,
  json,
  kwd,
  localLines,
  mockApi,
  quoteHandler,
  renderApp,
  seedLocalCart,
  serverCart,
} from './helpers'

const QUOTE = 'POST /api/v1/cart/quote'
const gloves4 = cartLine(7, 12, 2) // the brief's example: 2 x the 4-pack at 19.500
const gloves12 = cartLine(7, 13, 1)
const gauze4 = cartLine(15, 41, 3)

async function openCart(lines: unknown[], extra: Parameters<typeof mockApi>[0] = {}) {
  seedLocalCart(lines)
  const calls = mockApi({ ...healthy, [QUOTE]: quoteHandler(), ...extra })
  renderApp('/cart')
  return calls
}

const row = (name: string | RegExp, nth = 0) =>
  screen.getAllByRole('heading', { level: 2, name })[nth].closest('li') as HTMLElement

// -------------------------------------------------------------------- the lines

test('shows each line from the server quote: picture, name, offer, bundles, packs and line total', async () => {
  await openCart([gloves4])
  const line = await screen.findByRole('heading', { level: 2, name: 'Nitrile Examination Gloves' })
  const r = within(line.closest('li') as HTMLElement)
  expect(r.getByText('4 packs')).toBeInTheDocument()
  expect(r.getByText('2 × 4 packs')).toBeInTheDocument()
  expect(r.getByText('Total packs: 8')).toBeInTheDocument()
  expect(r.getByText(kwd('39.000'))).toBeInTheDocument()
  expect(r.getByText(/KWD\s19\.500 per bundle/)).toBeInTheDocument()
  expect(line.closest('li')!.querySelector('img')).toHaveAttribute('src', 'http://img.test/7.svg')
})

test('two purchases of the 4-pack offer is 2 x 4 packs = 8 packs and KWD 39.000 (the brief)', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  const summary = screen.getByRole('complementary')
  expect(within(summary).getByText(kwd('39.000'))).toBeInTheDocument()
  expect(within(summary).getByText('Bundles').nextElementSibling).toHaveTextContent('2')
  expect(within(summary).getByText('Packs').nextElementSibling).toHaveTextContent('8') // not 2, not 39
})

test('different offers of the same product are separate lines with their own totals', async () => {
  await openCart([gloves4, gloves12])
  await screen.findByText('2 × 4 packs')
  expect(screen.getAllByRole('heading', { level: 2, name: 'Nitrile Examination Gloves' })).toHaveLength(2)
  expect(within(row('Nitrile Examination Gloves', 0)).getByText(kwd('39.000'))).toBeInTheDocument()
  // the bundle price and the line total are both 55.000 for a single 12-pack bundle
  expect(within(row('Nitrile Examination Gloves', 1)).getAllByText(kwd('55.000'))).toHaveLength(2)
  expect(within(row('Nitrile Examination Gloves', 1)).getByText('1 × 12 packs')).toBeInTheDocument()
})

test('the summary adds up bundles, packs and the total from the server prices', async () => {
  await openCart([gloves4, gloves12, gauze4])
  await screen.findByText('3 × 4 packs')
  const summary = within(screen.getByRole('complementary'))
  expect(summary.getByText('Bundles').nextElementSibling).toHaveTextContent('6') // 2 + 1 + 3
  expect(summary.getByText('Packs').nextElementSibling).toHaveTextContent('32') // 8 + 12 + 12
  expect(summary.getByText('Total').nextElementSibling).toHaveTextContent(kwd('112.750')) // 39 + 55 + 18.75
})

test('every price comes from the quote: the cart only sent ids and bundle counts', async () => {
  const calls = await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  const sent = JSON.parse(String(callsTo(calls, QUOTE)[0].init!.body))
  expect(sent).toEqual({ lines: [{ product_id: 7, tier_id: 12, bundles: 2 }] })
})

// --------------------------------------------------------------- changing lines

test('the plus button raises the bundle count and the total follows the server', async () => {
  const calls = await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  expect(await screen.findByText('3 × 4 packs')).toBeInTheDocument()
  expect(await screen.findByText('Total packs: 12')).toBeInTheDocument()
  await waitFor(() => expect(within(screen.getByRole('complementary')).getByText(kwd('58.500'))).toBeInTheDocument())
  expect(localLines()).toEqual([cartLine(7, 12, 3)])
  expect(JSON.parse(String(callsTo(calls, QUOTE).at(-1)!.init!.body)).lines[0].bundles).toBe(3)
})

test('the minus button lowers it and stops at one', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  const minus = screen.getByRole('button', { name: 'Fewer bundles' })
  await userEvent.click(minus)
  expect(await screen.findByText('1 × 4 packs')).toBeInTheDocument()
  expect(minus).toBeDisabled()
})

test('a bundle count can be typed', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  const input = screen.getByLabelText('Number of bundles for Nitrile Examination Gloves')
  await userEvent.clear(input)
  await userEvent.type(input, '10')
  expect(await screen.findByText('10 × 4 packs')).toBeInTheDocument()
  expect(localLines()).toEqual([cartLine(7, 12, 10)])
})

test.each(['0', 'abc', '-1', ' '])('typing %j is explained and the cart keeps its last good value', async (text) => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  const input = screen.getByLabelText('Number of bundles for Nitrile Examination Gloves')
  await userEvent.clear(input)
  await userEvent.type(input, text)
  expect(await screen.findByText('Enter a whole number from 1 to 99')).toBeInTheDocument()
  expect(input).toBeInvalid()
  expect(localLines()).toEqual([cartLine(7, 12, 2)]) // unchanged
  expect(screen.getByText('2 × 4 packs')).toBeInTheDocument()
  await userEvent.tab() // leaving the box puts the last good value back
  expect(input).toHaveValue('2')
})

test('typing past 99 is explained, and the last valid number stays in the cart', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  const input = screen.getByLabelText('Number of bundles for Nitrile Examination Gloves')
  await userEvent.clear(input)
  await userEvent.type(input, '100') // 1, then 10 (both valid, applied as you type), then 100 (not valid)
  expect(await screen.findByText('Enter a whole number from 1 to 99')).toBeInTheDocument()
  expect(localLines()).toEqual([cartLine(7, 12, 10)])
  await userEvent.tab()
  expect(input).toHaveValue('10')
})

test('a decimal is not a valid bundle count', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  const input = screen.getByLabelText('Number of bundles for Nitrile Examination Gloves')
  await userEvent.clear(input)
  await userEvent.type(input, '1.5')
  expect(await screen.findByText('Enter a whole number from 1 to 99')).toBeInTheDocument()
  expect(localLines()).toEqual([cartLine(7, 12, 1)]) // "1" was valid on its way; "1." and "1.5" are not
})

test('the count never goes above 99', async () => {
  await openCart([cartLine(7, 12, 99)])
  await screen.findByText('99 × 4 packs')
  expect(screen.getByRole('button', { name: 'More bundles' })).toBeDisabled()
})

test('removing a line takes it out of the cart and the total', async () => {
  await openCart([gloves4, gauze4])
  await screen.findByText('3 × 4 packs')
  await userEvent.click(screen.getByRole('button', { name: 'Remove Nitrile Examination Gloves from the cart' }))
  await waitFor(() => expect(screen.queryByText('2 × 4 packs')).not.toBeInTheDocument())
  expect(localLines()).toEqual([gauze4])
  await waitFor(() => expect(within(screen.getByRole('complementary')).getByText(kwd('18.750'))).toBeInTheDocument())
})

test('removing the last line shows the empty cart', async () => {
  await openCart([gloves4])
  await userEvent.click(await screen.findByRole('button', { name: /^Remove Nitrile/ }))
  expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  expect(localLines()).toEqual([])
})

// ----------------------------------------------------- unavailable lines

test('a removed offer is flagged, left out of the total and can be removed', async () => {
  await openCart([gloves4, cartLine(13, 999, 2)])
  await screen.findByText('2 × 4 packs')
  expect(screen.getByText('This offer is no longer available, so it is not in your total.')).toBeInTheDocument()
  const summary = within(screen.getByRole('complementary'))
  expect(summary.getByText('Total').nextElementSibling).toHaveTextContent(kwd('39.000')) // only the good line
  expect(summary.getByText('Lines not in the total: 1')).toBeInTheDocument()

  const flagged = screen.getByText('This offer is no longer available, so it is not in your total.').closest('li')!
  await userEvent.click(within(flagged).getByRole('button', { name: 'Remove' }))
  await waitFor(() => expect(screen.queryByText('This offer is no longer available, so it is not in your total.')).not.toBeInTheDocument())
  expect(localLines()).toEqual([gloves4])
})

test('an offer that belongs to a different product is treated as unavailable', async () => {
  await openCart([cartLine(99, 12, 1)]) // tier 12 exists, but not for product 99
  expect(await screen.findByText('This offer is no longer available, so it is not in your total.')).toBeInTheDocument()
  expect(within(screen.getByRole('complementary')).getByText('Total').nextElementSibling).toHaveTextContent(kwd('0.000'))
})

// ------------------------------------------------------------ empty, loading, errors

test('an empty cart invites you to the shop and asks the server for nothing', async () => {
  const calls = await openCart([])
  expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  expect(screen.getByText('Add a bundle from the shop and it will show up here.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute('href', '/')
  expect(callsTo(calls, QUOTE)).toHaveLength(0)
})

test('shows a loading state while the prices load', async () => {
  await openCart([gloves4], { [QUOTE]: () => new Promise(() => {}) })
  expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
})

test('a failed quote says so and can be retried', async () => {
  let fail = true
  await openCart([gloves4], {
    [QUOTE]: (init, url) => (fail ? apiError(500, 'http_error', 'Server error') : quoteHandler()(init, url)),
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('2 × 4 packs')).toBeInTheDocument()
})

// --------------------------------------------------------------- summary notes

test('there is no checkout button, and the summary says why', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  expect(screen.queryByRole('button', { name: /checkout|pay|order/i })).not.toBeInTheDocument()
  expect(screen.getByText("Checkout isn't part of this demo.")).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/')
})

test('a guest is told the cart is kept in this browser and invited to sign in', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  expect(screen.getByText('Your cart is kept in this browser.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign in to keep it on all your devices.' })).toHaveAttribute('href', '/login')
})

test('a signed-in customer is told the cart is saved to the account', async () => {
  localStorage.setItem('auth:token', 'tok')
  const { routes } = serverCart([gloves4])
  mockApi({ ...healthy, 'GET /api/v1/auth/me': json(customer), ...routes, [QUOTE]: quoteHandler() })
  renderApp('/cart')
  expect(await screen.findByText('2 × 4 packs')).toBeInTheDocument()
  expect(await screen.findByText('Saved to your account.')).toBeInTheDocument()
  expect(screen.queryByText('Your cart is kept in this browser.')).not.toBeInTheDocument()
})

// ----------------------------------------------------------------- header link

test('the header shows the number of bundles and links to the cart', async () => {
  await openCart([gloves4, gauze4])
  await screen.findByText('3 × 4 packs')
  const link = screen.getByRole('link', { name: /^Cart\s*5$/ })
  expect(link).toHaveAttribute('href', '/cart')
})

test('the product page confirms an add with a link to the cart', async () => {
  mockApi({
    ...healthy,
    'GET /api/v1/products/7': json({
      id: 7,
      name: 'Nitrile Examination Gloves',
      description: 'd',
      brand: { id: 1, name: 'Nuvexa Medical' },
      category: { id: 1, name: 'Consumables' },
      main_image: null,
      images: [],
      tiers: [{ id: 11, label: '1 pack', units: 1, price_fils: 5500 }],
    }),
  })
  renderApp('/products/7')
  await userEvent.click(await screen.findByRole('button', { name: 'Add to cart' }))
  expect(await screen.findByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')
})

// --------------------------------------------------------------------- Arabic

test('in Arabic the cart is translated, mirrored, and keeps Latin digits and the Arabic currency sign', async () => {
  await openCart([gloves4])
  await screen.findByText('2 × 4 packs')
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'سلتك' })).toBeInTheDocument()
  expect(await screen.findByText('إجمالي العبوات: 8')).toBeInTheDocument()
  const summary = screen.getByRole('complementary')
  const total = within(summary).getByText('الإجمالي').nextElementSibling!.textContent ?? ''
  expect(total).toContain('39.000')
  expect(total).toContain('د.ك')
  expect(total).not.toMatch(/[٠-٩]/)
  expect(within(summary).getByText('سلتك محفوظة في هذا المتصفح.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /^السلة\s*2$/ })).toHaveAttribute('href', '/cart')
  expect(screen.getByRole('button', { name: 'إزالة Nitrile Examination Gloves من السلة' })).toBeInTheDocument()
  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
})
