import { screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { topBundles } from '../lib/pricing'
import type { StoreProduct } from '../lib/types'
import { healthy, mockApi, renderApp, storeProduct, storeRoutes, tier } from './helpers'

// gloves: 12 packs at 4.583 a pack against 5.500 = 17% off; the others are set up around it
const gloves = storeProduct()
const masks = storeProduct({
  id: 8,
  name: 'Face Masks',
  tiers: [tier(21, 1, 2000), tier(22, 10, 10000)], // 50% off
})
const tape = storeProduct({
  id: 9,
  name: 'Adhesive Tape',
  tiers: [tier(31, 1, 1000), tier(32, 4, 3600)], // 10% off
})
const scales = storeProduct({ id: 10, name: 'Weighing Scales', tiers: [tier(41, 1, 15750)] }) // one bundle
const gauze = storeProduct({
  id: 11,
  name: 'Gauze Pads',
  tiers: [tier(51, 1, 1000), tier(52, 2, 1900)], // 5% off
})

test('top bundles are the three biggest savings per pack; a single-bundle product never shows', () => {
  const top = topBundles([gloves, masks, tape, scales, gauze] as StoreProduct[])
  expect(top.map((x) => x.product.name)).toEqual(['Face Masks', 'Nitrile Examination Gloves', 'Adhesive Tape'])
  expect(top.map((x) => x.saving)).toEqual([50, 17, 10])
  expect(top[0].tier.units).toBe(10) // the best-value bundle, not the first one
})

test('the home page has the store name, the tagline and a Shop now button to the catalogue', async () => {
  mockApi({ ...healthy, ...storeRoutes([gloves, masks, tape]) })
  renderApp('/')
  expect(screen.getByRole('heading', { level: 1, name: 'MedicStore' })).toBeInTheDocument()
  expect(screen.getByText('Everything you need, delivered with care.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', '/shop')
  await waitFor(() => expect(document.title).toBe('Medical supplies · MedicStore'))
})

test('each top bundle card shows its bundle, price per pack and saving, and opens the product', async () => {
  mockApi({ ...healthy, ...storeRoutes([gloves, masks, tape, scales]) })
  renderApp('/')
  const list = await screen.findByRole('list')
  const cards = within(list).getAllByRole('link')
  expect(cards).toHaveLength(3)
  expect(cards[0]).toHaveAttribute('href', '/products/8')
  expect(cards[0]).toHaveTextContent('10 packs for KWD')
  expect(cards[0]).toHaveTextContent(/KWD\s1\.000 per pack/)
  expect(cards[0]).toHaveTextContent('Save 50%')
})

test('the header links to the shop, the home page and the cart, and the footer says it is a demo', async () => {
  mockApi({ ...healthy, ...storeRoutes([gloves]) })
  renderApp('/')
  const banner = within(screen.getByRole('banner'))
  expect(banner.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop')
  expect(banner.getByRole('link', { name: 'MedicStore home' })).toHaveAttribute('href', '/')
  expect(banner.getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '/cart')
  expect(banner.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    `MedicStore · ${new Date().getFullYear()} · Demo store, no real orders.`,
  )
})
