import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import CartLineRow from '../components/cart/CartLineRow'
import CartSummary from '../components/cart/CartSummary'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { useQuote } from '../hooks/useQuote'
import { usePageTitle } from '../hooks/usePageTitle'
import { useCart } from '../lib/cartContext'
import { errorText } from '../lib/errors'

export default function CartPage() {
  const { t } = useTranslation()
  usePageTitle('cart.title')
  const cart = useCart()
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-3xl font-semibold ltr:tracking-tight">{t('cart.title')}</h1>
        {!empty && !loading && (
          <p className="text-sm text-muted">{t('cart.bundleCount', { count: cart.count })}</p>
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
        <div className="max-w-lg space-y-4">
          <EmptyState>
            <span className="block text-lg font-medium text-ink">{t('cart.empty')}</span>
            <span className="mt-1 block">{t('cart.emptyHint')}</span>
          </EmptyState>
          <Link to="/" className="btn btn-primary">
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
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <ul className={`records ${quote.loading ? 'opacity-70' : ''}`} aria-busy={quote.loading}>
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
    </div>
  )
}
