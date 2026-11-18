import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, test } from 'vitest'
import { AuthProvider } from './auth'
import { CartProvider } from './cart'
import { useCart } from './cartContext'

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <CartProvider>{children}</CartProvider>
  </AuthProvider>
)
const setup = () => renderHook(() => useCart(), { wrapper })
const stored = () => JSON.parse(localStorage.getItem('cart:v1') ?? 'null')

describe('guest cart', () => {
  test('starts empty', () => {
    const { result } = setup()
    expect(result.current.lines).toEqual([])
    expect(result.current.count).toBe(0)
  })

  test('adds a line holding only ids and a bundle count (never a price)', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 2))
    expect(result.current.lines).toEqual([{ product_id: 7, tier_id: 12, bundles: 2 }])
    expect(stored()).toMatchObject({ owner: null, lines: [{ product_id: 7, tier_id: 12, bundles: 2 }] })
  })

  test('adding the same offer again joins the existing line', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 1))
    act(() => result.current.add(7, 12, 3))
    expect(result.current.lines).toEqual([{ product_id: 7, tier_id: 12, bundles: 4 }])
  })

  test('different offers of the same product stay separate lines', () => {
    const { result } = setup()
    act(() => result.current.add(7, 11, 1))
    act(() => result.current.add(7, 12, 1))
    act(() => result.current.add(7, 13, 1))
    expect(result.current.lines.map((l) => l.tier_id)).toEqual([11, 12, 13])
  })

  test('a line never goes above 99 bundles', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 98))
    act(() => result.current.add(7, 12, 5))
    expect(result.current.lines[0].bundles).toBe(99)
    act(() => result.current.add(8, 20, 500))
    expect(result.current.lines[1].bundles).toBe(99)
  })

  test('a quantity below one is raised to one', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 0))
    expect(result.current.lines[0].bundles).toBe(1)
  })

  test('the count is the total number of bundles', () => {
    const { result } = setup()
    act(() => result.current.add(7, 11, 2))
    act(() => result.current.add(8, 20, 3))
    expect(result.current.count).toBe(5)
  })

  test('setBundles changes a line and ignores invalid counts', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 2))
    act(() => result.current.setBundles(12, 5))
    expect(result.current.lines[0].bundles).toBe(5)
    for (const bad of [0, -1, 100, 2.5, Number.NaN]) {
      act(() => result.current.setBundles(12, bad))
    }
    expect(result.current.lines[0].bundles).toBe(5)
  })

  test('remove and clear', () => {
    const { result } = setup()
    act(() => result.current.add(7, 11, 1))
    act(() => result.current.add(7, 12, 1))
    act(() => result.current.remove(11))
    expect(result.current.lines.map((l) => l.tier_id)).toEqual([12])
    act(() => result.current.clear())
    expect(result.current.lines).toEqual([])
    expect(stored().lines).toEqual([])
  })

  test('the cart survives a reload (it is read back from storage)', () => {
    const first = setup()
    act(() => first.result.current.add(7, 12, 2))
    first.unmount()
    const second = setup()
    expect(second.result.current.lines).toEqual([{ product_id: 7, tier_id: 12, bundles: 2 }])
  })
})

describe('the merge id of a guest cart', () => {
  test('a guest cart with something in it has a merge id', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 1))
    expect(typeof stored().merge_id).toBe('string')
    expect(stored().merge_id.length).toBeGreaterThanOrEqual(8)
  })

  test('every change gives it a new id, so an id always stands for exactly these lines', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 1))
    const first = stored().merge_id
    act(() => result.current.add(7, 12, 1))
    const second = stored().merge_id
    act(() => result.current.setBundles(12, 5))
    const third = stored().merge_id
    expect(new Set([first, second, third]).size).toBe(3)
  })

  test('reading the cart again does not change its id (so a retry reuses it)', () => {
    const first = setup()
    act(() => first.result.current.add(7, 12, 1))
    const id = stored().merge_id
    first.unmount()
    setup()
    expect(stored().merge_id).toBe(id)
  })

  test('an empty cart has no merge id', () => {
    const { result } = setup()
    act(() => result.current.add(7, 12, 1))
    act(() => result.current.clear())
    expect(stored().merge_id).toBeUndefined()
  })
})

describe('damaged storage', () => {
  test.each([
    ['not json', 'oops{'],
    ['wrong shape', JSON.stringify({ lines: 'nope' })],
    ['null', 'null'],
    ['a number', '42'],
  ])('%s starts an empty cart', (_name, raw) => {
    localStorage.setItem('cart:v1', raw)
    expect(setup().result.current.lines).toEqual([])
  })

  test('invalid lines are dropped and the valid ones kept', () => {
    localStorage.setItem(
      'cart:v1',
      JSON.stringify({
        lines: [
          { product_id: 1, tier_id: 1, bundles: 2 },
          { product_id: 1, tier_id: 2, bundles: 0 },
          { product_id: 1, tier_id: 3, bundles: 100 },
          { product_id: 1, tier_id: 4, bundles: 1.5 },
          { product_id: 'x', tier_id: 5, bundles: 1 },
          { tier_id: 6, bundles: 1 },
          null,
        ],
      }),
    )
    expect(setup().result.current.lines).toEqual([{ product_id: 1, tier_id: 1, bundles: 2 }])
  })

  test('two lines for the same offer collapse to one', () => {
    localStorage.setItem(
      'cart:v1',
      JSON.stringify({
        lines: [
          { product_id: 1, tier_id: 1, bundles: 2 },
          { product_id: 1, tier_id: 1, bundles: 7 },
        ],
      }),
    )
    expect(setup().result.current.lines).toEqual([{ product_id: 1, tier_id: 1, bundles: 2 }])
  })

  test('when storage is blocked the cart still works for the visit', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    try {
      const { result } = setup()
      act(() => result.current.add(7, 12, 1))
      expect(result.current.lines).toHaveLength(1)
    } finally {
      Storage.prototype.setItem = original
    }
  })
})

describe('several tabs', () => {
  test('a change made in another tab shows up here', () => {
    const { result } = setup()
    act(() => {
      localStorage.setItem('cart:v1', JSON.stringify({ lines: [{ product_id: 3, tier_id: 9, bundles: 4 }] }))
      window.dispatchEvent(new StorageEvent('storage', { key: 'cart:v1' }))
    })
    expect(result.current.lines).toEqual([{ product_id: 3, tier_id: 9, bundles: 4 }])
  })
})
