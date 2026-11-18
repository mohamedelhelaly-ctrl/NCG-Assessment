import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
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
    if (password.length < 10) {
      // Checked here too so the message is in the user's language.
      setFields({ password: t('validation.passwordLength') })
      return
    }
    setSubmitting(true)
    try {
      await register(String(form.get('full_name')), String(form.get('email')), password)
      navigate('/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) setFields(e.fields)
      else setError(e)
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('auth.registerTitle')}</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
        <p className="text-sm text-slate-600">{t('auth.passwordHint')}</p>
        {error !== null && (
          <p role="alert" className="text-sm text-red-700">
            {errorText(t, error)}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? t('auth.creating') : t('auth.registerButton')}
        </button>
      </form>
      <p className="mt-4 text-sm">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="underline">
          {t('auth.signInLink')}
        </Link>
      </p>
    </main>
  )
}
