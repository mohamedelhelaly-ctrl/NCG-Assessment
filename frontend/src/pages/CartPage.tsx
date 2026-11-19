import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import CartLineRow from '../components/cart/CartLineRow'
import CartSummary from '../components/cart/CartSummary'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { ErrorState } from '../components/ui/Feedback'
import { CartIcon } from '../components/ui/Icons'
import { useQuote } from '../hooks/useQuote'
import { usePageTitle } from '../hooks/usePageTitle'
import { useCart } from '../lib/cartContext'
import { errorText } from '../lib/errors'

export default function CartPage() {
  const { t } = useTranslation()
  usePageTitle('cart.title')
  const cart = useCart()
  const [confirmClear, setConfirmClear] = useState(false)
  const loading = cart.status === 'loading'
  const quote = useQuote(cart.lines, !loading)
  const empty = !loading && cart.lines.length === 0
  // Show the lines only once every one of them has been priced; otherwise a half-empty summary
  // (zero total, placeholder rows) would flash while the first prices arrive.
  const priced =
    quote.data !== null &&
    cart.lines.every((line) => quote.data!.lines.some((q) => q.tier_id === line.tier_id))
  const showContent = quote.data !== null && (priced || !quote.loading)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-3xl font-semibold ltr:tracking-tight">{t('cart.title')}</h1>
        {!empty && !loading && (
          <div className="flex items-center gap-x-4">
            <p className="text-sm text-muted">{t('cart.bundleCount', { count: cart.count })}</p>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmClear(true)}>
              {t('cart.clear')}
            </button>
          </div>
        )}
      </div>

      {cart.loadError !== null && (
        <ErrorState message={t('cart.loadError')} onRetry={cart.retry} />
      )}

      {loading && cart.loadError === null && (
        <p role="status" className="py-10 text-muted">
          {t('cart.loadingCart')}
        </p>
      )}

      {empty && (
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 pb-10 text-center">
          <CartIcon className="size-14 text-teal" />
          <p className="mt-2 text-3xl font-semibold sm:text-4xl">{t('cart.empty')}</p>
          <p className="max-w-md text-lg text-muted">{t('cart.emptyHint')}</p>
          <Link to="/shop" className="btn btn-primary mt-5 h-14 px-10 text-lg">
            {t('cart.browse')}
          </Link>
        </div>
      )}

      {!loading && !empty && (
        <>
          {quote.error !== null && !quote.data && (
            <ErrorState message={errorText(t, quote.error)} onRetry={quote.reload} />
          )}
          {showContent && quote.data && (
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <ul className={`records self-start ${quote.loading ? 'opacity-70' : ''}`} aria-busy={quote.loading}>
                {cart.lines.map((line) => (
                  <CartLineRow
                    key={line.tier_id}
                    line={line}
                    quote={quote.data!.lines.find((q) => q.tier_id === line.tier_id)}
                    onBundles={(bundles) => cart.setBundles(line.tier_id, bundles)}
                    onRemove={() => cart.remove(line.tier_id)}
                  />
                ))}
              </ul>
              <CartSummary quote={quote.data} busy={quote.loading} />
            </div>
          )}
          {!showContent && quote.error === null && (
            <p role="status" className="py-10 text-muted">
              {t('common.loading')}
            </p>
          )}
        </>
      )}
    
      <ConfirmDialog
        open={confirmClear}
        title={t('cart.clearTitle')}
        body={t('cart.clearBody', { count: cart.count })}
        confirmLabel={t('cart.clear')}
        onConfirm={() => {
          cart.clear()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
