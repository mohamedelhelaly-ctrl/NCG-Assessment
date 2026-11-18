import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import ImageSection from '../../components/admin/ImageSection'
import TierDraftSection from '../../components/admin/TierDraftSection'
import TierSection from '../../components/admin/TierSection'
import Field from '../../components/common/Field'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { ErrorState, LoadingState, Notice } from '../../components/ui/Feedback'
import { useApi } from '../../hooks/useApi'
import { usePageTitle } from '../../hooks/usePageTitle'
import { api, ApiError } from '../../lib/api'
import { errorText } from '../../lib/errors'
import { validateTier } from '../../lib/tiers'
import type { TierDraft, TierErrors } from '../../lib/tiers'
import type { NamedAdmin, ProductAdmin, ProductPayload } from '../../lib/types'

interface FormState {
  name: string
  name_ar: string
  description: string
  description_ar: string
  brand_id: string
  category_id: string
  is_active: boolean
}

const EMPTY: FormState = {
  name: '',
  name_ar: '',
  description: '',
  description_ar: '',
  brand_id: '',
  category_id: '',
  is_active: false,
}

const fromProduct = (p: ProductAdmin): FormState => ({
  name: p.name,
  name_ar: p.name_ar ?? '',
  description: p.description,
  description_ar: p.description_ar ?? '',
  brand_id: String(p.brand_id),
  category_id: String(p.category_id),
  is_active: p.is_active,
})

export default function ProductFormPage() {
  const { id } = useParams()
  return id ? <EditProduct id={Number(id)} /> : <ProductForm product={null} onSaved={() => {}} />
}

function EditProduct({ id }: { id: number }) {
  const { t } = useTranslation()
  const location = useLocation()
  const product = useApi(`product-${id}`, () => api.get<ProductAdmin>(`/api/v1/admin/products/${id}`))
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null,
  )

  if (product.loading && !product.data) return <LoadingState />
  if (!product.data) {
    return (
      <div className="space-y-3">
        <ErrorState message={errorText(t, product.error)} onRetry={product.reload} />
        <Link to="/admin/products" className="underline">
          {t('admin.form.backToList')}
        </Link>
      </div>
    )
  }
  return (
    <ProductForm
      product={product.data}
      flash={flash}
      onSaved={(message) => {
        setFlash(message ?? null)
        product.reload()
      }}
    />
  )
}

