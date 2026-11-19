import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import AuthShell from '../components/auth/AuthShell'
import FormField from '../components/auth/FormField'
import { usePageTitle } from '../hooks/usePageTitle'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/authContext'
import { errorText } from '../lib/errors'

export default function RegisterPage() {
  const { t } = useTranslation()
  usePageTitle('title.register')
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    setError(null)
    setFields({})
    const email = String(form.get('email')).trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setFields({ email: t('validation.email') })
      return
    }
    if (password.length < 10) {
      // Checked here too so the message is in the user's language.
      setFields({ password: t('validation.passwordLength') })
      return
    }
    setSubmitting(true)
    try {
      await register(String(form.get('full_name')), email, password)
      navigate('/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) setFields(e.fields)
      else setError(e)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="mb-6 text-2xl font-semibold">{t('auth.registerTitle')}</h1>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormField
          label={t('auth.fullName')}
          name="full_name"
          autoComplete="name"
          required
          error={fields.full_name}
        />
        <FormField
          label={t('auth.email')}
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          error={fields.email}
        />
        <FormField
          label={t('auth.password')}
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
          error={fields.password}
        />
        <p className="-mt-2 text-xs text-muted">{t('auth.passwordHint')}</p>
        {error !== null && (
          <p role="alert" className="rounded-md border-s-4 border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
            {errorText(t, error)}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? t('auth.creating') : t('auth.registerButton')}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('auth.signInLink')}
        </Link>
      </p>
    </AuthShell>
  )
}
