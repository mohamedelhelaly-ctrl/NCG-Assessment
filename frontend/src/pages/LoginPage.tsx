import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import AuthShell from '../components/auth/AuthShell'
import FormField from '../components/auth/FormField'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuth } from '../lib/authContext'
import { errorText } from '../lib/errors'

// Demo access for reviewers, shown on the sign-in page on purpose.
const REVIEWER_EMAIL = 'admin@example.com'
const REVIEWER_PASSWORD = 'ncg-admin-password'

export default function LoginPage() {
  const { t } = useTranslation()
  usePageTitle('title.login')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      await login(String(form.get('email')), String(form.get('password')))
      navigate(from, { replace: true })
    } catch (e) {
      setError(e)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="mb-6 text-2xl font-semibold">{t('auth.signInTitle')}</h1>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormField
          label={t('auth.email')}
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
        />
        <FormField
          label={t('auth.password')}
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
        />
        {error !== null && (
          <p role="alert" className="rounded-md border-s-4 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
            {errorText(t, error)}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? t('auth.signingIn') : t('auth.signInButton')}
        </button>
      </form>
      <aside className="mt-6 rounded-lg border border-teal/30 bg-teal/5 px-4 py-3 text-sm">
        <p className="font-medium text-primary-strong">{t('auth.reviewerTitle')}</p>
        <p className="mt-0.5 text-muted">{t('auth.reviewerBody')}</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1" dir="ltr">
          <dt className="text-muted">{t('auth.email')}</dt>
          <dd className="select-all font-medium">{REVIEWER_EMAIL}</dd>
          <dt className="text-muted">{t('auth.password')}</dt>
          <dd className="select-all font-medium">{REVIEWER_PASSWORD}</dd>
        </dl>
      </aside>
      <p className="mt-6 text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('auth.createOne')}
        </Link>
      </p>
    </AuthShell>
  )
}
