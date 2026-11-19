import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { admin, customer, healthy, mockApi, renderApp, tokenFor } from './helpers'

test('a guest is sent from /admin to the sign-in page', async () => {
  mockApi(healthy)
  renderApp('/admin')
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
})

test('signing in shows the user, stores the token and sends it on later requests', async () => {
  const calls = mockApi({
    ...healthy,
    'POST /api/v1/auth/login': () => ({ body: tokenFor(customer) }),
  })
  renderApp('/login')
  await userEvent.type(screen.getByLabelText('Email'), 'c@shop.example')
  await userEvent.type(screen.getByLabelText('Password'), 'correct-horse-1')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('Cara Customer')).toBeInTheDocument()
  expect(localStorage.getItem('auth:token')).toBe('tok')
  expect(calls.find((c) => c.key === 'POST /api/v1/auth/login')?.init?.body).toBe(
    JSON.stringify({ email: 'c@shop.example', password: 'correct-horse-1' }),
  )
})

test('a wrong password shows the server message and keeps the user signed out', async () => {
  mockApi({
    ...healthy,
    'POST /api/v1/auth/login': () => ({
      status: 401,
      body: { error: { code: 'invalid_credentials', message: 'Incorrect email or password' } },
    }),
  })
  renderApp('/login')
  await userEvent.type(screen.getByLabelText('Email'), 'c@shop.example')
  await userEvent.type(screen.getByLabelText('Password'), 'nope')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  expect(localStorage.getItem('auth:token')).toBeNull()
})

test('registering shows field errors next to the inputs', async () => {
  mockApi({
    'POST /api/v1/auth/register': () => ({
      status: 422,
      body: {
        error: {
          code: 'validation_error',
          message: 'Some fields are invalid',
          fields: { password: 'Password must be at least 10 characters' },
        },
      },
    }),
  })
  renderApp('/register')
  await userEvent.type(screen.getByLabelText('Full name'), 'Sara')
  await userEvent.type(screen.getByLabelText('Email'), 's@shop.example')
  await userEvent.type(screen.getByLabelText('Password'), 'short')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

  const password = screen.getByLabelText('Password')
  await waitFor(() => expect(password).toHaveAccessibleDescription(/at least 10 characters/i))
  expect(password).toBeInvalid()
})

test('a stored token restores the session, and a customer cannot open /admin', async () => {
  localStorage.setItem('auth:token', 'tok')
  mockApi({ ...healthy, 'GET /api/v1/auth/me': () => ({ body: customer }) })
  renderApp('/admin')
  expect(await screen.findByText('Cara Customer')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Admin area' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Manage Store' })).not.toBeInTheDocument()
})

test('an admin sees the admin link and the admin area', async () => {
  localStorage.setItem('auth:token', 'tok')
  mockApi({ ...healthy, 'GET /api/v1/auth/me': () => ({ body: admin }) })
  renderApp('/admin')
  expect(await screen.findByRole('heading', { name: 'Admin area' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Manage Store' })).toBeInTheDocument()
})

test('an expired token (401 on /auth/me) ends the session', async () => {
  localStorage.setItem('auth:token', 'old')
  mockApi({
    ...healthy,
    'GET /api/v1/auth/me': () => ({ status: 401, body: { error: { code: 'invalid_token' } } }),
  })
  renderApp('/admin')
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(localStorage.getItem('auth:token')).toBeNull()
})

test('signing out clears the token and returns to the sign-in page', async () => {
  localStorage.setItem('auth:token', 'tok')
  mockApi({ ...healthy, 'GET /api/v1/auth/me': () => ({ body: customer }) })
  renderApp('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  expect(localStorage.getItem('auth:token')).toBeNull()
})

test('the sign-in and register pages offer to continue as a guest, back to the home page', async () => {
  mockApi(healthy)
  renderApp('/login')
  expect(screen.getByRole('link', { name: 'Continue as guest' })).toHaveAttribute('href', '/')
  expect(screen.getByText('Good care starts with the right supplies.')).toBeInTheDocument()
  expect(screen.queryByText(/sold by the pack and by the bundle/)).not.toBeInTheDocument()
})

test('on smaller screens the header menu holds Manage Store, Sign out and the language', async () => {
  localStorage.setItem('auth:token', 'tok')
  mockApi({ ...healthy, 'GET /api/v1/auth/me': () => ({ body: admin }) })
  renderApp('/cart')
  const toggle = await screen.findByRole('button', { name: 'Menu' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(toggle)
  const menu = document.getElementById('header-menu') as HTMLElement
  expect(within(menu).getByRole('link', { name: 'Manage Store' })).toHaveAttribute('href', '/admin')
  expect(within(menu).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  expect(within(menu).getByRole('button', { name: 'العربية' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
  await userEvent.keyboard('{Escape}')
  expect(document.getElementById('header-menu')).toBeNull()
  // choosing an item closes the menu by moving to its page
  await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
  await userEvent.click(within(document.getElementById('header-menu') as HTMLElement).getByRole('link', { name: 'Manage Store' }))
  expect(await screen.findByRole('heading', { name: 'Admin area' })).toBeInTheDocument()
  expect(document.getElementById('header-menu')).toBeNull()
})

test('registering rejects an email that is not in email format, before any request', async () => {
  const calls = mockApi({})
  renderApp('/register')
  await userEvent.type(screen.getByLabelText('Full name'), 'Sara')
  await userEvent.type(screen.getByLabelText('Email'), 'sara@shop')
  await userEvent.type(screen.getByLabelText('Password'), 'long enough password')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/valid email address/i)
  expect(screen.getByLabelText('Email')).toBeInvalid()
  expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
})

test.each(['/login', '/register'])('%s can show and hide the password', async (path) => {
  mockApi({})
  renderApp(path)
  const password = screen.getByLabelText('Password')
  expect(password).toHaveAttribute('type', 'password')
  await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(password).toHaveAttribute('type', 'text')
  await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
  expect(password).toHaveAttribute('type', 'password')
})

test('the sign-in page shows the reviewer admin credentials, and the register page does not', async () => {
  mockApi({})
  const { unmount } = renderApp('/login')
  expect(screen.getByText('Reviewing this store?')).toBeInTheDocument()
  expect(screen.getByText('admin@example.com')).toBeInTheDocument()
  unmount()
  renderApp('/register')
  expect(screen.queryByText('Reviewing this store?')).toBeNull()
})
