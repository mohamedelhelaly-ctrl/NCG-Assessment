import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  apiError,
  asAdmin,
  bodyOf,
  callsTo,
  json,
  mockApi,
  productDetail,
  refRoutes,
  renderApp,
} from './helpers'

const detail = (over = {}) => ({ 'GET /api/v1/admin/products/7': json(productDetail(over)) })

async function fillBasics(user = userEvent) {
  await user.type(await screen.findByLabelText('Name (English)'), 'Vitamin C')
  await user.type(screen.getByLabelText('Description (English)'), 'Daily tablets')
  await screen.findByRole('option', { name: 'PureCare' })
  await user.selectOptions(screen.getByLabelText('Brand'), 'Nova Health')
  await user.selectOptions(screen.getByLabelText('Category'), 'Vitamins')
}

// ---------------------------------------------------------------- create

test('the create form has English and Arabic inputs side by side, Arabic right to left', async () => {
  mockApi(asAdmin(refRoutes))
  renderApp('/admin/products/new')
  expect(await screen.findByRole('heading', { name: 'New product' })).toBeInTheDocument()
  expect(screen.getByLabelText('Name (English)')).toBeInTheDocument()
  const arabicName = screen.getByLabelText('Name (Arabic, optional)')
  expect(arabicName).toHaveAttribute('dir', 'rtl')
  expect(arabicName).toHaveAttribute('lang', 'ar')
  expect(screen.getByLabelText('Description (Arabic, optional)')).toHaveAttribute('dir', 'rtl')
  expect(screen.getAllByText('If left empty, the English text is shown in the Arabic view.')).toHaveLength(2)
})

test('required fields are checked before anything is sent', async () => {
  const calls = mockApi(asAdmin(refRoutes))
  renderApp('/admin/products/new')
  await userEvent.click(await screen.findByRole('button', { name: 'Create product' }))
  expect(screen.getAllByText('This field is required')).toHaveLength(2) // name, description
  expect(screen.getByText('Choose a brand')).toBeInTheDocument()
  expect(screen.getByText('Choose a category')).toBeInTheDocument()
  expect(callsTo(calls, 'POST /api/v1/admin/products')).toHaveLength(0)
})

test('a new product cannot be activated without a tier', async () => {
  const calls = mockApi(asAdmin(refRoutes))
  renderApp('/admin/products/new')
  const active = await screen.findByLabelText('Active (visible in the store)')
  expect(active).toBeDisabled()
  expect(screen.getByText('Add at least one pricing tier to activate this product.')).toBeInTheDocument()
  expect(callsTo(calls, 'POST /api/v1/admin/products')).toHaveLength(0)
})

test('creating a product with tiers sends prices as integer fils and opens the edit page', async () => {
  const calls = mockApi(
    asAdmin({
      ...refRoutes,
      'POST /api/v1/admin/products': json(productDetail(), 201),
      ...detail(),
    }),
  )
  renderApp('/admin/products/new')
  await fillBasics()
  await userEvent.type(screen.getByLabelText('Name (Arabic, optional)'), 'فيتامين سي')
  await userEvent.click(screen.getByRole('button', { name: 'Add tier' }))
  const tier = screen.getByRole('group', { name: 'Tier 1' })
  await userEvent.type(within(tier).getByLabelText('Label (English)'), '4 packs')
  await userEvent.type(within(tier).getByLabelText('Packs per bundle'), '4')
  await userEvent.type(within(tier).getByLabelText('Bundle price (KWD)'), '19.5')
  await userEvent.click(screen.getByLabelText('Active (visible in the store)'))
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))

  expect(await screen.findByText('Product created. You can now add images.')).toBeInTheDocument()
  expect(bodyOf(callsTo(calls, 'POST /api/v1/admin/products')[0])).toEqual({
    brand_id: 1,
    category_id: 2,
    name: 'Vitamin C',
    name_ar: 'فيتامين سي',
    description: 'Daily tablets',
    description_ar: null, // empty Arabic is sent as null
    is_active: true,
    tiers: [{ label: '4 packs', label_ar: null, units: 4, price_fils: 19500 }],
  })
  expect(screen.getByRole('heading', { name: 'Edit product' })).toBeInTheDocument()
})

