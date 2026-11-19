import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/**
 * Sign in and sign up: the form beside a teal panel with a short quote and a way to carry on
 * without an account. On a phone the panel sits under the form.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <aside className="flex items-center justify-center bg-primary-strong px-6 py-14 text-white max-lg:order-last lg:px-16 lg:py-16">
        {/* the block sits in the middle of the panel; its text keeps the language's own alignment */}
        <div className="w-full max-w-md text-start">
          <p className="font-brand text-4xl font-bold leading-[1.1] tracking-[-0.01em] lg:text-5xl">
            {t('auth.quote')}
          </p>
          <Link
            to="/"
            className="mt-10 inline-flex h-14 items-center justify-center rounded-md bg-white px-10 text-lg font-semibold text-primary-strong underline-offset-4 transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-primary-soft hover:underline active:translate-y-0"
          >
            {t('auth.guest')}
          </Link>
        </div>
      </aside>
      <div className="flex items-start justify-center px-4 py-10 sm:px-8 lg:items-center lg:py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
