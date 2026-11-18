import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm ${isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`

export default function AdminLayout() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{t('admin.title')}</h1>
      <nav aria-label={t('admin.nav')} className="mt-3 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <NavLink to="/admin/products" className={linkClass}>
          {t('admin.products.title')}
        </NavLink>
        <NavLink to="/admin/brands" className={linkClass}>
          {t('admin.brand.title')}
        </NavLink>
        <NavLink to="/admin/categories" className={linkClass}>
          {t('admin.category.title')}
        </NavLink>
      </nav>
      <div className="mt-5">
        <Outlet />
      </div>
    </div>
  )
}
