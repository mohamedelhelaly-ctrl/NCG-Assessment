import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import BundleStepper from '../components/store/BundleStepper'
import OfferList from '../components/store/OfferList'
import ProductImage from '../components/store/ProductImage'
import { ProductPageSkeleton } from '../components/store/Skeletons'
import { ErrorState, Notice } from '../components/ui/Feedback'
import { useApi } from '../hooks/useApi'
import { useDocumentTitle } from '../hooks/usePageTitle'
import { api, ApiError } from '../lib/api'
import { useCart } from '../lib/cartContext'
import { errorText } from '../lib/errors'
import { formatKwd } from '../lib/money'
import { lineTotal, packCount, parseBundles } from '../lib/pricing'
import type { StoreProductDetail } from '../lib/types'

export default function ProductPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const product = useApi(`store-product-${id}`, () =>
    api.get<StoreProductDetail>(`/api/v1/products/${id}`),
  )
  useDocumentTitle(product.data?.name ?? null)

  if (product.loading && !product.data) {
    return (
      <Shell>
        <ProductPageSkeleton />
      </Shell>
    )
  }
  if (!product.data) {
    const gone = product.error instanceof ApiError && product.error.status === 404
    return (
      <Shell>
        {gone ? (
          <div role="alert" className="max-w-lg space-y-2">
            <h1 className="text-2xl font-semibold">{t('product.notFoundTitle')}</h1>
            <p className="text-muted">{t('product.notFoundBody')}</p>
          </div>
        ) : (
          <ErrorState message={errorText(t, product.error)} onRetry={product.reload} />
        )}
      </Shell>
    )
  }
  return (
    <Shell>
      <ProductView key={product.data.id} product={product.data} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Link to="/" className="mb-6 inline-block text-sm text-muted hover:text-primary">
        {t('product.back')}
      </Link>
      {children}
    </main>
  )
}

function ProductView({ product }: { product: StoreProductDetail }) {
  const { t, i18n } = useTranslation()
  const cart = useCart()
  const [imageIndex, setImageIndex] = useState(0)
  const [tierId, setTierId] = useState(product.tiers[0]?.id ?? 0)
  const [bundlesText, setBundlesText] = useState('1')
  const [added, setAdded] = useState<string | null>(null)

  const tier = product.tiers.find((x) => x.id === tierId) ?? product.tiers[0]
  const bundles = parseBundles(bundlesText)
  const money = (fils: number) => formatKwd(fils, i18n.language)
  const images = product.images
  const shown = images[imageIndex] ?? product.main_image

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-3" role="group" aria-label={t('product.gallery')}>
        <ProductImage image={shown} priority />
        {images.length > 1 && (
          <ul className="flex flex-wrap gap-2">
            {images.map((image, index) => (
              <li key={image.id}>
                <button
                  type="button"
                  aria-label={t('product.showImage', { number: index + 1 })}
                  aria-pressed={index === imageIndex}
                  onClick={() => setImageIndex(index)}
                  className={`block h-16 w-20 overflow-hidden rounded-md border-2 ${
                    index === imageIndex ? 'border-primary' : 'border-transparent hover:border-line'
                  }`}
                >
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 space-y-6">
        <div className="space-y-2">
          <p className="flex flex-wrap gap-x-4 text-sm text-muted">
            <Link to={`/?brand=${product.brand.id}`} className="hover:text-primary hover:underline">
              <bdi>{product.brand.name}</bdi>
            </Link>
            <Link to={`/?category=${product.category.id}`} className="hover:text-primary hover:underline">
              <bdi>{product.category.name}</bdi>
            </Link>
          </p>
          <h1 className="text-3xl font-semibold leading-tight ltr:tracking-tight">
            <bdi>{product.name}</bdi>
          </h1>
          <p className="max-w-prose text-muted">
            <bdi>{product.description}</bdi>
          </p>
        </div>

        <div className="space-y-5 rounded-xl border border-line bg-surface p-5">
          <OfferList
            tiers={product.tiers}
            selectedId={tier.id}
            onSelect={setTierId}
            name={`offer-${product.id}`}
          />
          <BundleStepper value={bundlesText} onChange={setBundlesText} />

          <div className="space-y-1 border-t border-line pt-4" aria-live="polite">
            {bundles !== null && (
              <>
                <p className="text-sm text-muted">
                  <bdi>{t('product.summary', { bundles, label: tier.label })}</bdi>
                </p>
                <p className="text-sm text-muted">
                  {t('product.totalPacks', { packs: packCount(tier, bundles) })}
                </p>
              </>
            )}
            <p className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{t('product.total')}</span>
              <span className="text-2xl font-semibold tabular-nums">
                {bundles === null ? '—' : money(lineTotal(tier, bundles))}
              </span>
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary h-12 w-full text-base"
            disabled={bundles === null || cart.status === 'loading'}
            onClick={() => {
              if (bundles === null) return
              cart.add(product.id, tier.id, bundles)
              setAdded(t('product.addedMessage', { bundles, label: tier.label }))
            }}
          >
            {t('store.addToCart')}
          </button>
          {added && (
            <Notice>
              {added}{' '}
              <Link to="/cart" className="font-medium underline">
                {t('product.viewCart')}
              </Link>
            </Notice>
          )}
        </div>
      </div>
    </div>
  )
}
