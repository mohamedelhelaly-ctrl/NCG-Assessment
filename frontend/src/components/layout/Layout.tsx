import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/authContext'
import { useCart } from '../../lib/cartContext'
import { CartIcon, CloseIcon, MenuIcon, ShopIcon } from '../ui/Icons'
import LanguageSwitcher from './LanguageSwitcher'

const YEAR = new Date().getFullYear()

const menuItem =
  'flex h-11 w-full items-center rounded-md px-3 text-start text-[15px] font-medium text-ink transition-colors hover:bg-primary-soft hover:text-primary-strong hover:underline underline-offset-4'

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

  // The menu belongs to the page it was opened on, so moving to another page closes it.
  const [menuAt, setMenuAt] = useState<string | null>(null)
  const menuOpen = menuAt === location.key
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuAt(null)
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuAt(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [menuOpen])

  function signOut() {
    setMenuAt(null)
    logout()
    navigate('/login')
  }

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
            {/* Wide screens: every action in the bar. */}
            <div className="hidden items-center gap-x-1.5 lg:flex">
              {user?.role === 'admin' && (
                <NavLink to="/admin" className={action}>
                  <span className="link-draw">{t('nav.admin')}</span>
                </NavLink>
              )}
            </div>
            <Link to="/cart" className={action}>
              <CartIcon className="size-5 text-teal" />
              <span className="link-draw max-sm:sr-only">{t('nav.cart')}</span>
              {cart.count > 0 && (
                <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-semibold leading-5 text-white tabular-nums">
                  {cart.count}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-x-1.5 lg:flex">
              {user ? (
                <>
                  <span className="max-w-36 truncate px-1 text-sm text-muted">{user.full_name}</span>
                  <button type="button" className={action} onClick={signOut}>
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

            {/* Narrower screens: the same actions in a menu, so none of them is ever cut off. */}
            <div ref={menuRef} className="relative lg:hidden">
              <button
                type="button"
                className={`${action} px-2`}
                aria-label={menuOpen ? t('nav.closeMenu') : t('nav.menu')}
                aria-expanded={menuOpen}
                aria-controls="header-menu"
                onClick={() => setMenuAt(menuOpen ? null : location.key)}
              >
                {menuOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
              </button>
              {menuOpen && (
                <div
                  id="header-menu"
                  className="absolute end-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-[0_12px_32px_-12px_rgb(23_48_47/0.35)]"
                >
                  {user && (
                    <p className="truncate px-3 pb-2 pt-1 text-sm text-muted">{user.full_name}</p>
                  )}
                  {user?.role === 'admin' && (
                    <NavLink to="/admin" className={menuItem}>
                      {t('nav.admin')}
                    </NavLink>
                  )}
                  {user ? (
                    <button type="button" className={menuItem} onClick={signOut}>
                      {t('nav.signOut')}
                    </button>
                  ) : (
                    <Link to="/login" className={menuItem}>
                      {t('nav.signIn')}
                    </Link>
                  )}
                  <div className="mt-1 border-t border-line pt-1">
                    <LanguageSwitcher className={menuItem} />
                  </div>
                </div>
              )}
            </div>
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
