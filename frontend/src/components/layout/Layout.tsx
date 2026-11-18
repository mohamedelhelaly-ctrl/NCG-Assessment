import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../lib/authContext'
import LanguageSwitcher from './LanguageSwitcher'

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <nav
          aria-label={t('nav.main')}
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3"
        >
          <Link to="/" className="text-lg font-semibold">
            {t('app.name')}
          </Link>
          <div className="ms-auto flex flex-wrap items-center gap-4 text-sm">
            {user?.role === 'admin' && <Link to="/admin">{t('nav.admin')}</Link>}
            {user ? (
              <>
                <span>{user.full_name}</span>
                <button
                  type="button"
                  className="underline"
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
                <Link to="/login">{t('nav.signIn')}</Link>
                <Link to="/register">{t('nav.createAccount')}</Link>
              </>
            )}
            <LanguageSwitcher />
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
