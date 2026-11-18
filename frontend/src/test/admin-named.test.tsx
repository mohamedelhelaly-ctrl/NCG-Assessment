import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { asAdmin, apiError, bodyOf, callsTo, json, mockApi, named, renderApp } from './helpers'

const BRANDS = 'GET /api/v1/admin/brands'

test('lists brands with both names, the product count and a note when Arabic is missing', async () => {
  mockApi(
    asAdmin({
      [BRANDS]: json([
        named(),
        named({ id: 2, name: 'PureCare', display_name: 'PureCare', name_ar: null, product_count: 0 }),
      ]),
    }),
  )
  renderApp('/admin/brands')
  expect(await screen.findByText('Nova Health / نوفا هيلث')).toBeInTheDocument()
  expect(screen.getByText('Products: 2')).toBeInTheDocument()
  expect(screen.getByText('No Arabic name')).toBeInTheDocument()
})

test('shows an empty state, and an error state that can retry', async () => {
  let fail = true
  mockApi(
    asAdmin({
      [BRANDS]: () => (fail ? apiError(500, 'http_error', 'Server error') : { body: [] }),
    }),
  )
  renderApp('/admin/brands')
  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('No brands yet. Create the first one.')).toBeInTheDocument()
})

test('shows a loading state first', async () => {
  mockApi(asAdmin({ [BRANDS]: () => new Promise(() => {}) })) // never answers
  renderApp('/admin/brands')
  expect(await screen.findByRole('heading', { name: 'Brands' })).toBeInTheDocument()
  expect(screen.getByText('Loading…')).toBeInTheDocument()
})

test('creating a brand validates first, then sends English and optional Arabic names', async () => {
  const calls = mockApi(
    asAdmin({
      [BRANDS]: json([]),
      'POST /api/v1/admin/brands': json(named(), 201),
    }),
  )
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'New brand' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByText('This field is required')).toBeInTheDocument()
  expect(callsTo(calls, 'POST /api/v1/admin/brands')).toHaveLength(0)

  // The Arabic input is right to left, and says what happens when it stays empty
  const arabic = screen.getByLabelText('Name (Arabic, optional)')
  expect(arabic).toHaveAttribute('dir', 'rtl')
  expect(screen.getByText('If left empty, the English text is shown in the Arabic view.')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Name (English)'), '  Acme  ')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Saved.')).toBeInTheDocument()
  expect(bodyOf(callsTo(calls, 'POST /api/v1/admin/brands')[0])).toEqual({ name: 'Acme', name_ar: null })
  expect(callsTo(calls, BRANDS).length).toBeGreaterThan(1) // the list reloaded
})

test('the Arabic hint disappears once Arabic text is typed', async () => {
  mockApi(asAdmin({ [BRANDS]: json([]) }))
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'New brand' }))
  const hint = 'If left empty, the English text is shown in the Arabic view.'
  expect(screen.getByText(hint)).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Name (Arabic, optional)'), 'أكمي')
  expect(screen.queryByText(hint)).not.toBeInTheDocument()
})

test('editing fills the form and saves with PUT', async () => {
  const calls = mockApi(
    asAdmin({
      [BRANDS]: json([named()]),
      'PUT /api/v1/admin/brands/1': json(named()),
    }),
  )
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  expect(screen.getByLabelText('Name (English)')).toHaveValue('Nova Health')
  expect(screen.getByLabelText('Name (Arabic, optional)')).toHaveValue('نوفا هيلث')
  await userEvent.clear(screen.getByLabelText('Name (Arabic, optional)'))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Saved.')
  expect(bodyOf(callsTo(calls, 'PUT /api/v1/admin/brands/1')[0])).toEqual({
    name: 'Nova Health',
    name_ar: null,
  })
})

test('a duplicate name is shown on the name field', async () => {
  mockApi(
    asAdmin({
      [BRANDS]: json([]),
      'POST /api/v1/admin/brands': () =>
        apiError(409, 'duplicate_name', 'A brand with this name already exists'),
    }),
  )
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'New brand' }))
  await userEvent.type(screen.getByLabelText('Name (English)'), 'Nova Health')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(screen.getByLabelText('Name (English)')).toHaveAccessibleDescription(
      'An item with this name already exists',
    ),
  )
})

test('deleting asks for confirmation, and cancelling sends nothing', async () => {
  const calls = mockApi(asAdmin({ [BRANDS]: json([named({ product_count: 0 })]) }))
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete this brand?' })
  expect(dialog).toHaveTextContent('“Nova Health” will be permanently deleted.')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(callsTo(calls, 'DELETE /api/v1/admin/brands/1')).toHaveLength(0)
})

test('Escape also closes the confirmation', async () => {
  mockApi(asAdmin({ [BRANDS]: json([named()]) }))
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('deleting a brand that is in use shows the count, in English and in Arabic', async () => {
  mockApi(
    asAdmin({
      [BRANDS]: json([named()]),
      'DELETE /api/v1/admin/brands/1': () =>
        apiError(409, 'brand_in_use', '2 products use this brand', { count: 2 }),
    }),
  )
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This brand cannot be deleted. Products using it: 2',
  )
})

test('deleting an unused brand removes it and reloads the list', async () => {
  let deleted = false
  const calls = mockApi(
    asAdmin({
      [BRANDS]: () => ({ body: deleted ? [] : [named({ product_count: 0 })] }),
      'DELETE /api/v1/admin/brands/1': () => {
        deleted = true
        return { status: 204 }
      },
    }),
  )
  renderApp('/admin/brands')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText('Deleted.')).toBeInTheDocument()
  expect(await screen.findByText('No brands yet. Create the first one.')).toBeInTheDocument()
  expect(callsTo(calls, 'DELETE /api/v1/admin/brands/1')).toHaveLength(1)
})

test('categories work the same way, with their own wording', async () => {
  const calls = mockApi(
    asAdmin({
      'GET /api/v1/admin/categories': json([named({ id: 3, name: 'Vitamins', display_name: 'Vitamins' })]),
      'POST /api/v1/admin/categories': json(named(), 201),
    }),
  )
  renderApp('/admin/categories')
  expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'New category' }))
  await userEvent.type(screen.getByLabelText('Name (English)'), 'Devices')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Saved.')
  expect(bodyOf(callsTo(calls, 'POST /api/v1/admin/categories')[0]).name).toBe('Devices')
})

test('the Arabic interface shows Arabic labels but the form still has both inputs', async () => {
  mockApi(asAdmin({ [BRANDS]: json([named()]) }))
  renderApp('/admin/brands')
  await screen.findByText('Nova Health / نوفا هيلث')
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByRole('heading', { name: 'العلامات التجارية' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'تعديل' }))
  expect(screen.getByLabelText('الاسم (بالإنجليزية)')).toHaveValue('Nova Health')
  expect(screen.getByLabelText('الاسم (بالعربية، اختياري)')).toHaveValue('نوفا هيلث')
})
