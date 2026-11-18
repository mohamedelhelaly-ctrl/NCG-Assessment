// Money is integer fils (1 KWD = 1000 fils) everywhere. Never a float.
export const MAX_PRICE_FILS = 1_000_000_000

/**
 * Parse text like "19.500", "19.5" or "19" into fils with string arithmetic.
 * Returns null for anything else: no sign, no thousands separators, at most 3 decimals.
 */
export function parseKwdToFils(input: string): number | null {
  const text = input.trim()
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'))
}

/** 19500 -> "19.500", for filling a price input. */
export function filsToInput(fils: number): string {
  const whole = Math.trunc(fils / 1000)
  return `${whole}.${String(fils % 1000).padStart(3, '0')}`
}

/** "KWD 19.500" in English, "19.500 د.ك." in Arabic. Digits stay Latin in both. */
export function formatKwd(fils: number, lang: string): string {
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(fils / 1000)
}
