import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCart } from '../../lib/cartContext'
import { formatKwd } from '../../lib/money'
import type { Quote } from '../../lib/types'

/**
 * The summary as a receipt: one row per priced line (product, offer, bundles x bundle price, line
 * total), then the total. Every amount comes from the server's quote.
 */
export default function CartSummary({ quote, busy }: { quote: Quote; busy: boolean }) {
  const { t, i18n } = useTranslation()
  const cart = useCart()
  const money = (fils: number) => formatKwd(fils, i18n.language)
  const { totals, problems } = quote
  const lines = quote.lines.filter((l) => l.status === 'ok')

  return (
    <aside
      aria-labelledby="cart-summary-title"
      aria-busy={busy}
      className="self-start rounded-2xl bg-primary p-6 text-white lg:sticky lg:top-6"
    >
      <h2 id="cart-summary-title" className="text-lg font-semibold">
        {t('cart.summaryTitle')}
      </h2>

      <ul className={`mt-5 space-y-4 ${busy ? 'opacity-70' : ''}`}>
        {lines.map((line) => (
          <li key={line.tier_id} className="flex items-start justify-between gap-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium leading-snug">
                <bdi>{line.product_name}</bdi>
              </p>
              <p className="mt-0.5 tabular-nums text-white">
                <bdi>
                  {t('cart.receiptLine', {
                    label: line.tier_label,
                    bundles: line.bundles,
                    price: money(line.bundle_price_fils ?? 0),
                  })}
                </bdi>
              </p>
            </div>
            <p className="shrink-0 font-medium tabular-nums">{money(line.line_total_fils ?? 0)}</p>
          </li>
        ))}
      </ul>

      {problems.length > 0 && (
        <p className="mt-4 rounded-md bg-primary-strong px-3 py-2 text-sm">
          {t('cart.excluded', { count: problems.length })}
        </p>
      )}

      <dl
        className={`mt-5 flex items-baseline justify-between gap-4 border-t border-dashed border-white/40 pt-4 ${busy ? 'opacity-70' : ''}`}
      >
        <dt className="text-base font-semibold">{t('product.total')}</dt>
        <dd className="text-3xl font-bold tabular-nums">{money(totals.total_fils)}</dd>
      </dl>

      {(cart.status === 'guest' || cart.syncError !== null) && (
        <div className="mt-5 space-y-1 border-t border-white/25 pt-4 text-sm" aria-live="polite">
          {cart.status === 'guest' && (
            <>
              <p className="text-white">{t('cart.saveGuest')}</p>
              <Link to="/login" className="font-medium underline underline-offset-4 hover:no-underline">
                {t('cart.saveGuestCta')}
              </Link>
            </>
          )}
          {cart.syncError !== null && (
            <div role="alert" className="space-y-2">
              <p>{t('cart.saveError')}</p>
              <button type="button" className="btn btn-sm" onClick={cart.retry}>
                {t('common.retry')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3 border-t border-white/25 pt-4">
        <p className="text-sm text-white">{t('cart.noCheckout')}</p>
        <Link
          to="/shop"
          className="btn w-full border-white bg-white text-primary-strong hover:border-white hover:bg-primary-soft hover:text-primary-strong"
        >
          {t('cart.continue')}
        </Link>
      </div>
    </aside>
  )
}
