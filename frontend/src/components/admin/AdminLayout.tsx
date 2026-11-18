import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { LoadingState } from '../ui/Feedback'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium lg:border-s-2 lg:rounded-s-none ${
    isActive
      ? 'bg-primary-soft text-primary-strong lg:border-primary'
      : 'text-muted hover:bg-primary-soft hover:text-ink lg:border-transparent'
  }`

/** Sections on a left rail on desktop, and a scrolling row of tabs on a phone. */
export default function AdminLayout() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-4 px-4 py-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-8">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <h1 className="mb-3 text-lg font-semibold">{t('admin.title')}</h1>
        <nav aria-label={t('admin.nav')} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <div className="flex gap-1 lg:flex-col">
            <NavLink to="/admin/products" className={linkClass}>
              {t('admin.products.title')}
            </NavLink>
            <NavLink to="/admin/brands" className={linkClass}>
              {t('admin.brand.title')}
            </NavLink>
            <NavLink to="/admin/categories" className={linkClass}>
              {t('admin.category.title')}
            </NavLink>
          </div>
        </nav>
      </div>
      <div className="min-w-0">
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  )
}
