import type { TFunction } from 'i18next'
import { MAX_PRICE_FILS, filsToInput, parseKwdToFils } from './money'
import type { TierAdmin, TierInput } from './types'

/** Form state for one tier: everything is text until validated. */
export interface TierDraft {
  key: string
  label: string
  label_ar: string
  units: string
  price: string
}

let counter = 0
export const emptyDraft = (): TierDraft => ({
  key: `draft-${++counter}`,
  label: '',
  label_ar: '',
  units: '',
  price: '',
})

export const draftFromTier = (tier: TierAdmin): TierDraft => ({
  key: `tier-${tier.id}`,
  label: tier.label,
  label_ar: tier.label_ar ?? '',
  units: String(tier.units),
  price: filsToInput(tier.price_fils),
})

export type TierErrors = Partial<Record<'label' | 'label_ar' | 'units' | 'price', string>>

/** Validate in the user's language before calling the server (which checks again). */
export function validateTier(
  draft: TierDraft,
  t: TFunction,
): { errors: TierErrors; value?: TierInput } {
  const errors: TierErrors = {}
  const label = draft.label.trim()
  const labelAr = draft.label_ar.trim()
  if (!label) errors.label = t('validation.required')
  else if (label.length > 100) errors.label = t('validation.maxLength', { max: 100 })
  if (labelAr.length > 100) errors.label_ar = t('validation.maxLength', { max: 100 })

  const unitsText = draft.units.trim()
  const units = /^\d+$/.test(unitsText) ? Number(unitsText) : NaN
  if (!(units >= 1 && units <= 1_000_000)) errors.units = t('validation.units')

  const price = parseKwdToFils(draft.price)
  if (price === null || price <= 0 || price > MAX_PRICE_FILS) errors.price = t('validation.price')

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { label, label_ar: labelAr || null, units, price_fils: price! } }
}
