import { useTranslation } from 'react-i18next'
import type { TierDraft, TierErrors } from '../../lib/tiers'
import Field from '../common/Field'

interface Props {
  draft: TierDraft
  onChange: (draft: TierDraft) => void
  errors?: TierErrors
  disabled?: boolean
}

/** The four inputs of one pricing tier. The price is typed in KWD (up to 3 decimals). */
export default function TierFields({ draft, onChange, errors = {}, disabled }: Props) {
  const { t } = useTranslation()
  const set = (patch: Partial<TierDraft>) => onChange({ ...draft, ...patch })
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field
        label={t('admin.tiers.labelEn')}
        value={draft.label}
        onChange={(label) => set({ label })}
        error={errors.label}
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
        hint={draft.label_ar.trim() ? undefined : t('admin.form.arabicHintShort')}
      />
      <Field
        label={t('admin.tiers.units')}
        value={draft.units}
        onChange={(units) => set({ units })}
        error={errors.units}
        dir="ltr"
        inputMode="numeric"
        disabled={disabled}
      />
      <Field
        label={t('admin.tiers.price')}
        value={draft.price}
        onChange={(price) => set({ price })}
        error={errors.price}
        dir="ltr"
        inputMode="decimal"
        disabled={disabled}
        hint={t('admin.tiers.priceHint')}
      />
    </div>
  )
}
