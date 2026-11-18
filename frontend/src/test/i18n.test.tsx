import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { api, ApiError } from '../lib/api'
import { errorText } from '../lib/errors'
import i18n from '../lib/i18n'
import { admin, apiError, healthy, mockApi, refRoutes, json, page, renderApp } from './helpers'

const html = document.documentElement

test('the default language is English, left to right', () => {
  expect(i18n.language).toBe('en')
  expect(html.lang).toBe('en')
  expect(html.dir).toBe('ltr')
})

test('the switcher turns the whole page Arabic and right to left, and back', async () => {
  mockApi(healthy)
  renderApp('/login')
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(html.lang).toBe('ar')
  expect(html.dir).toBe('rtl')
  expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument()
  expect(screen.getByLabelText('البريد الإلكتروني')).toBeInTheDocument()
  expect(localStorage.getItem('lang')).toBe('ar')

  await userEvent.click(screen.getByRole('button', { name: 'English' }))
  expect(html.lang).toBe('en')
  expect(html.dir).toBe('ltr')
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
})

test('the switcher is available on the login and register pages and on the home page', async () => {
  mockApi(healthy)
  for (const path of ['/login', '/register', '/']) {
    const { unmount } = renderApp(path)
    expect(screen.getByRole('button', { name: 'العربية' })).toBeInTheDocument()
    unmount()
  }
})

test('the switcher button is written in the language it switches to', () => {
  mockApi(healthy)
  renderApp('/login')
  expect(screen.getByRole('button', { name: 'العربية' })).toHaveAttribute('lang', 'ar')
})

test('the page title follows the language', async () => {
  mockApi(healthy)
  renderApp('/login')
  expect(document.title).toBe('Sign in · MedicStore')
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  await waitFor(() => expect(document.title).toBe('تسجيل الدخول · MedicStore'))
})

test('the chosen language is remembered on the next visit', async () => {
  localStorage.setItem('lang', 'ar')
  vi.resetModules()
  const fresh = (await import('../lib/i18n')).default
  expect(fresh.language).toBe('ar')
  expect(html.dir).toBe('rtl')
})

test('an unknown stored language falls back to English', async () => {
  localStorage.setItem('lang', 'fr')
  vi.resetModules()
  const fresh = (await import('../lib/i18n')).default
  expect(fresh.language).toBe('en')
})

test('every API request carries the current language', async () => {
  const calls = mockApi({ 'GET /ping': json({ ok: true }) })
  await api.get('/ping')
  await i18n.changeLanguage('ar')
  await api.get('/ping')
  const languages = calls.map((c) => (c.init!.headers as Record<string, string>)['Accept-Language'])
  expect(languages).toEqual(['en', 'ar'])
})

test('switching language refetches data so names come back in the new language', async () => {
  const calls = mockApi(
    asAdminRoutes({
      'GET /api/v1/admin/products': json(page([])),
      ...refRoutes,
    }),
  )
  renderApp('/admin/products')
  await screen.findByText('No products yet. Create the first one.')
  const before = calls.filter((c) => c.key === 'GET /api/v1/admin/products').length
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  await screen.findByText('لا توجد منتجات بعد. أنشئ أول منتج.')
  expect(calls.filter((c) => c.key === 'GET /api/v1/admin/products').length).toBeGreaterThan(before)
})

function asAdminRoutes(routes: Record<string, () => { status?: number; body?: unknown }>) {
  localStorage.setItem('auth:token', 'tok')
  return { ...healthy, 'GET /api/v1/auth/me': json(admin), ...routes }
}

test('server errors are translated by code, with the server message as the fallback', async () => {
  const t = i18n.t.bind(i18n)
  const known = new ApiError(409, 'brand_in_use', 'English server text', {}, { count: 3 })
  expect(errorText(t, known)).toBe('This brand cannot be deleted. Products using it: 3')
  await i18n.changeLanguage('ar')
  expect(errorText(i18n.t.bind(i18n), known)).toBe(
    'لا يمكن حذف هذه العلامة التجارية. عدد المنتجات التي تستخدمها: 3',
  )

  const unknown = new ApiError(418, 'teapot', 'I am a teapot')
  expect(errorText(i18n.t.bind(i18n), unknown)).toBe('I am a teapot')
  expect(errorText(i18n.t.bind(i18n), new Error('boom'))).toBe('حدث خطأ ما')
})

test('a rejected login shows the translated message in each language', async () => {
  mockApi({
    ...healthy,
    'POST /api/v1/auth/login': () =>
      apiError(401, 'invalid_credentials', 'Incorrect email or password'),
  })
  renderApp('/login')
  await userEvent.type(screen.getByLabelText('Email'), 'a@shop.example')
  await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')

  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('البريد الإلكتروني أو كلمة المرور غير صحيحة')
})

test('an unknown address shows the not found page in the current language', async () => {
  mockApi(healthy)
  renderApp('/no/such/page')
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByRole('heading', { name: 'الصفحة غير موجودة' })).toBeInTheDocument()
})
