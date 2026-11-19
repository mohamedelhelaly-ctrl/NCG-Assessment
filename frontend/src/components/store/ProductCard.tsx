import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCart } from '../../lib/cartContext'
import { formatKwd } from '../../lib/money'
import { bestValueId, perPack } from '../../lib/pricing'
import type { StoreProduct } from '../../lib/types'
import { CheckIcon, PlusIcon } from '../ui/Icons'
import ProductImage from './ProductImage'

/**
 * A listing card. Every card has the same four rows whatever the number of bundles, so a grid of
 * them lines up: picture, names (two lines reserved), the bundle chips (one row reserved), and
 * the price of the chosen bundle with the round add button at the end.
 */
export default function ProductCard({ product }: { product: StoreProduct }) {
  const { t, i18n } = useTranslation()
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
  const money = (fils: number) => formatKwd(fils, i18n.language)
  const selected = product.tiers.find((x) => x.id === selectedId) ?? product.tiers[0]
  const best = bestValueId(product.tiers)
  const name = `offer-${product.id}`

  return (
    <article className="group flex h-full min-w-0 flex-col rounded-2xl border border-line bg-surface p-3.5 transition-[border-color,box-shadow] duration-200 hover:border-teal hover:shadow-[0_8px_24px_-12px_rgb(6_148_148/0.35)]">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="block overflow-hidden rounded-xl">
        <div className="transition-transform duration-300 group-hover:scale-[1.03]">
          <ProductImage image={product.main_image} />
        </div>
      </Link>

      <div className="mt-4 min-h-[5.6rem] px-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <bdi className="font-medium text-ink/80">{product.brand.name}</bdi>
          <span aria-hidden="true" className="size-1 rounded-full bg-teal" />
          <bdi>{product.category.name}</bdi>
        </p>
        <h2 className="mt-1 line-clamp-2 text-xl font-semibold leading-snug sm:text-[1.4rem]">
          <Link to={href} className="link-draw">
            <bdi>{product.name}</bdi>
          </Link>
        </h2>
      </div>

      <fieldset className="mt-3 flex min-h-9 flex-wrap items-center gap-2 px-1">
        <legend className="sr-only">{t('store.offerLegend')}</legend>
        {product.tiers.map((tier) => (
          <label key={tier.id} className="cursor-pointer">
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              value={tier.id}
              checked={tier.id === selectedId}
              onChange={() => setSelectedId(tier.id)}
            />
            <bdi className="inline-flex h-9 items-center rounded-full border border-line px-3.5 text-sm font-medium whitespace-nowrap transition-colors hover:border-teal hover:text-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              {tier.label}
            </bdi>
          </label>
        ))}
      </fieldset>

      <div className="mt-auto flex items-end justify-between gap-3 px-1 pt-5">
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none tabular-nums">
            {selected && money(selected.price_fils)}
          </p>
          {/* one line is always reserved, so a single-pack bundle does not shift the card */}
          <p className="mt-1.5 flex min-h-6 flex-wrap items-center gap-x-2 text-sm">
            {selected && selected.units > 1 && (
              <span className="font-medium tabular-nums text-primary">
                {t('store.perPack', { price: money(perPack(selected)) })}
              </span>
            )}
            {selected && best === selected.id && (
              <span className="badge badge-ok">{t('store.bestValue')}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label={justAdded ? t('store.added') : t('store.addToCart')}
          title={t('store.addToCart')}
          disabled={cart.status === 'loading' || !selected}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-primary-strong active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            cart.add(product.id, selectedId, 1)
            setJustAdded(true)
          }}
        >
          {justAdded ? <CheckIcon /> : <PlusIcon />}
        </button>
      </div>
      <span role="status" className="sr-only">
        {justAdded ? t('store.added') : ''}
      </span>
    </article>
  )
}
