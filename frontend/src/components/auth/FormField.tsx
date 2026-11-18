import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export default function FormField({ label, error, id, ...input }: Props) {
  const fieldId = id ?? input.name
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className="w-full rounded border border-slate-300 px-3 py-2"
        {...input}
      />
      {error && (
        <p id={`${fieldId}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
