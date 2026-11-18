import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import FilterPanel from '../components/store/FilterPanel'
import ProductCard from '../components/store/ProductCard'
import { ProductGridSkeleton } from '../components/store/Skeletons'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
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
  usePageTitle('title.home')
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

  const brandName = brands.data?.find((b) => String(b.id) === brand)?.name
  const categoryName = categories.data?.find((c) => String(c.id) === category)?.name
  const filtered = Boolean(q || brand || category)
  const data = products.data

  function clearAll() {
    setSearchText('')
    setParams({}, { replace: true })
  }

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <h1 className="max-w-3xl text-[2rem] font-semibold leading-[1.15] sm:text-5xl ltr:tracking-tight">
            {t('store.heroTitle')}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-muted">{t('store.heroSub')}</p>
          <form role="search" onSubmit={submit} className="mt-7 flex max-w-2xl gap-2">
            <label htmlFor="store-search" className="sr-only">
              {t('store.searchLabel')}
            </label>
            <input
              id="store-search"
              type="search"
              className="input h-12 flex-1 text-base"
              placeholder={t('store.searchPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary h-12 px-6 text-base">
              {t('store.searchButton')}
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-8 px-4 py-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <FilterPanel
          categories={categories.data ?? []}
          brands={brands.data ?? []}
          category={category}
          brand={brand}
          onCategory={(id) => update({ category: id || null })}
          onBrand={(id) => update({ brand: id || null })}
        />

        <section aria-label={t('title.home')} className="min-w-0 space-y-6" aria-busy={products.loading}>
          {data && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-sm font-medium" aria-live="polite">
                {t('store.results', { count: data.total })}
              </p>
              {q && <Chip label={`“${q}”`} onRemove={() => { setSearchText(''); update({ q: null }) }} />}
              {categoryName && <Chip label={categoryName} onRemove={() => update({ category: null })} />}
              {brandName && <Chip label={brandName} onRemove={() => update({ brand: null })} />}
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
            <div className={`grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3 ${products.loading ? 'opacity-60' : ''}`}>
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
    </>
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