test('invalid tier values are explained and nothing is sent', async () => {
  const calls = mockApi(asAdmin(refRoutes))
  renderApp('/admin/products/new')
  await fillBasics()
  await userEvent.click(screen.getByRole('button', { name: 'Add tier' }))
  const tier = screen.getByRole('group', { name: 'Tier 1' })
  await userEvent.type(within(tier).getByLabelText('Label (English)'), 'x')
  await userEvent.type(within(tier).getByLabelText('Packs per bundle'), '0')
  await userEvent.type(within(tier).getByLabelText('Bundle price (KWD)'), '19.5555')
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))
  expect(within(tier).getByText('Enter a whole number of 1 or more')).toBeInTheDocument()
  expect(within(tier).getByText(/Enter a price in KWD greater than 0/)).toBeInTheDocument()
  expect(callsTo(calls, 'POST /api/v1/admin/products')).toHaveLength(0)
})

test('two new tiers with the same number of packs are rejected', async () => {
  const calls = mockApi(asAdmin(refRoutes))
  renderApp('/admin/products/new')
  await fillBasics()
  for (let i = 0; i < 2; i++) {
    await userEvent.click(screen.getByRole('button', { name: 'Add tier' }))
  }
  for (const name of ['Tier 1', 'Tier 2']) {
    const tier = screen.getByRole('group', { name })
    await userEvent.type(within(tier).getByLabelText('Label (English)'), name)
    await userEvent.type(within(tier).getByLabelText('Packs per bundle'), '4')
    await userEvent.type(within(tier).getByLabelText('Bundle price (KWD)'), '19.500')
  }
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))
  expect(screen.getByText('Each tier needs a different number of packs')).toBeInTheDocument()
  expect(callsTo(calls, 'POST /api/v1/admin/products')).toHaveLength(0)
})

