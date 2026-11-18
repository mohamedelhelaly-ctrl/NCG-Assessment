import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../lib/authContext'
import { useCart } from '../../lib/cartContext'
import LanguageSwitcher from './LanguageSwitcher'

/** The store mark: four packs in a block. */
function Mark() {
  return (
    <span aria-hidden="true" className="inline-grid grid-cols-2 gap-[3px]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="size-[0.62rem] rounded-[2px] bg-primary" />
      ))}
    </span>
  )
}

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
    <div className="min-h-screen">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t('nav.skip')}
      </a>
      <header className="border-b border-line bg-surface">
        <nav
          aria-label={t('nav.main')}
          className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 sm:gap-x-5"
        >
          <Link to="/" className="flex items-center gap-2.5 text-lg font-semibold">
            <Mark />
            {t('app.name')}
          </Link>
          <div className="ms-auto flex flex-wrap items-center justify-end gap-x-1 gap-y-1 text-sm sm:gap-x-3">
            {user?.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1.5 font-medium ${isActive ? 'bg-primary-soft text-primary-strong' : 'hover:bg-primary-soft'}`
                }
              >
                {t('nav.admin')}
              </NavLink>
            )}
            {user ? (
              <>
                <span className="hidden max-w-40 truncate text-muted sm:inline">{user.full_name}</span>
                <button
                  type="button"
                  className="whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-primary-soft"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                >
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-primary-soft">
                  {t('nav.signIn')}
                </Link>
                <Link to="/register" className="btn btn-sm btn-primary hidden whitespace-nowrap sm:inline-flex">
                  {t('nav.createAccount')}
                </Link>
              </>
            )}
            {cart.count > 0 && (
              <Link
                to="/cart"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary-soft px-2.5 py-1.5 font-medium text-primary-strong hover:bg-primary-soft/70"
              >
                {t('nav.cart')}
                <span className="rounded bg-primary px-1.5 text-xs leading-5 text-white tabular-nums">
                  {cart.count}
                </span>
              </Link>
            )}
            <LanguageSwitcher />
          </div>
        </nav>
      </header>
      <main id="content" ref={content} tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  )
}
