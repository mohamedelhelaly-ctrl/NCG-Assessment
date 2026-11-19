import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCart } from '../../lib/cartContext'
import { formatKwd } from '../../lib/money'
import type { Quote } from '../../lib/types'

/** Totals from the server's quote, where the cart is kept, and why there is no checkout button. */
export default function CartSummary({ quote, busy }: { quote: Quote; busy: boolean }) {
  const { t, i18n } = useTranslation()
  const cart = useCart()
  const { totals, problems } = quote

  return (
    <aside
      aria-labelledby="cart-summary-title"
      aria-busy={busy}
      className="space-y-5 self-start rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-6"
    >
      <h2 id="cart-summary-title" className="text-lg font-semibold">
        {t('cart.summaryTitle')}
      </h2>

      <dl className={`space-y-2 text-sm ${busy ? 'opacity-60' : ''}`}>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('cart.summaryBundles')}</dt>
          <dd className="font-medium tabular-nums">{totals.bundle_count}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{t('cart.summaryPacks')}</dt>
          <dd className="font-medium tabular-nums">{totals.pack_count}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-medium">{t('product.total')}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{formatKwd(totals.total_fils, i18n.language)}</dd>
        </div>
      </dl>

      {problems.length > 0 && (
        <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">
          {t('cart.excluded', { count: problems.length })}
        </p>
      )}

      <div className="space-y-1 border-t border-line pt-4 text-sm" aria-live="polite">
        {cart.status === 'guest' && (
          <>
            <p className="text-muted">{t('cart.saveGuest')}</p>
            <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t('cart.saveGuestCta')}
            </Link>
          </>
        )}
        {cart.status !== 'guest' && !cart.syncError && (
          <p className="text-muted">{cart.saving || cart.status === 'loading' ? t('cart.saving') : t('cart.saved')}</p>
        )}
        {cart.syncError !== null && (
          <div role="alert" className="space-y-2 text-danger">
            <p>{t('cart.saveError')}</p>
            <button type="button" className="btn btn-sm" onClick={cart.retry}>
              {t('common.retry')}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-sm text-muted">{t('cart.noCheckout')}</p>
        <Link to="/shop" className="btn w-full">
          {t('cart.continue')}
        </Link>
      </div>
    </aside>
  )
}
