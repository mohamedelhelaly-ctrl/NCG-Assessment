import { expect, test } from 'vitest'
import ar from './ar.json'
import en from './en.json'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out[prefix + key] = value
    else Object.assign(out, flatten(value, `${prefix}${key}.`))
  }
  return out
}

const english = flatten(en as Tree)
const arabic = flatten(ar as Tree)
const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()

test('English and Arabic have exactly the same keys', () => {
  const onlyEnglish = Object.keys(english).filter((k) => !(k in arabic))
  const onlyArabic = Object.keys(arabic).filter((k) => !(k in english))
  expect({ onlyEnglish, onlyArabic }).toEqual({ onlyEnglish: [], onlyArabic: [] })
})

test('no translation is empty', () => {
  for (const [key, value] of [...Object.entries(english), ...Object.entries(arabic)]) {
    expect(value.trim(), key).not.toBe('')
  }
})

test('every placeholder in English is used in Arabic, and the other way round', () => {
  for (const key of Object.keys(english)) {
    expect(placeholders(arabic[key]), key).toEqual(placeholders(english[key]))
  }
})

test('Arabic strings are really Arabic, except for the allowed Latin ones', () => {
  // The switcher names the other language, the tier label example is English input guidance, and
  // the store name is a brand name written the same way in both languages.
  const allowedLatin = new Set([
    'nav.switchLanguage',
    'admin.tiers.labelExample',
    'app.name',
    'cart.receiptLine', // only placeholders, a dot and a multiplication sign
    'product.summary', // only placeholders and a multiplication sign
  ])
  for (const [key, value] of Object.entries(arabic)) {
    if (allowedLatin.has(key)) continue
    expect(value, key).toMatch(/[؀-ۿ]/)
  }
})

test('the language switcher names the other language in that language', () => {
  expect(english['nav.switchLanguage']).toBe('العربية')
  expect(arabic['nav.switchLanguage']).toBe('English')
})
