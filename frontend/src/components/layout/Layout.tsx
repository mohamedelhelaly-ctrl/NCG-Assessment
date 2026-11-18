import { Link, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../lib/authContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3"
        >
          <Link to="/" className="text-lg font-semibold">
            Shop
          </Link>
          <div className="ms-auto flex flex-wrap items-center gap-4 text-sm">
            {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
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
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login">Sign in</Link>
                <Link to="/register">Create account</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}
