import { useId } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  multiline?: boolean
  rows?: number
  dir?: 'ltr' | 'rtl'
  lang?: string
  type?: string
  inputMode?: 'numeric' | 'decimal' | 'text' | 'email'
  maxLength?: number
  required?: boolean
  disabled?: boolean
  autoComplete?: string
  name?: string
}

/** A labelled controlled input. The label, hint and error are all tied to the input for screen readers. */
export default function Field({
  label,
  value,
  onChange,
  error,
  hint,
  multiline,
  rows = 4,
  dir,
  lang,
  type = 'text',
  inputMode,
  maxLength,
  required,
  disabled,
  autoComplete,
  name,
}: Props) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')
  const shared = {
    id,
    name,
    value,
    dir,
    lang,
    maxLength,
    required,
    disabled,
    className: 'input',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
  }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea rows={rows} {...shared} />
      ) : (
        <input type={type} inputMode={inputMode} autoComplete={autoComplete} {...shared} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
