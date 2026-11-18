import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import BundleLadder from '../ui/BundleLadder'

/** Sign in and sign up: a green panel that shows what the store sells, and the form beside it. */
export default function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] lg:grid-cols-2">
      <aside className="hidden flex-col items-end justify-center gap-8 bg-primary-strong px-12 py-16 lg:flex">
        <div className="w-full max-w-md space-y-8">
          <p className="text-3xl font-semibold leading-snug text-white">{t('auth.tagline')}</p>
          <BundleLadder />
        </div>
      </aside>
      <div className="flex items-start justify-center px-4 py-10 sm:px-8 lg:items-center lg:py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