function ProductForm({
  product,
  flash,
  onSaved,
}: {
  product: ProductAdmin | null
  flash?: string | null
  onSaved: (message?: string) => void
}) {
  const { t } = useTranslation()
  usePageTitle(product ? 'admin.form.editTitle' : 'admin.form.createTitle')
  const navigate = useNavigate()
  const brands = useApi('form-brands', () => api.get<NamedAdmin[]>('/api/v1/admin/brands'))
  const categories = useApi('form-categories', () =>
    api.get<NamedAdmin[]>('/api/v1/admin/categories'),
  )

  const [form, setForm] = useState<FormState>(product ? fromProduct(product) : EMPTY)
  const [drafts, setDrafts] = useState<TierDraft[]>([])
  const [tierErrors, setTierErrors] = useState<Record<string, TierErrors>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  // Re-sync only when the product itself changed (saved, or deactivated after its last tier was
  // deleted). Changing tiers or images does not touch updated_at, so unsaved edits are kept.
  const syncKey = product ? `${product.id}:${product.updated_at}` : 'new'
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    // Adjusting state while rendering is React's documented way to reset state on a prop change.
    setSyncedKey(syncKey)
    if (product) setForm(fromProduct(product))
  }

  const tierCount = product ? product.tiers.length : drafts.length
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    const limits: [keyof FormState, number][] = [
      ['name', 200],
      ['name_ar', 200],
      ['description', 5000],
      ['description_ar', 5000],
    ]
    if (!form.name.trim()) next.name = t('validation.required')
    if (!form.description.trim()) next.description = t('validation.required')
    for (const [key, max] of limits) {
      if (String(form[key]).trim().length > max) next[key] = t('validation.maxLength', { max })
    }
    if (!form.brand_id) next.brand_id = t('validation.selectBrand')
    if (!form.category_id) next.category_id = t('validation.selectCategory')
    return next
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next = validate()
    const payload: ProductPayload = {
      brand_id: Number(form.brand_id),
      category_id: Number(form.category_id),
      name: form.name.trim(),
      name_ar: form.name_ar.trim() || null,
      description: form.description.trim(),
      description_ar: form.description_ar.trim() || null,
      is_active: form.is_active,
    }

    // New products can carry their tiers; validate those too.
    const tiers = []
    const tierProblems: Record<string, TierErrors> = {}
    if (!product) {
      const seen = new Set<number>()
      for (const draft of drafts) {
        const { errors: found, value } = validateTier(draft, t)
        if (value) {
          if (seen.has(value.units)) found.units = t('validation.duplicateUnits')
          else seen.add(value.units)
          tiers.push(value)
        }
        if (Object.keys(found).length > 0) tierProblems[draft.key] = found
      }
      if (form.is_active && drafts.length === 0) next.is_active = t('admin.form.activeNeedsTier')
    }
    setErrors(next)
    setTierErrors(tierProblems)
    setFormError(null)
    if (Object.keys(next).length > 0 || Object.keys(tierProblems).length > 0) return

    setSaving(true)
    try {
      if (product) {
        await api.put(`/api/v1/admin/products/${product.id}`, payload)
        onSaved(t('common.saved'))
      } else {
        const created = await api.post<ProductAdmin>('/api/v1/admin/products', { ...payload, tiers })
        navigate(`/admin/products/${created.id}`, {
          replace: true,
          state: { flash: t('admin.form.created') },
        })
      }
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) setErrors(e.fields)
      else setFormError(e)
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct() {
    if (!product) return
    setDeleteBusy(true)
    try {
      await api.delete(`/api/v1/admin/products/${product.id}`)
      navigate('/admin/products', { replace: true })
    } catch (e) {
      setFormError(e)
      setConfirmDelete(false)
    } finally {
      setDeleteBusy(false)
    }
  }

  const noBrands = brands.data && brands.data.length === 0
  const noCategories = categories.data && categories.data.length === 0
  const activeBlocked = tierCount === 0

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link to="/admin/products" className="text-sm underline">
          {t('admin.form.backToList')}
        </Link>
        <h2 className="text-xl font-semibold">
          {product ? t('admin.form.editTitle') : t('admin.form.createTitle')}
        </h2>
        {flash && <Notice>{flash}</Notice>}
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-8" aria-label={t('admin.form.details')}>
        <section className="card space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('admin.form.nameEn')}
              value={form.name}
              onChange={(v) => set('name', v)}
              error={errors.name}
              maxLength={200}
              required
            />
            <Field
              label={t('admin.form.nameAr')}
              value={form.name_ar}
              onChange={(v) => set('name_ar', v)}
              error={errors.name_ar}
              dir="rtl"
              lang="ar"
              maxLength={200}
              hint={form.name_ar.trim() ? undefined : t('admin.form.arabicHint')}
            />
            <Field
              label={t('admin.form.descEn')}
              value={form.description}
              onChange={(v) => set('description', v)}
              error={errors.description}
              multiline
              required
            />
            <Field
              label={t('admin.form.descAr')}
              value={form.description_ar}
              onChange={(v) => set('description_ar', v)}
              error={errors.description_ar}
              multiline
              dir="rtl"
              lang="ar"
              hint={form.description_ar.trim() ? undefined : t('admin.form.arabicHint')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('admin.form.brand')}
              value={form.brand_id}
              onChange={(v) => set('brand_id', v)}
              error={errors.brand_id}
              placeholder={t('admin.form.choose')}
              options={(brands.data ?? []).map((b) => ({ value: String(b.id), label: b.display_name }))}
            />
            <SelectField
              label={t('admin.form.category')}
              value={form.category_id}
              onChange={(v) => set('category_id', v)}
              error={errors.category_id}
              placeholder={t('admin.form.choose')}
              options={(categories.data ?? []).map((c) => ({
                value: String(c.id),
                label: c.display_name,
              }))}
            />
          </div>
          {(noBrands || noCategories) && (
            <p className="text-sm text-amber-700">
              {t('admin.form.createRefsFirst')}{' '}
              <Link to="/admin/brands" className="underline">
                {t('admin.brand.title')}
              </Link>{' '}
              ·{' '}
              <Link to="/admin/categories" className="underline">
                {t('admin.category.title')}
              </Link>
            </p>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.is_active}
                disabled={activeBlocked && !form.is_active}
                aria-describedby="active-hint"
                onChange={(e) => set('is_active', e.target.checked)}
              />
              {t('admin.form.active')}
            </label>
            <p id="active-hint" className="text-xs text-slate-600">
              {activeBlocked ? t('admin.form.activeNeedsTier') : t('admin.form.activeHint')}
            </p>
            {errors.is_active && <p className="text-sm text-red-700">{errors.is_active}</p>}
          </div>

          {formError !== null && <ErrorState message={errorText(t, formError)} />}
        </section>

        {!product && <TierDraftSection drafts={drafts} onChange={setDrafts} errors={tierErrors} />}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? t('common.saving')
              : product
                ? t('admin.form.saveChanges')
                : t('admin.form.createButton')}
          </button>
          {product && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              {t('admin.form.deleteProduct')}
            </button>
          )}
        </div>
      </form>

      {product ? (
        <>
          <TierSection productId={product.id} tiers={product.tiers} onChanged={onSaved} />
          <ImageSection productId={product.id} images={product.images} onChanged={onSaved} />
        </>
      ) : (
        <p className="text-sm text-slate-600">{t('admin.images.saveFirst')}</p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('admin.products.deleteTitle')}
        body={t('admin.products.deleteBody', { name: product?.name ?? '' })}
        confirmLabel={t('common.delete')}
        busy={deleteBusy}
        onConfirm={() => void deleteProduct()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  error?: string
}) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      <span>{label}</span>
      <select
        className="input"
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="block text-sm font-normal text-red-700">{error}</span>}
    </label>
  )
}
