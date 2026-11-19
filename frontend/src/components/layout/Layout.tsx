import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/authContext'
import { useCart } from '../../lib/cartContext'
import { CartIcon, ShopIcon } from '../ui/Icons'
import LanguageSwitcher from './LanguageSwitcher'

const YEAR = new Date().getFullYear()

// Every header action: text and icon in ink, teal with an underline on hover.
const action =
  'inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-md px-1.5 text-sm sm:px-2 font-medium text-ink transition-colors hover:text-primary'

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const cart = useCart()
  const location = useLocation()
  const content = useRef<HTMLElement>(null)
  const lastPath = useRef(location.pathname)

  // A new page starts at the top and moves keyboard and screen reader focus to the content.
  // Only the path matters: changing a filter or search must not take focus away from the field.
  useEffect(() => {
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    window.scrollTo(0, 0)
    content.current?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t('nav.skip')}
      </a>
      <header className="border-b-2 border-teal bg-surface">
        <nav
          aria-label={t('nav.main')}
          className="mx-auto grid min-h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-0.5 px-1.5 sm:grid-cols-[1fr_auto_1fr] sm:gap-2 sm:px-4"
        >
          <div className="flex items-center">
            <NavLink to="/shop" className={action}>
              <ShopIcon className="size-5 text-teal" />
              <span className="link-draw max-sm:sr-only">{t('nav.shop')}</span>
            </NavLink>
          </div>

          <Link
            to="/"
            aria-label={t('nav.home')}
            className="justify-self-center font-brand text-[1.2rem] font-bold leading-none tracking-[-0.01em] text-primary-strong transition-colors hover:text-teal sm:text-[1.9rem]"
          >
            {t('app.name')}
          </Link>

          <div className="flex items-center justify-end sm:gap-x-1.5">
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={`${action} max-md:hidden`}>
                <span className="link-draw">{t('nav.admin')}</span>
              </NavLink>
            )}
            <Link to="/cart" className={action}>
              <CartIcon className="size-5 text-teal" />
              <span className="link-draw max-sm:sr-only">{t('nav.cart')}</span>
              {cart.count > 0 && (
                <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold leading-5 text-white tabular-nums">
                  {cart.count}
                </span>
              )}
            </Link>
            {user ? (
              <>
                <span className="hidden max-w-36 truncate px-1 text-sm text-muted lg:inline">
                  {user.full_name}
                </span>
                <button
                  type="button"
                  className={action}
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                >
                  <span className="link-draw">{t('nav.signOut')}</span>
                </button>
              </>
            ) : (
              <Link to="/login" className={action}>
                <span className="link-draw">{t('nav.signIn')}</span>
              </Link>
            )}
            <LanguageSwitcher />
          </div>
        </nav>
      </header>
      <main id="content" ref={content} tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-muted">
          {t('footer.line', { year: YEAR })}
        </p>
      </footer>
    </div>
  )
}
