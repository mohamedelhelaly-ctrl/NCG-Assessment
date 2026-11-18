import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <nav
          aria-label={t('nav.main')}
          className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-5"
        >
          <Link to="/" className="flex items-center gap-2.5 text-lg font-semibold">
            <Mark />
            {t('app.name')}
          </Link>
          <div className="ms-auto flex items-center gap-1 text-sm sm:gap-3">
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
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1.5 font-medium text-primary-strong"
              >
                {t('nav.cart')}
                <span className="rounded bg-primary px-1.5 text-xs leading-5 text-white tabular-nums">
                  {cart.count}
                </span>
              </span>
            )}
            <LanguageSwitcher />
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
