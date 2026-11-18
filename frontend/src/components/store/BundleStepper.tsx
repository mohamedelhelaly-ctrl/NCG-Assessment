import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_BUNDLES, parseBundles } from '../../lib/pricing'

interface Props {
  /** Text in the box, so a half-typed value is allowed while the shopper edits. */
  value: string
  onChange: (value: string) => void
}

/** Number of bundles: a whole number from 1 to 99, with plus and minus buttons. */
export default function BundleStepper({ value, onChange }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const bundles = parseBundles(value)
  const invalid = bundles === null

  const step = (delta: number) => onChange(String(Math.min(MAX_BUNDLES, Math.max(1, (bundles ?? 1) + delta))))

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {t('product.bundlesLabel')}
      </label>
      <div className="inline-flex items-stretch" dir="ltr">
        <button
          type="button"
          className="btn w-10 rounded-e-none px-0 text-lg"
          aria-label={t('product.fewer')}
          disabled={bundles !== null && bundles <= 1}
          onClick={() => step(-1)}
        >
          −
        </button>
        <input
          id={id}
          className="input w-16 rounded-none border-x-0 text-center tabular-nums"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn w-10 rounded-s-none px-0 text-lg"
          aria-label={t('product.more')}
          disabled={bundles !== null && bundles >= MAX_BUNDLES}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {t('product.bundlesError')}
        </p>
      )}
    </div>
  )
}
