import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  admin,
  apiError,
  callsTo,
  cartLine,
  customer,
  healthy,
  json,
  localLines,
  mockApi,
  quoteHandler,
  renderApp,
  seedLocalCart,
  serverCart,
  storeDetail,
  tier,
  tokenFor,
} from './helpers'
import type { Handler } from './helpers'

const QUOTE = 'POST /api/v1/cart/quote'
const GET = 'GET /api/v1/me/cart'
const PUT = 'PUT /api/v1/me/cart'
const MERGE = 'POST /api/v1/me/cart/merge'

const gloves4 = (n: number) => cartLine(7, 12, n)
const gauze4 = (n: number) => cartLine(15, 41, n)

/** A signed-in browser: a stored token, the account and its cart on the server. */
function signedIn(initial: ReturnType<typeof cartLine>[], extra: Record<string, Handler> = {}) {
  localStorage.setItem('auth:token', 'tok')
  const server = serverCart(initial)
  const calls = mockApi({
    ...healthy,
    'GET /api/v1/auth/me': json(customer),
    ...server.routes,
    [QUOTE]: quoteHandler(),
    ...extra,
  })
  return { calls, server }
}

async function signInThroughTheForm() {
  await userEvent.type(await screen.findByLabelText('Email'), 'c@shop.example')
  await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-1')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

const cartLink = () => screen.findByRole('link', { name: /^Cart\s*\d+$/ })

// ------------------------------------------------------------------- guests

test('a guest cart never touches the server', async () => {
  seedLocalCart([gloves4(2)])
  const calls = mockApi({ ...healthy, [QUOTE]: quoteHandler() })
  renderApp('/cart')
  await screen.findByText('2 × 4 packs')
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  await screen.findByText('3 × 4 packs')
  expect(calls.filter((c) => c.url.pathname.includes('/me/cart'))).toHaveLength(0)
})

// ------------------------------------------------------------- signing in

test('signing in merges the guest cart into the account in one request and clears the local copy', async () => {
  seedLocalCart([gloves4(2), gauze4(1)])
  const server = serverCart([gloves4(1), cartLine(7, 13, 4)]) // the account already has some bundles
  const calls = mockApi({
    ...healthy,
    'POST /api/v1/auth/login': json(tokenFor(customer)),
    ...server.routes,
    [QUOTE]: quoteHandler(),
  })
  renderApp('/login')
  await signInThroughTheForm()

  // the account's cart is fetched first, then the guest cart merged in a single request
  await waitFor(() => expect(callsTo(calls, MERGE)).toHaveLength(1))
  const keys = calls.map((c) => c.key).filter((k) => k.includes('/me/cart'))
  expect(keys).toEqual([GET, MERGE])
  const sent = JSON.parse(String(callsTo(calls, MERGE)[0].init!.body))
  expect(sent.lines).toEqual([gloves4(2), gauze4(1)])
  expect(typeof sent.merge_id).toBe('string') // identifies this guest cart, so a retry is safe

  // same offer: bundles added together; another offer: a new line; the account's own lines stay
  expect(server.state.lines).toEqual([gloves4(3), cartLine(7, 13, 4), gauze4(1)])
  expect(localLines()).toEqual([]) // cleared only after the merge worked
  await waitFor(async () => expect((await cartLink()).textContent).toContain('8')) // 3 + 4 + 1
  expect(callsTo(calls, PUT)).toHaveLength(0) // nothing is written back after a merge
})

test('signing in with an empty guest cart just loads the account cart', async () => {
  const server = serverCart([gloves4(2)])
  const calls = mockApi({
    ...healthy,
    'POST /api/v1/auth/login': json(tokenFor(customer)),
    ...server.routes,
    [QUOTE]: quoteHandler(),
  })
  renderApp('/login')
  await signInThroughTheForm()
  await waitFor(async () => expect((await cartLink()).textContent).toContain('2'))
  expect(callsTo(calls, MERGE)).toHaveLength(0)
  expect(callsTo(calls, GET)).toHaveLength(1)
  expect(callsTo(calls, PUT)).toHaveLength(0)
})

test('the guest cart is merged only once, even when React runs effects twice (development)', async () => {
  seedLocalCart([gloves4(2)])
  const server = serverCart([])
  const calls = mockApi({
    ...healthy,
    'POST /api/v1/auth/login': json(tokenFor(customer)),
    ...server.routes,
  })
  renderApp('/login', { strict: true })
  await signInThroughTheForm()
  await waitFor(() => expect(localLines()).toEqual([]))
  expect(callsTo(calls, MERGE)).toHaveLength(1)
  expect(server.state.lines).toEqual([gloves4(2)]) // not 4: no double merge
})

test('registering also brings the guest cart into the new account', async () => {
  seedLocalCart([gloves4(1)])
  const server = serverCart([])
  const calls = mockApi({
    ...healthy,
    'POST /api/v1/auth/register': () => ({ status: 201, body: tokenFor(customer) }),
    ...server.routes,
  })
  renderApp('/register')
  await userEvent.type(await screen.findByLabelText('Full name'), 'Cara')
  await userEvent.type(screen.getByLabelText('Email'), 'c@shop.example')
  await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-1')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  await waitFor(() => expect(callsTo(calls, MERGE)).toHaveLength(1))
  expect(server.state.lines).toEqual([gloves4(1)])
})

// --------------------------------------------- a lost answer must not merge twice

test('the merge carries the id that was stored with the guest cart', async () => {
  seedLocalCart([gloves4(2)])
  localStorage.setItem('cart:v1', JSON.stringify({ owner: null, lines: [gloves4(2)], merge_id: 'guest-cart-abc123' }))
  const server = serverCart([])
  const calls = mockApi({ ...healthy, 'POST /api/v1/auth/login': json(tokenFor(customer)), ...server.routes })
  renderApp('/login')
  await signInThroughTheForm()
  await waitFor(() => expect(callsTo(calls, MERGE)).toHaveLength(1))
  expect(JSON.parse(String(callsTo(calls, MERGE)[0].init!.body)).merge_id).toBe('guest-cart-abc123')
})

test('an older guest cart without an id still merges, with a new id that is kept for retries', async () => {
  seedLocalCart([gloves4(2)]) // the shape before merge ids existed
  const server = serverCart([])
  const calls = mockApi({
    ...healthy,
    'POST /api/v1/auth/login': json(tokenFor(customer)),
    ...server.routes,
    [MERGE]: () => apiError(500, 'http_error', 'down'),
  })
  renderApp('/login')
  await signInThroughTheForm()
  await waitFor(() => expect(callsTo(calls, MERGE)).toHaveLength(1))
  const sent = JSON.parse(String(callsTo(calls, MERGE)[0].init!.body))
  expect(sent.merge_id).toBeTruthy()
  expect(JSON.parse(localStorage.getItem('cart:v1')!).merge_id).toBe(sent.merge_id) // kept for the retry
})

test('if the server merged but its answer was lost, the retry does not add the bundles again', async () => {
  seedLocalCart([gloves4(2)])
  const server = serverCart([gloves4(1)])
  let lose = true
  const calls = mockApi({
    ...healthy,
    'POST /api/v1/auth/login': json(tokenFor(customer)),
    ...server.routes,
    [QUOTE]: quoteHandler(),
    [MERGE]: (init, url) => {
      const result = server.routes[MERGE](init, url) // the server DID merge...
      return lose ? apiError(500, 'http_error', 'the answer never arrived') : result // ...but the browser never heard
    },
  })
  renderApp('/login')
  await signInThroughTheForm()
  await waitFor(() => expect(server.state.lines).toEqual([gloves4(3)])) // 1 + 2, merged once
  await waitFor(() => expect(localLines()).toEqual([gloves4(2)])) // the guest cart is still here: it never heard

  lose = false
  await userEvent.click(await screen.findByRole('link', { name: /^Cart/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(localLines()).toEqual([]))
  expect(callsTo(calls, MERGE)).toHaveLength(2)
  expect(server.state.lines).toEqual([gloves4(3)]) // 3, not 5
  expect(server.state.merges).toBe(1) // the second request was recognised as a replay
  expect(await screen.findByText('3 × 4 packs')).toBeInTheDocument()
})

// ------------------------------------------------ nothing is saved before the first load

test('nothing is saved to the server before the account cart has been fetched', async () => {
  seedLocalCart([gloves4(1)])
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const server = serverCart([gauze4(5)])
  localStorage.setItem('auth:token', 'tok')
  const calls = mockApi({
    ...healthy,
    'GET /api/v1/auth/me': json(customer),
    ...server.routes,
    [GET]: async () => {
      await gate
      return { body: { lines: server.state.lines } }
    },
    'GET /api/v1/products/7': json(storeDetail({ tiers: [tier(11, 1, 5500), tier(12, 4, 19500)] })),
  })
  renderApp('/products/7')
  const add = await screen.findByRole('button', { name: 'Add to cart' })
  await waitFor(() => expect(add).toBeDisabled()) // changes wait while the account cart loads
  await userEvent.click(add)
  expect(callsTo(calls, PUT)).toHaveLength(0)
  expect(callsTo(calls, MERGE)).toHaveLength(0)

  release()
  await waitFor(() => expect(add).toBeEnabled())
  expect(callsTo(calls, PUT)).toHaveLength(0) // merging the guest cart is not a save of an empty cart
  expect(server.state.lines).toEqual([gauze4(5), gloves4(1)].map((l) => l)) // the account's cart survived
})

test('an empty local cart can never wipe the account cart', async () => {
  const { calls, server } = signedIn([gloves4(2), gauze4(1)])
  renderApp('/')
  await cartLink()
  await new Promise((r) => setTimeout(r, 600)) // longer than the save delay
  expect(callsTo(calls, PUT)).toHaveLength(0)
  expect(server.state.lines).toHaveLength(2)
})

// -------------------------------------------------------------- restoring a session

test('opening the site with a saved login loads the account cart', async () => {
  const { calls } = signedIn([gloves4(2)])
  renderApp('/cart')
  expect(await screen.findByText('2 × 4 packs')).toBeInTheDocument()
  expect(calls.map((c) => c.key).filter((k) => k.includes('/me/cart') || k.includes('auth/me'))).toEqual([
    'GET /api/v1/auth/me',
    GET,
  ])
})

// ------------------------------------------------------------------- saving edits

test('a signed-in change is saved to the server as the whole cart, after a short pause', async () => {
  const { calls, server } = signedIn([gloves4(2), gauze4(1)])
  renderApp('/cart')
  await screen.findByText('2 × 4 packs')
  await userEvent.click(within(screen.getByText('2 × 4 packs').closest('li')!).getByRole('button', { name: 'More bundles' }))
  expect(callsTo(calls, PUT)).toHaveLength(0) // not on the click itself
  await waitFor(() => expect(callsTo(calls, PUT)).toHaveLength(1))
  expect(JSON.parse(String(callsTo(calls, PUT)[0].init!.body))).toEqual({ lines: [gloves4(3), gauze4(1)] })
  expect(server.state.lines).toEqual([gloves4(3), gauze4(1)])
  expect(await screen.findByText('Saved to your account.')).toBeInTheDocument()
  expect(localLines()).toEqual([]) // a signed-in cart is not kept in the browser as well
})

test('several quick changes are sent as one save with the latest cart', async () => {
  const { calls, server } = signedIn([gloves4(1)])
  renderApp('/cart')
  await screen.findByText('1 × 4 packs')
  const plus = screen.getByRole('button', { name: 'More bundles' })
  await userEvent.click(plus)
  await userEvent.click(plus)
  await userEvent.click(plus)
  await waitFor(() => expect(callsTo(calls, PUT)).toHaveLength(1))
  expect(server.state.lines).toEqual([gloves4(4)])
  expect(callsTo(calls, PUT)).toHaveLength(1)
})

test('shows "Saving…" while a change is waiting or on its way, then "Saved"', async () => {
  signedIn([gloves4(1)])
  renderApp('/cart')
  await screen.findByText('Saved to your account.')
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  expect(await screen.findByText('Saving…')).toBeInTheDocument()
  expect(await screen.findByText('Saved to your account.')).toBeInTheDocument()
})

test('a change made during a save is sent straight after it, never at the same time', async () => {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  let running = 0
  let overlap = false
  const server = serverCart([gloves4(1)])
  localStorage.setItem('auth:token', 'tok')
  const calls = mockApi({
    ...healthy,
    'GET /api/v1/auth/me': json(customer),
    ...server.routes,
    [PUT]: async (init, url) => {
      running += 1
      if (running > 1) overlap = true
      if (callsTo(calls, PUT).length === 1) await gate // hold the first save open
      const result = server.routes[PUT](init, url)
      running -= 1
      return result
    },
    [QUOTE]: quoteHandler(),
  })
  renderApp('/cart')
  await screen.findByText('1 × 4 packs')
  const plus = screen.getByRole('button', { name: 'More bundles' })
  await userEvent.click(plus)
  await waitFor(() => expect(callsTo(calls, PUT)).toHaveLength(1)) // first save is now waiting on the gate
  await userEvent.click(plus)
  await new Promise((r) => setTimeout(r, 600)) // the second change's timer has fired
  expect(callsTo(calls, PUT)).toHaveLength(1) // ...but it waits for the first save
  release()
  await waitFor(() => expect(callsTo(calls, PUT)).toHaveLength(2))
  expect(JSON.parse(String(callsTo(calls, PUT)[1].init!.body))).toEqual({ lines: [gloves4(3)] })
  await waitFor(() => expect(server.state.lines).toEqual([gloves4(3)]))
  expect(overlap).toBe(false)
})

test('removing the last line saves an empty cart', async () => {
  const { server } = signedIn([gloves4(1)])
  renderApp('/cart')
  await userEvent.click(await screen.findByRole('button', { name: /^Remove Nitrile/ }))
  expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  await waitFor(() => expect(server.state.lines).toEqual([]))
})

test('adding from a product page while signed in saves to the account', async () => {
  const { server } = signedIn([gauze4(2)], {
    'GET /api/v1/products/7': json(storeDetail({ tiers: [tier(11, 1, 5500), tier(12, 4, 19500)] })),
  })
  renderApp('/products/7')
  const add = await screen.findByRole('button', { name: 'Add to cart' })
  await waitFor(() => expect(add).toBeEnabled())
  await userEvent.click(add)
  await waitFor(() => expect(server.state.lines).toEqual([gauze4(2), cartLine(7, 11, 1)]))
})

// ---------------------------------------------------------------------- failures

test('a failed save reloads what the server has, says so, and offers a retry', async () => {
  let fail = true
  const server = serverCart([gloves4(2)])
  localStorage.setItem('auth:token', 'tok')
  mockApi({
    ...healthy,
    'GET /api/v1/auth/me': json(customer),
    ...server.routes,
    [PUT]: (init, url) => (fail ? apiError(500, 'http_error', 'Server error') : server.routes[PUT](init, url)),
    [QUOTE]: quoteHandler(),
  })
  renderApp('/cart')
  await screen.findByText('2 × 4 packs')
  await userEvent.click(screen.getByRole('button', { name: 'More bundles' }))
  expect(await screen.findByText(/We couldn't save your cart/)).toBeInTheDocument()
  // what is on screen is again what the server has
  expect(await screen.findByText('2 × 4 packs')).toBeInTheDocument()
  fail = false
  await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Saved to your account.')).toBeInTheDocument()
})

test('a failed load of the account cart is explained and can be retried', async () => {
  let fail = true
  const server = serverCart([gloves4(2)])
  localStorage.setItem('auth:token', 'tok')
  mockApi({
    ...healthy,
    'GET /api/v1/auth/me': json(customer),
    ...server.routes,
    [GET]: (init, url) => (fail ? apiError(500, 'http_error', 'Server error') : server.routes[GET](init, url)),
    [QUOTE]: quoteHandler(),
  })
  renderApp('/cart')
  expect(await screen.findByText("We couldn't load your cart.")).toBeInTheDocument()
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('2 × 4 packs')).toBeInTheDocument()
})

test('a failed merge keeps the guest cart so nothing is lost, and a retry merges it', async () => {
  seedLocalCart([gloves4(2)])
  let fail = true
  const server = serverCart([])
  mockApi({
    ...healthy,
    'POST /api/v1/auth/login': json(tokenFor(customer)),
    ...server.routes,
    [MERGE]: (init, url) => (fail ? apiError(500, 'http_error', 'Server error') : server.routes[MERGE](init, url)),
    [QUOTE]: quoteHandler(),
  })
  renderApp('/login')
  await signInThroughTheForm()
  await waitFor(() => expect(localLines()).toEqual([gloves4(2)])) // still there
  fail = false
  await userEvent.click(await screen.findByRole('link', { name: /^Cart/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(localLines()).toEqual([]))
  expect(server.state.lines).toEqual([gloves4(2)])
})

// --------------------------------------------------------------------- signing out

test('signing out empties the cart on screen and in this browser, and the account keeps its cart', async () => {
  const { server } = signedIn([gloves4(2)])
  renderApp('/cart')
  await screen.findByText('2 × 4 packs')
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /^Cart\s*\d/ })).not.toBeInTheDocument()
  expect(localLines()).toEqual([])
  expect(server.state.lines).toEqual([gloves4(2)]) // still saved for the next sign-in
})

test('an expired session leaves a guest with an empty cart, not the old account cart', async () => {
  localStorage.setItem('auth:token', 'old')
  mockApi({
    ...healthy,
    'GET /api/v1/auth/me': () => apiError(401, 'invalid_token', 'expired'),
    [QUOTE]: quoteHandler(),
  })
  renderApp('/cart')
  expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  expect(localStorage.getItem('auth:token')).toBeNull()
  expect(localLines()).toEqual([])
})

test('after signing out, the same browser starts with an empty cart for the next visitor', async () => {
  signedIn([gloves4(2)])
  renderApp('/cart')
  await screen.findByText('2 × 4 packs')
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByRole('heading', { name: 'Sign in' })
  await userEvent.click(screen.getByRole('link', { name: 'Create one' }))
  expect(localLines()).toEqual([])
})

test('an admin has a cart too', async () => {
  localStorage.setItem('auth:token', 'tok')
  const server = serverCart([gloves4(1)])
  mockApi({ ...healthy, 'GET /api/v1/auth/me': json(admin), ...server.routes, [QUOTE]: quoteHandler() })
  renderApp('/cart')
  expect(await screen.findByText('1 × 4 packs')).toBeInTheDocument()
})
