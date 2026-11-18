import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_BUNDLES, parseBundles } from '../../lib/pricing'

interface Props {
  bundles: number
  /** Product name, so a screen reader can tell the lines apart. */
  name: string
  onChange: (bundles: number) => void
}

/**
 * Bundle count for one cart line. A valid number is applied at once; a half-typed or invalid one
 * is explained and the cart keeps its last good value.
 */
export default function LineStepper({ bundles, name, onChange }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState(String(bundles))
  const [seen, setSeen] = useState(bundles)
  if (seen !== bundles) {
    // The cart changed from outside (a reload from the server): show it.
    setSeen(bundles)
    setText(String(bundles))
  }
  const parsed = parseBundles(text)
  const invalid = parsed === null

  function apply(next: number) {
    const value = Math.min(MAX_BUNDLES, Math.max(1, next))
    setText(String(value))
    setSeen(value)
    onChange(value)
  }

  return (
    <div className="space-y-1">
      <div className="inline-flex items-stretch" dir="ltr">
        <button
          type="button"
          className="btn btn-sm w-8 rounded-e-none px-0 text-base"
          aria-label={t('product.fewer')}
          disabled={bundles <= 1}
          onClick={() => apply(bundles - 1)}
        >
          −
        </button>
        <input
          id={id}
          aria-label={t('cart.bundlesFor', { name })}
          className="input h-8 w-14 rounded-none border-x-0 px-1 text-center text-sm tabular-nums"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            const value = parseBundles(e.target.value)
            if (value !== null) {
              setSeen(value)
              if (value !== bundles) onChange(value)
            }
          }}
          onBlur={() => invalid && setText(String(bundles))}
        />
        <button
          type="button"
          className="btn btn-sm w-8 rounded-s-none px-0 text-base"
          aria-label={t('product.more')}
          disabled={bundles >= MAX_BUNDLES}
          onClick={() => apply(bundles + 1)}
        >
          +
        </button>
      </div>
      {invalid && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {t('product.bundlesError')}
        </p>
      )}
    </div>
  )
}
