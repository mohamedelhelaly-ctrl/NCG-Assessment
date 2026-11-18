import { useTranslation } from 'react-i18next'
import { formatKwd } from '../../lib/money'
import PackGlyph from './PackGlyph'

const STEPS = [
  { units: 1, price: 5500, key: 'one' },
  { units: 4, price: 19500, key: 'four' },
  { units: 12, price: 55000, key: 'twelve' },
] as const

/** The idea of the store in three rows: the same pack, sold singly and in bundles. */
export default function BundleLadder() {
  const { t, i18n } = useTranslation()
  return (
    <ul aria-hidden="true" className="space-y-2.5">
      {STEPS.map((step) => (
        <li
          key={step.key}
          className="flex items-center gap-4 rounded-md bg-white/10 px-4 py-3 text-white"
        >
          <PackGlyph units={step.units} tone="light" />
          <span className="flex-1 text-sm">{t(`auth.ladder.${step.key}`)}</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatKwd(step.price, i18n.language)}
          </span>
        </li>
      ))}
    </ul>
  )
}
