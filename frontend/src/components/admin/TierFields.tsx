import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatKwd, parseKwdToFils } from '../../lib/money'
import type { TierDraft, TierErrors } from '../../lib/tiers'
import Field from '../common/Field'
import PackGlyph from '../ui/PackGlyph'

interface Props {
  draft: TierDraft
  onChange: (draft: TierDraft) => void
  errors?: TierErrors
  disabled?: boolean
  /** Shown in the row header until a label has been typed. */
  fallbackTitle: string
  /** Buttons for this row (save, delete, remove), placed at the end of the last line. */
  actions: ReactNode
}

/**
 * One bundle. The header says what it is (pack glyph, name, price per pack) and updates as you
 * type, so the manager can sanity-check the discount while entering the price.
 */
export default function TierFields({
  draft,
  onChange,
  errors = {},
  disabled,
  fallbackTitle,
  actions,
}: Props) {
  const { t, i18n } = useTranslation()
  const set = (patch: Partial<TierDraft>) => onChange({ ...draft, ...patch })

  const units = /^\d+$/.test(draft.units.trim()) ? Number(draft.units) : 0
  const price = parseKwdToFils(draft.price)
  // Round to the nearest fil, which is the smallest amount that can be charged.
  const perPack = units >= 1 && price !== null && price > 0 ? Math.round(price / units) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <PackGlyph units={units} />
        <p className="min-w-0 flex-1 truncate font-semibold">
          <bdi>{draft.label.trim() || fallbackTitle}</bdi>
        </p>
        {perPack !== null && (
          <p className="text-sm font-medium tabular-nums text-amber">
            {t('admin.tiers.perPackValue', { price: formatKwd(perPack, i18n.language) })}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('admin.tiers.labelEn')}
dir="ltr"
lang="en"
          value={draft.label}
          onChange={(label) => set({ label })}
          error={errors.label}
          placeholder={t('admin.tiers.labelExample')}
          maxLength={100}
          disabled={disabled}
        />
        <Field
          label={t('admin.tiers.labelAr')}
          value={draft.label_ar}
          onChange={(label_ar) => set({ label_ar })}
          error={errors.label_ar}
          dir="rtl"
          lang="ar"
          maxLength={100}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-32">
          <Field
            label={t('admin.tiers.units')}
            value={draft.units}
            onChange={(units) => set({ units })}
            error={errors.units}
            dir="ltr"
            inputMode="numeric"
            disabled={disabled}
          />
        </div>
        <div className="w-44">
          <Field
            label={t('admin.tiers.price')}
            value={draft.price}
            onChange={(price) => set({ price })}
            error={errors.price}
            dir="ltr"
            inputMode="decimal"
            disabled={disabled}
          />
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-2 self-end pb-0.5">{actions}</div>
      </div>
    </div>
  )
}
