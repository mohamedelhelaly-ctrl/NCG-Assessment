import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import ProductImage from '../components/store/ProductImage'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { useApi } from '../hooks/useApi'
import { usePageTitle } from '../hooks/usePageTitle'
import { api } from '../lib/api'
import { errorText } from '../lib/errors'
import { formatKwd } from '../lib/money'
import { perPack, topBundles } from '../lib/pricing'
import type { Page, StoreProduct } from '../lib/types'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  usePageTitle('home.title')
  const products = useApi('home-products', () =>
    api.get<Page<StoreProduct>>('/api/v1/products?page_size=48'),
  )
  const top = products.data ? topBundles(products.data.items) : []
  const money = (fils: number) => formatKwd(fils, i18n.language)

  return (
    <>
      <section className="border-b border-line bg-primary-soft">
        <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-20 text-center sm:py-28">
          <h1 className="font-brand text-5xl font-bold leading-none tracking-[-0.02em] text-primary-strong sm:text-7xl">
            {t('app.name')}
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink sm:text-xl">{t('home.tagline')}</p>
          <Link to="/shop" className="btn btn-primary mt-9 h-12 px-8 text-base">
            {t('home.shopNow')}
          </Link>
        </div>
      </section>

      <section aria-labelledby="top-title" className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 id="top-title" className="text-2xl font-semibold sm:text-3xl ltr:tracking-tight">
              {t('home.topTitle')}
            </h2>
            <p className="mt-1.5 text-muted">{t('home.topLead')}</p>
          </div>
          <Link
            to="/shop"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('home.viewAll')}
          </Link>
        </div>

        <div className="mt-8" aria-busy={products.loading}>
          {products.error !== null && !products.data && (
            <ErrorState message={errorText(t, products.error)} onRetry={products.reload} />
          )}
          {products.loading && !products.data && (
            <div role="status" aria-label={t('common.loading')} className="grid gap-6 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} aria-hidden="true" className="aspect-[4/5] rounded-xl bg-line/50" />
              ))}
            </div>
          )}
          {products.data && top.length === 0 && <EmptyState>{t('home.empty')}</EmptyState>}
          {top.length > 0 && (
            <ul className="grid gap-6 md:grid-cols-3">
              {top.map(({ product, tier, saving }) => (
                <li key={product.id}>
                  <Link
                    to={`/products/${product.id}`}
                    className="group flex h-full flex-col rounded-xl border border-line bg-surface p-3 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-teal"
                  >
                    <ProductImage image={product.main_image} />
                    <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
                      <p className="text-sm text-muted">
                        <bdi>{product.brand.name}</bdi>
                      </p>
                      <h3 className="mt-0.5 flex-1 text-lg font-semibold leading-snug">
                        <span className="link-draw">
                          <bdi>{product.name}</bdi>
                        </span>
                      </h3>
                      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
                        <div>
                          <p className="font-medium">
                            <bdi>{t('home.bundle', { label: tier.label, price: money(tier.price_fils) })}</bdi>
                          </p>
                          <p className="text-sm font-medium tabular-nums text-primary">
                            {t('home.perPack', { price: money(perPack(tier)) })}
                          </p>
                        </div>
                        <span className="badge badge-ok shrink-0 text-sm">
                          {t('home.save', { percent: saving })}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
