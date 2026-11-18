import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatKwd } from '../../lib/money'
import type { CartLine } from '../../lib/cartContext'
import type { QuoteLine } from '../../lib/types'
import PackGlyph from '../ui/PackGlyph'
import BundleBlocks from './BundleBlocks'
import LineStepper from './LineStepper'

interface Props {
  line: CartLine
  /** The server's answer for this line; absent while a new line is being priced. */
  quote: QuoteLine | undefined
  onBundles: (bundles: number) => void
  onRemove: () => void
}

const frame = 'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:gap-x-5'

export default function CartLineRow({ line, quote, onBundles, onRemove }: Props) {
  const { t, i18n } = useTranslation()
  const money = (fils: number) => formatKwd(fils, i18n.language)

  // Not priced yet (a line was just added): quiet blocks where the content will be.
  if (!quote) {
    return (
      <li className={frame} aria-hidden="true">
        <div className="aspect-[4/3] rounded-lg bg-line/50" />
        <div className="space-y-2">
          <div className="h-5 w-2/3 rounded bg-line/50" />
          <div className="h-4 w-1/3 rounded bg-line/50" />
        </div>
      </li>
    )
  }

  // An offer that was removed, or a count that cannot be priced: say so, and leave it out of the total.
  if (quote.status !== 'ok') {
    return (
      <li className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-amber-soft/50 p-4">
        <p className="min-w-0 flex-1 text-sm text-amber">
          {quote.status === 'unavailable' ? t('cart.unavailable') : t('cart.invalid')}
        </p>
        <button type="button" className="btn btn-sm" onClick={onRemove}>
          {t('cart.remove')}
        </button>
      </li>
    )
  }

  const name = quote.product_name ?? ''
  const units = quote.units ?? 1
  return (
    <li className={frame}>
      <Link to={`/products/${line.product_id}`} tabIndex={-1} aria-hidden="true" className="block self-start">
        {quote.image_url ? (
          <img
            src={quote.image_url}
            alt=""
            width={1200}
            height={900}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-primary-soft/60">
            <PackGlyph units={4} />
          </div>
        )}
      </Link>

      <div className="min-w-0 space-y-3">
        <div>
          <h2 className="font-semibold leading-snug">
            <Link to={`/products/${line.product_id}`} className="hover:text-primary">
              <bdi>{name}</bdi>
            </Link>
          </h2>
          <p className="text-sm text-muted">
            <bdi>{quote.tier_label}</bdi>
          </p>
        </div>

        <BundleBlocks units={units} bundles={line.bundles} />
        <p className="text-sm">
          <bdi className="font-medium">{t('product.summary', { bundles: line.bundles, label: quote.tier_label })}</bdi>
          <span className="text-muted"> · </span>
          <span className="text-muted">{t('product.totalPacks', { packs: quote.pack_quantity })}</span>
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <LineStepper bundles={line.bundles} name={name} onChange={onBundles} />
          <button
            type="button"
            className="text-sm text-muted underline-offset-4 hover:text-danger hover:underline"
            aria-label={t('cart.removeLabel', { name })}
            onClick={onRemove}
          >
            {t('cart.remove')}
          </button>
        </div>
      </div>

      <div className="col-span-2 flex items-baseline justify-between gap-4 border-t border-line pt-3 sm:col-span-1 sm:block sm:border-0 sm:pt-0 sm:text-end">
        <p className="text-lg font-semibold tabular-nums">{money(quote.line_total_fils ?? 0)}</p>
        <p className="text-xs tabular-nums text-muted">
          {t('cart.perBundle', { price: money(quote.bundle_price_fils ?? 0) })}
        </p>
      </div>
    </li>
  )
}
