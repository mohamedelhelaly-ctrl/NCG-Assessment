import { describe, expect, test } from 'vitest'
import {
  MAX_BUNDLES,
  bestValueId,
  lineTotal,
  packCount,
  parseBundles,
  perPack,
  savingsPercent,
} from './pricing'

const t = (id: number, units: number, price_fils: number) => ({ id, units, price_fils })
const ladder = [t(1, 1, 5500), t(2, 4, 19500), t(3, 12, 55000)]

describe('bundle arithmetic', () => {
  test('two purchases of the 4-pack offer at 19.500 is 39.000 and 8 packs (the brief)', () => {
    expect(lineTotal(ladder[1], 2)).toBe(39000)
    expect(packCount(ladder[1], 2)).toBe(8)
  })

  test('the bundle price is the total, never multiplied by the pack count', () => {
    expect(lineTotal(ladder[2], 1)).toBe(55000)
    expect(lineTotal(ladder[0], 99)).toBe(544500)
    expect(packCount(ladder[2], 3)).toBe(36)
  })

  test('price per pack rounds to the nearest fil', () => {
    expect(perPack(ladder[0])).toBe(5500)
    expect(perPack(ladder[1])).toBe(4875)
    expect(perPack(ladder[2])).toBe(4583) // 4583.33
    expect(perPack(t(9, 3, 24000))).toBe(8000)
    expect(perPack(t(9, 6, 6500))).toBe(1083) // 1083.33
  })
})

describe('best value', () => {
  test('is the lowest price per pack', () => {
    expect(bestValueId(ladder)).toBe(3)
    expect(bestValueId([t(1, 1, 1750), t(2, 4, 6250), t(3, 12, 18000)])).toBe(3)
  })

  test('is not shown for a single offer', () => {
    expect(bestValueId([ladder[0]])).toBeNull()
    expect(bestValueId([])).toBeNull()
  })

  test('is not shown when every offer costs the same per pack', () => {
    expect(bestValueId([t(1, 1, 1000), t(2, 4, 4000)])).toBeNull()
  })

  test('compares exactly, without rounding errors', () => {
    // 5 packs at 6.500 is 1.3000 per pack; 20 at 22.000 is 1.1000
    expect(bestValueId([t(1, 1, 1500), t(2, 5, 6500), t(3, 20, 22000)])).toBe(3)
  })

  test('works whatever the order of the tiers', () => {
    expect(bestValueId([ladder[2], ladder[0], ladder[1]])).toBe(3)
  })
})

describe('savings versus the single pack', () => {
  test('as a whole percent per pack', () => {
    expect(savingsPercent(ladder[1], ladder)).toBe(11)
    expect(savingsPercent(ladder[2], ladder)).toBe(17)
  })

  test('is zero for the single pack itself', () => {
    expect(savingsPercent(ladder[0], ladder)).toBe(0)
  })

  test('is zero when there is no single pack to compare with', () => {
    const noSingle = [t(1, 2, 12000), t(2, 6, 30000)]
    expect(savingsPercent(noSingle[1], noSingle)).toBe(0)
  })

  test('is never negative', () => {
    expect(savingsPercent(t(2, 4, 30000), [t(1, 1, 5500), t(2, 4, 30000)])).toBe(0)
  })
})

describe('parseBundles', () => {
  test.each([
    ['1', 1],
    ['4', 4],
    [' 12 ', 12],
    ['99', 99],
    ['007', 7],
  ])('accepts %j', (text, value) => {
    expect(parseBundles(text)).toBe(value)
  })

  test.each(['', '0', '100', '-1', '1.5', 'abc', '1e2', '1 2', '9999', ' '])('rejects %j', (text) => {
    expect(parseBundles(text)).toBeNull()
  })

  test('the maximum is 99', () => {
    expect(MAX_BUNDLES).toBe(99)
  })
})
