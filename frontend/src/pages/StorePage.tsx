import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import ProductCard from '../components/store/ProductCard'
import { ProductGridSkeleton } from '../components/store/Skeletons'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { SearchIcon } from '../components/ui/Icons'
import Pagination from '../components/ui/Pagination'
import { useApi } from '../hooks/useApi'
import { useDebounce } from '../hooks/useDebounce'
import { usePageTitle } from '../hooks/usePageTitle'
import { api, query } from '../lib/api'
import { errorText } from '../lib/errors'
import type { NamedCount, Page, StoreProduct } from '../lib/types'

const PAGE_SIZE = 12

/** Home: search, filters and the product grid. Everything the shopper chose lives in the address. */
export default function StorePage() {
  const { t } = useTranslation()
  usePageTitle('title.shop')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const brand = params.get('brand') ?? ''
  const category = params.get('category') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [searchText, setSearchText] = useState(q)
  const debounced = useDebounce(searchText, 300)

  function update(changes: Record<string, string | null>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page') // a new search or filter starts at page 1
        return next
      },
      { replace: true },
    )
  }

  // Search as you type, after a short pause.
  useEffect(() => {
    if (debounced.trim() !== q) update({ q: debounced.trim() || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // Enter searches straight away, without waiting for the pause
  function submit(event: FormEvent) {
    event.preventDefault()
    update({ q: searchText.trim() || null })
  }

  const path =
    '/api/v1/products' +
    query({ page, page_size: PAGE_SIZE, search: q, brand_id: brand, category_id: category })
  const products = useApi(path, () => api.get<Page<StoreProduct>>(path))
  const brands = useApi('store-brands', () => api.get<NamedCount[]>('/api/v1/brands'))
  const categories = useApi('store-categories', () => api.get<NamedCount[]>('/api/v1/categories'))

  const filtered = Boolean(q || brand || category)
  const data = products.data

  function clearAll() {
    setSearchText('')
    setParams({}, { replace: true })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:pt-14">
      <h1 className="mx-auto max-w-3xl text-balance text-center font-brand text-4xl font-bold leading-[1.1] tracking-[-0.01em] text-primary-strong sm:text-5xl">
        {t('store.quote')}
      </h1>

      <form
        role="search"
        onSubmit={submit}
        className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_13rem_13rem]"
      >
        <div className="relative col-span-2 md:col-span-1">
          <label htmlFor="store-search" className="sr-only">
            {t('store.searchLabel')}
          </label>
          <input
            id="store-search"
            type="search"
            className="input h-12 pe-12 [&::-webkit-search-cancel-button]:hidden"
            placeholder={t('store.searchPlaceholder')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            autoComplete="off"
          />
          <SearchIcon className="pointer-events-none absolute end-4 top-1/2 size-5 -translate-y-1/2 text-teal" />
        </div>
        <select
          aria-label={t('store.categoryTitle')}
          className="input h-12"
          value={category}
          onChange={(e) => update({ category: e.target.value || null })}
        >
          <option value="">{t('store.allCategories')}</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.product_count})
            </option>
          ))}
        </select>
        <select
          aria-label={t('store.brandTitle')}
          className="input h-12"
          value={brand}
          onChange={(e) => update({ brand: e.target.value || null })}
        >
          <option value="">{t('store.allBrands')}</option>
          {(brands.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.product_count})
            </option>
          ))}
        </select>
      </form>

      <section aria-label={t('title.shop')} className="mt-8 min-w-0 space-y-6" aria-busy={products.loading}>
        {data && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm font-medium" aria-live="polite">
              {t('store.results', { count: data.total })}
            </p>
            {q && (
              <Chip
                label={`“${q}”`}
                onRemove={() => {
                  setSearchText('')
                  update({ q: null })
                }}
              />
            )}
            {filtered && data.items.length > 0 && (
              <button type="button" className="btn btn-sm btn-quiet" onClick={clearAll}>
                {t('common.clearFilters')}
              </button>
            )}
          </div>
        )}

        {products.loading && !data && <ProductGridSkeleton />}
        {products.error !== null && !data && (
          <ErrorState message={errorText(t, products.error)} onRetry={products.reload} />
        )}

        {data && data.items.length === 0 && (
          <div className="space-y-3">
            <EmptyState>{filtered ? t('store.empty') : t('store.emptyAll')}</EmptyState>
            {filtered && (
              <button type="button" className="btn" onClick={clearAll}>
                {t('common.clearFilters')}
              </button>
            )}
          </div>
        )}

        {data && data.items.length > 0 && (
          <div
            className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${products.loading ? 'opacity-60' : ''}`}
          >
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {data && (
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            onChange={(next) => update({ page: String(next) })}
          />
        )}
      </section>
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t('store.removeFilter', { name: label })}
      className="badge badge-ok gap-1.5 !px-2.5 !py-1 text-sm hover:bg-primary-soft/70"
    >
      <bdi>{label}</bdi>
      <span aria-hidden="true">×</span>
    </button>
  )
}
