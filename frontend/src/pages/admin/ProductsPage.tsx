import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import Field from '../../components/common/Field'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState, Notice } from '../../components/ui/Feedback'
import Pagination from '../../components/ui/Pagination'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { usePageTitle } from '../../hooks/usePageTitle'
import { api, query } from '../../lib/api'
import { errorText } from '../../lib/errors'
import type { NamedAdmin, Page, ProductListItem } from '../../lib/types'

const STATUSES = ['all', 'active', 'inactive', 'no_tiers'] as const

export default function ProductsPage() {
  const { t } = useTranslation()
  usePageTitle('admin.products.title')
  // Filters live in the URL, so a filtered page survives a reload and can be shared.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const brand = params.get('brand') ?? ''
  const category = params.get('category') ?? ''
  const status = params.get('status') ?? 'all'
  const missingAr = params.get('missing_ar') === 'true'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [searchText, setSearchText] = useState(search)
  const debounced = useDebounce(searchText, 300)
  useEffect(() => {
    if (debounced.trim() === search) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debounced.trim()) next.set('q', debounced.trim())
        else next.delete('q')
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }, [debounced, search, setParams])

  function setFilter(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value && value !== 'all') next.set(key, value)
      else next.delete(key)
      next.delete('page')
      return next
    })
  }

  const path =
    '/api/v1/admin/products' +
    query({
      page,
      page_size: 20,
      search,
      brand_id: brand,
      category_id: category,
      status: status === 'all' ? '' : status,
      missing_ar: missingAr,
    })
  const products = useApi(path, () => api.get<Page<ProductListItem>>(path))
  const brands = useApi('filter-brands', () => api.get<NamedAdmin[]>('/api/v1/admin/brands'))
  const categories = useApi('filter-categories', () =>
    api.get<NamedAdmin[]>('/api/v1/admin/categories'),
  )

  const [deleting, setDeleting] = useState<ProductListItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    setActionError(null)
    try {
      await api.delete(`/api/v1/admin/products/${deleting.id}`)
      setNotice(t('common.deleted'))
      products.reload()
    } catch (e) {
      setActionError(e)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  const filtered = Boolean(search || brand || category || missingAr || status !== 'all')
  const data = products.data

  return (
    <section className="space-y-5" aria-labelledby="products-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="products-heading" className="text-2xl font-semibold">
          {t('admin.products.title')}
        </h2>
        <Link to="/admin/products/new" className="btn btn-primary">
          {t('admin.products.new')}
        </Link>
      </div>

      <form
        role="search"
        aria-label={t('admin.products.filters')}
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-4 border-b border-line pb-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field
          label={t('common.search')}
          value={searchText}
          onChange={setSearchText}
          type="search"
        />
        <Select
          label={t('admin.products.brand')}
          value={brand}
          onChange={(v) => setFilter('brand', v)}
          options={(brands.data ?? []).map((b) => ({ value: String(b.id), label: b.display_name }))}
          allLabel={t('common.all')}
        />
        <Select
          label={t('admin.products.category')}
          value={category}
          onChange={(v) => setFilter('category', v)}
          options={(categories.data ?? []).map((c) => ({
            value: String(c.id),
            label: c.display_name,
          }))}
          allLabel={t('common.all')}
        />
        <Select
          label={t('admin.products.status')}
          value={status === 'all' ? '' : status}
          onChange={(v) => setFilter('status', v)}
          options={STATUSES.filter((s) => s !== 'all').map((s) => ({
            value: s,
            label: t(`admin.products.statuses.${s}`),
          }))}
          allLabel={t('admin.products.statuses.all')}
        />
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={missingAr}
            onChange={(e) => setFilter('missing_ar', e.target.checked ? 'true' : '')}
          />
          {t('admin.products.onlyMissingAr')}
        </label>
        {filtered && (
          <button
            type="button"
            className="btn sm:col-span-2 lg:col-span-2 lg:justify-self-end"
            onClick={() => {
              setSearchText('')
              setParams({}, { replace: true })
            }}
          >
            {t('common.clearFilters')}
          </button>
        )}
      </form>

      {notice && <Notice>{notice}</Notice>}
      {actionError !== null && <ErrorState message={errorText(t, actionError)} />}

      {products.loading && !data && <LoadingState />}
      {products.error !== null && !data && (
        <ErrorState message={errorText(t, products.error)} onRetry={products.reload} />
      )}

      {data && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {t('common.results', { count: data.total })}
          </p>
          {data.items.length === 0 ? (
            <EmptyState>
              {filtered ? t('admin.products.emptyFiltered') : t('admin.products.empty')}
            </EmptyState>
          ) : (
            <ul className="records">
              {data.items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
                  {p.main_image_url ? (
                    <img
                      src={p.main_image_url}
                      alt=""
                      className="size-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="size-16 shrink-0 rounded-md bg-paper" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1 basis-48">
                    <Link to={`/admin/products/${p.id}`} className="font-semibold hover:text-primary hover:underline">
                      {p.display_name}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap text-sm text-muted">
                      <span>{p.brand}</span>
                      <span className="ms-2.5 border-s border-line ps-2.5">{p.category}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`badge ${p.is_active ? 'badge-ok' : 'badge-muted'}`}>
                        {p.is_active ? t('admin.products.active') : t('admin.products.inactive')}
                      </span>
                      {p.tier_count === 0 && (
                        <span className="badge badge-warn">{t('admin.products.noTiers')}</span>
                      )}
                      {p.missing_ar && (
                        <span className="badge bg-surface text-muted ring-1 ring-line">
                          {t('admin.products.missingAr')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm tabular-nums text-muted">
                    {t('admin.products.tierCount', { count: p.tier_count })}
                  </span>
                  <Link to={`/admin/products/${p.id}`} className="btn btn-sm">
                    {t('common.edit')}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleting(p)}
                  >
                    {t('common.delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            onChange={(next) =>
              setParams((prev) => {
                const params = new URLSearchParams(prev)
                params.set('page', String(next))
                return params
              })
            }
          />
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t('admin.products.deleteTitle')}
        body={t('admin.products.deleteBody', { name: deleting?.display_name ?? '' })}
        confirmLabel={t('common.delete')}
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  allLabel: string
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span className="block">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
