import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeIcon } from '../ui/Icons'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export default function FormField({ label, error, id, type, ...input }: Props) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  const fieldId = id ?? input.name
  const isPassword = type === 'password'
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className={isPassword ? 'input pe-12' : 'input'}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-pressed={shown}
            aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')}
            className="absolute end-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-teal/10 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary"
          >
            <EyeIcon off={shown} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
