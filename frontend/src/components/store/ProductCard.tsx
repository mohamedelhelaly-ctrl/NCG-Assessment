import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCart } from '../../lib/cartContext'
import type { StoreProduct } from '../../lib/types'
import OfferList from './OfferList'
import ProductImage from './ProductImage'

/** A listing tile: picture, names, the price ladder, and a one-bundle quick add. */
export default function ProductCard({ product }: { product: StoreProduct }) {
  const { t } = useTranslation()
  const cart = useCart()
  const [selectedId, setSelectedId] = useState(product.tiers[0]?.id ?? 0)
  const [justAdded, setJustAdded] = useState(false)

  // The confirmation answers the click, then goes away by itself.
  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), 1800)
    return () => clearTimeout(timer)
  }, [justAdded])

  const href = `/products/${product.id}`
  return (
    <article className="flex min-w-0 flex-col">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="block">
        <ProductImage image={product.main_image} />
      </Link>
      <div className="mt-4 space-y-0.5">
        <p className="text-sm text-muted">
          <bdi>{product.brand.name}</bdi>
        </p>
        <h3 className="text-lg font-semibold leading-snug">
          <Link to={href} className="hover:text-primary">
            <bdi>{product.name}</bdi>
          </Link>
        </h3>
        <p className="text-sm text-muted">
          <bdi>{product.category.name}</bdi>
        </p>
      </div>
      <div className="mt-4">
        <OfferList
          tiers={product.tiers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          name={`offer-${product.id}`}
          compact
        />
      </div>
      <button
        type="button"
        className="btn btn-primary mt-4 w-full"
        onClick={() => {
          cart.add(product.id, selectedId, 1)
          setJustAdded(true)
        }}
      >
        {justAdded ? t('store.added') : t('store.addToCart')}
      </button>
      <span role="status" className="sr-only">
        {justAdded ? t('store.added') : ''}
      </span>
    </article>
  )
}
