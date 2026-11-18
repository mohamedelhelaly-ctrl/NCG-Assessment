import { describe, expect, test } from 'vitest'
import { filsToInput, formatKwd, parseKwdToFils } from './money'

describe('parseKwdToFils', () => {
  test.each([
    ['19.500', 19500],
    ['19.5', 19500],
    ['19', 19000],
    ['0.001', 1],
    ['0.5', 500],
    [' 5.500 ', 5500],
    ['55.000', 55000],
    ['1000000', 1_000_000_000],
  ])('accepts %s', (input, fils) => {
    expect(parseKwdToFils(input)).toBe(fils)
  })

  test.each(['', 'abc', '-1', '+1', '1,5', '1.2345', '.5', '5.', '1e3', '12345678', '1 000', '0x10'])(
    'rejects %j',
    (input) => {
      expect(parseKwdToFils(input)).toBeNull()
    },
  )

  test('never goes through a float (0.1 + 0.2 style errors cannot happen)', () => {
    expect(parseKwdToFils('0.299')).toBe(299)
    expect(parseKwdToFils('4.35')).toBe(4350)
    expect(parseKwdToFils('1.005')).toBe(1005)
  })
})

describe('filsToInput', () => {
  test.each([
    [19500, '19.500'],
    [5, '0.005'],
    [55000, '55.000'],
    [1, '0.001'],
    [1_000_000_000, '1000000.000'],
  ])('%d -> %s', (fils, text) => {
    expect(filsToInput(fils)).toBe(text)
  })

  test('round trips with the parser', () => {
    for (let fils = 1; fils <= 5000; fils += 7) {
      expect(parseKwdToFils(filsToInput(fils))).toBe(fils)
    }
  })
})

// Intl puts a non-breaking space between the currency and the amount.
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('formatKwd', () => {
  test('English: KWD with three decimals', () => {
    expect(plain(formatKwd(19500, 'en'))).toBe('KWD 19.500')
    expect(plain(formatKwd(55000, 'en'))).toBe('KWD 55.000')
    expect(plain(formatKwd(1_234_500, 'en'))).toBe('KWD 1,234.500')
    expect(plain(formatKwd(1, 'en'))).toBe('KWD 0.001')
  })

  test('Arabic: Arabic currency sign, Latin digits, three decimals', () => {
    const text = formatKwd(19500, 'ar')
    expect(text).toContain('19.500')
    expect(text).toContain('د.ك')
    expect(text).not.toMatch(/[٠-٩]/) // no Arabic-Indic digits
    expect(formatKwd(1_234_500, 'ar')).toContain('1,234.500')
  })
})