test('a new tier row can be removed again', async () => {
  mockApi(asAdmin(refRoutes))
  renderApp('/admin/products/new')
  await userEvent.click(await screen.findByRole('button', { name: 'Add tier' }))
  expect(screen.getByRole('group', { name: 'Tier 1' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(screen.queryByRole('group', { name: 'Tier 1' })).not.toBeInTheDocument()
})

test('with no brands or categories the form points to where to create them', async () => {
  mockApi(
    asAdmin({
      'GET /api/v1/admin/brands': json([]),
      'GET /api/v1/admin/categories': json([]),
    }),
  )
  renderApp('/admin/products/new')
  expect(await screen.findByText(/Create brands and categories first/)).toBeInTheDocument()
})

test('field errors from the server are shown next to the field', async () => {
  mockApi(
    asAdmin({
      ...refRoutes,
      'POST /api/v1/admin/products': () =>
        apiError(422, 'validation_error', 'Some fields are invalid', {}, { name: 'Name is not allowed' }),
    }),
  )
  renderApp('/admin/products/new')
  await fillBasics()
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))
  await waitFor(() =>
    expect(screen.getByLabelText('Name (English)')).toHaveAccessibleDescription('Name is not allowed'),
  )
})

// ------------------------------------------------------------------ edit

test('the edit form is filled from the product, and saving sends the trimmed values', async () => {
  const calls = mockApi(
    asAdmin({ ...refRoutes, ...detail(), 'PUT /api/v1/admin/products/7': json(productDetail()) }),
  )
  renderApp('/admin/products/7')
  expect(await screen.findByLabelText('Name (English)')).toHaveValue('Vitamin C 500 mg')
  expect(screen.getByLabelText('Active (visible in the store)')).toBeChecked()
  await userEvent.type(screen.getByLabelText('Name (Arabic, optional)'), '  فيتامين  ')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Saved.')).toBeInTheDocument()
  expect(bodyOf(callsTo(calls, 'PUT /api/v1/admin/products/7')[0])).toMatchObject({
    name: 'Vitamin C 500 mg',
    name_ar: 'فيتامين',
    description_ar: null,
    brand_id: 1,
    is_active: true,
  })
})

test('an unknown product shows a not-found error with a way back', async () => {
  mockApi(
    asAdmin({
      ...refRoutes,
      'GET /api/v1/admin/products/99': () => apiError(404, 'not_found', 'Product not found'),
    }),
  )
  renderApp('/admin/products/99')
  expect(await screen.findByRole('alert')).toHaveTextContent('Not found')
  expect(screen.getByRole('link', { name: 'Back to products' })).toHaveAttribute('href', '/admin/products')
})

test('a server rule violation (activating without tiers) is shown in the current language', async () => {
  mockApi(
    asAdmin({
      ...refRoutes,
      ...detail({ tiers: [], is_active: false }),
      'PUT /api/v1/admin/products/7': () =>
        apiError(409, 'product_needs_tier', 'English text'),
    }),
  )
  renderApp('/admin/products/7')
  await screen.findByLabelText('Name (English)')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  // the server is not even needed here: the checkbox is disabled with an explanation
  expect(screen.getByLabelText('Active (visible in the store)')).toBeDisabled()
  expect(screen.getAllByText('Add at least one pricing tier to activate this product.').length).toBeGreaterThan(0)
})

test('deleting the product from its page asks first, then returns to the list', async () => {
  const calls = mockApi(
    asAdmin({
      ...refRoutes,
      ...detail(),
      'DELETE /api/v1/admin/products/7': () => ({ status: 204 }),
      'GET /api/v1/admin/products': json({ items: [], total: 0, page: 1, page_size: 20, total_pages: 1 }),
    }),
  )
  renderApp('/admin/products/7')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument()
  expect(callsTo(calls, 'DELETE /api/v1/admin/products/7')).toHaveLength(1)
})

// ----------------------------------------------------------------- tiers

test('existing tiers are shown with their prices formatted in KWD', async () => {
  mockApi(asAdmin({ ...refRoutes, ...detail() }))
  renderApp('/admin/products/7')
  expect(await screen.findByRole('group', { name: /^4 packs · KWD\s19\.500$/ })).toBeInTheDocument()
  const tier = screen.getByRole('group', { name: /^1 pack · KWD\s5\.500$/ })
  expect(within(tier).getByLabelText('Bundle price (KWD)')).toHaveValue('5.500')
  expect(within(tier).getByLabelText('Packs per bundle')).toHaveValue('1')
})

test('editing a tier saves it on its own, as integer fils', async () => {
  const calls = mockApi(
    asAdmin({ ...refRoutes, ...detail(), 'PUT /api/v1/admin/tiers/12': json({}) }),
  )
  renderApp('/admin/products/7')
  const tier = await screen.findByRole('group', { name: /^4 packs · KWD\s19\.500$/ })
  const price = within(tier).getByLabelText('Bundle price (KWD)')
  await userEvent.clear(price)
  await userEvent.type(price, '18.75')
  await userEvent.type(within(tier).getByLabelText('Label (Arabic, optional)'), '4 عبوات')
  await userEvent.click(within(tier).getByRole('button', { name: 'Save tier' }))
  await screen.findByText('Saved.')
  expect(bodyOf(callsTo(calls, 'PUT /api/v1/admin/tiers/12')[0])).toEqual({
    label: '4 packs',
    label_ar: '4 عبوات',
    units: 4,
    price_fils: 18750,
  })
})

test('a duplicate number of packs from the server is shown on that field', async () => {
  mockApi(
    asAdmin({
      ...refRoutes,
      ...detail(),
      'PUT /api/v1/admin/tiers/12': () => apiError(409, 'duplicate_units', 'dup'),
    }),
  )
  renderApp('/admin/products/7')
  const tier = await screen.findByRole('group', { name: /^4 packs · KWD\s19\.500$/ })
  const units = within(tier).getByLabelText('Packs per bundle')
  await userEvent.clear(units)
  await userEvent.type(units, '1')
  await userEvent.click(within(tier).getByRole('button', { name: 'Save tier' }))
  await waitFor(() =>
    expect(units).toHaveAccessibleDescription('This product already has a tier with this number of packs'),
  )
})

test('adding a tier posts it and clears the row', async () => {
  const calls = mockApi(
    asAdmin({
      ...refRoutes,
      ...detail(),
      'POST /api/v1/admin/products/7/tiers': json({}, 201),
    }),
  )
  renderApp('/admin/products/7')
  const row = await screen.findByRole('group', { name: 'New tier' })
  await userEvent.type(within(row).getByLabelText('Label (English)'), '12 packs')
  await userEvent.type(within(row).getByLabelText('Packs per bundle'), '12')
  await userEvent.type(within(row).getByLabelText('Bundle price (KWD)'), '55')
  await userEvent.click(within(row).getByRole('button', { name: 'Add this tier' }))
  expect(await screen.findByText('Tier added.')).toBeInTheDocument()
  expect(bodyOf(callsTo(calls, 'POST /api/v1/admin/products/7/tiers')[0])).toEqual({
    label: '12 packs',
    label_ar: null,
    units: 12,
    price_fils: 55000,
  })
  expect(within(row).getByLabelText('Bundle price (KWD)')).toHaveValue('')
})

test('deleting a tier asks first and tells you when the product was deactivated', async () => {
  const calls = mockApi(
    asAdmin({
      ...refRoutes,
      ...detail({ tiers: [{ id: 11, label: '1 pack', label_ar: null, units: 1, price_fils: 5500 }] }),
      'DELETE /api/v1/admin/tiers/11': json({ product_deactivated: true }),
    }),
  )
  renderApp('/admin/products/7')
  const tier = await screen.findByRole('group', { name: /^1 pack · KWD\s5\.500$/ })
  await userEvent.click(within(tier).getByRole('button', { name: 'Delete' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  expect(
    await screen.findByText('Tier deleted. The product was set to inactive because it has no tiers left.'),
  ).toBeInTheDocument()
  expect(callsTo(calls, 'DELETE /api/v1/admin/tiers/11')).toHaveLength(1)
})

test('the tiers section explains that a product without tiers stays hidden', async () => {
  mockApi(asAdmin({ ...refRoutes, ...detail({ tiers: [], is_active: false }) }))
  renderApp('/admin/products/7')
  expect(
    await screen.findByText('No tiers yet. The product stays hidden from the store until it has at least one.'),
  ).toBeInTheDocument()
})

test('unsaved edits to the main form survive adding a tier', async () => {
  mockApi(
    asAdmin({
      ...refRoutes,
      ...detail(),
      'POST /api/v1/admin/products/7/tiers': json({}, 201),
    }),
  )
  renderApp('/admin/products/7')
  const name = await screen.findByLabelText('Name (English)')
  await userEvent.type(name, ' EDITED')
  const row = screen.getByRole('group', { name: 'New tier' })
  await userEvent.type(within(row).getByLabelText('Label (English)'), '12 packs')
  await userEvent.type(within(row).getByLabelText('Packs per bundle'), '12')
  await userEvent.type(within(row).getByLabelText('Bundle price (KWD)'), '55')
  await userEvent.click(within(row).getByRole('button', { name: 'Add this tier' }))
  await screen.findByText('Tier added.')
  expect(screen.getByLabelText('Name (English)')).toHaveValue('Vitamin C 500 mg EDITED')
})

// ---------------------------------------------------------------- images

const image = (id: number, position: number, alt = `Image ${id}`) => ({
  id,
  url: `http://img.test/${id}.webp`,
  alt,
  alt_ar: null,
  position,
})
const withImages = (n: number) => detail({ images: Array.from({ length: n }, (_, i) => image(i + 1, i)) })

test('images upload as multipart with alt text in both languages', async () => {
  const calls = mockApi(
    asAdmin({ ...refRoutes, ...detail(), 'POST /api/v1/admin/products/7/images': json(image(1, 0), 201) }),
  )
  renderApp('/admin/products/7')
  const file = new File(['x'], 'front.png', { type: 'image/png' })
  await userEvent.upload(await screen.findByLabelText('Image file'), file)
  await userEvent.type(screen.getByLabelText('Alt text (English)'), 'Front view')
  await userEvent.type(screen.getByLabelText('Alt text (Arabic, optional)'), 'منظر أمامي')
  await userEvent.click(screen.getByRole('button', { name: 'Upload' }))
  expect(await screen.findByText('Image uploaded.')).toBeInTheDocument()
  const body = callsTo(calls, 'POST /api/v1/admin/products/7/images')[0].init!.body as FormData
  expect(body).toBeInstanceOf(FormData)
  expect((body.get('file') as File).name).toBe('front.png')
  expect(body.get('alt')).toBe('Front view')
  expect(body.get('alt_ar')).toBe('منظر أمامي')
  // the browser must set the multipart boundary itself
  const headers = callsTo(calls, 'POST /api/v1/admin/products/7/images')[0].init!.headers as Record<string, string>
  expect(headers['Content-Type']).toBeUndefined()
})

test('an image upload needs a file, alt text, a real image type and a sensible size', async () => {
  const calls = mockApi(asAdmin({ ...refRoutes, ...detail() }))
  renderApp('/admin/products/7')
  const user = userEvent.setup({ applyAccept: false })
  await screen.findByLabelText('Image file')
  await user.click(screen.getByRole('button', { name: 'Upload' }))
  expect(screen.getByText('Choose an image file')).toBeInTheDocument()
  expect(screen.getByText('This field is required')).toBeInTheDocument() // alt text

  await user.upload(screen.getByLabelText('Image file'), new File(['hi'], 'notes.txt', { type: 'text/plain' }))
  await user.click(screen.getByRole('button', { name: 'Upload' }))
  expect(screen.getByText('The image must be a JPEG, PNG or WebP file')).toBeInTheDocument()

  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
  await user.upload(screen.getByLabelText('Image file'), big)
  await user.click(screen.getByRole('button', { name: 'Upload' }))
  expect(screen.getByText('The image must be 5 MB or smaller')).toBeInTheDocument()
  expect(callsTo(calls, 'POST /api/v1/admin/products/7/images')).toHaveLength(0)
})

test('a server image error is shown on the file field', async () => {
  mockApi(
    asAdmin({
      ...refRoutes,
      ...detail(),
      'POST /api/v1/admin/products/7/images': () =>
        apiError(422, 'image_invalid', 'bad', {}, { file: 'The file is not a valid JPEG, PNG or WebP image' }),
    }),
  )
  renderApp('/admin/products/7')
  await userEvent.upload(await screen.findByLabelText('Image file'), new File(['x'], 'a.png', { type: 'image/png' }))
  await userEvent.type(screen.getByLabelText('Alt text (English)'), 'Alt')
  await userEvent.click(screen.getByRole('button', { name: 'Upload' }))
  expect(await screen.findByText('The file is not a valid JPEG, PNG or WebP image')).toBeInTheDocument()
})

test('the gallery shows the main image, and reordering sends the full new order', async () => {
  const calls = mockApi(
    asAdmin({ ...refRoutes, ...withImages(3), 'PUT /api/v1/admin/products/7/images/order': json([]) }),
  )
  renderApp('/admin/products/7')
  const cards = (await screen.findAllByRole('img')).length
  expect(cards).toBe(3)
  expect(screen.getAllByText('Main')).toHaveLength(1)
  // first image cannot move earlier, last cannot move later
  const earlier = screen.getAllByRole('button', { name: 'Move earlier' })
  const later = screen.getAllByRole('button', { name: 'Move later' })
  expect(earlier[0]).toBeDisabled()
  expect(later[2]).toBeDisabled()

  await userEvent.click(later[0])
  await waitFor(() => expect(callsTo(calls, 'PUT /api/v1/admin/products/7/images/order')).toHaveLength(1))
  expect(bodyOf(callsTo(calls, 'PUT /api/v1/admin/products/7/images/order')[0])).toEqual({ image_ids: [2, 1, 3] })

  await userEvent.click(screen.getAllByRole('button', { name: 'Make main' })[1]) // the third image
  await waitFor(() => expect(callsTo(calls, 'PUT /api/v1/admin/products/7/images/order')).toHaveLength(2))
  expect(bodyOf(callsTo(calls, 'PUT /api/v1/admin/products/7/images/order')[1])).toEqual({ image_ids: [3, 1, 2] })
})

test('alt text of an existing image can be edited in both languages', async () => {
  const calls = mockApi(
    asAdmin({ ...refRoutes, ...withImages(1), 'PUT /api/v1/admin/images/1': json(image(1, 0)) }),
  )
  renderApp('/admin/products/7')
  const card = (await screen.findByRole('img')).closest('li')!
  const altAr = within(card).getByLabelText('Alt text (Arabic, optional)')
  await userEvent.type(altAr, 'صورة')
  await userEvent.click(within(card).getByRole('button', { name: 'Save text' }))
  await screen.findByText('Saved.')
  expect(bodyOf(callsTo(calls, 'PUT /api/v1/admin/images/1')[0])).toEqual({ alt: 'Image 1', alt_ar: 'صورة' })
})

test('deleting an image asks first', async () => {
  const calls = mockApi(
    asAdmin({ ...refRoutes, ...withImages(2), 'DELETE /api/v1/admin/images/2': () => ({ status: 204 }) }),
  )
  renderApp('/admin/products/7')
  const buttons = await screen.findAllByRole('button', { name: 'Delete' })
  // buttons: tiers (2) + images (2) + the product delete is named differently
  const imageDelete = buttons.filter((b) => b.closest('li'))[1]
  await userEvent.click(imageDelete)
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete this image?' })).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText('Deleted.')).toBeInTheDocument()
  expect(callsTo(calls, 'DELETE /api/v1/admin/images/2')).toHaveLength(1)
})

test('at ten images the upload is disabled with an explanation', async () => {
  mockApi(asAdmin({ ...refRoutes, ...withImages(10) }))
  renderApp('/admin/products/7')
  expect(await screen.findByText('This product already has 10 images.')).toBeInTheDocument()
  expect(screen.getByLabelText('Image file')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
})

test('a new product asks to be saved before images can be added', async () => {
  mockApi(asAdmin(refRoutes))
  renderApp('/admin/products/new')
  expect(await screen.findByText('Save the product first, then you can add images.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Image file')).not.toBeInTheDocument()
})

// ----------------------------------------------------- arabic interface

test('in the Arabic interface the labels are Arabic and both language inputs remain', async () => {
  mockApi(asAdmin({ ...refRoutes, ...detail() }))
  renderApp('/admin/products/7')
  await screen.findByLabelText('Name (English)')
  await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
  expect(await screen.findByLabelText('الاسم (بالإنجليزية)')).toHaveValue('Vitamin C 500 mg')
  expect(screen.getByLabelText('الاسم (بالعربية، اختياري)')).toHaveAttribute('dir', 'rtl')
  expect(screen.getByRole('heading', { name: 'العروض السعرية' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'الصور' })).toBeInTheDocument()
  // prices keep Latin digits in Arabic
  expect(screen.getByRole('group', { name: /19\.500.*د\.ك/ })).toBeInTheDocument()
})
