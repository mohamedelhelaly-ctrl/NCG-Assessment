import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import FormField from '../components/auth/FormField'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/authContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    setFields({})
    try {
      await register(
        String(form.get('full_name')),
        String(form.get('email')),
        String(form.get('password')),
      )
      navigate('/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError) {
        setFields(e.fields)
        // Field errors are shown next to the inputs; anything else (email taken) goes on top.
        if (Object.keys(e.fields).length === 0) setError(e.message)
      } else {
        setError('Something went wrong')
      }
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          label="Full name"
          name="full_name"
          autoComplete="name"
          required
          error={fields.full_name}
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={fields.email}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          error={fields.password}
        />
        <p className="text-sm text-slate-600">At least 10 characters.</p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already registered? <Link to="/login" className="underline">Sign in</Link>
      </p>
    </main>
  )
}
