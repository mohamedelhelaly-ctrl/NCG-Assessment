import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import FormField from '../components/auth/FormField'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuth } from '../lib/authContext'
import { errorText } from '../lib/errors'

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
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('auth.signInTitle')}</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          <p role="alert" className="text-sm text-red-700">
            {errorText(t, error)}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? t('auth.signingIn') : t('auth.signInButton')}
        </button>
      </form>
      <p className="mt-4 text-sm">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="underline">
          {t('auth.createOne')}
        </Link>
      </p>
    </main>
  )
}
