import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import i18n from '../lib/i18n'

// Tests must never reach a real server. A page that is still unmounting can fire a request after a
// test's own mock is gone; without this guard it would hit a locally running API (and a 401 from
// there would sign out the next test's user).
const noNetwork = () => Promise.reject(new TypeError('Network access is disabled in tests'))

beforeEach(async () => {
  vi.stubGlobal('fetch', noNetwork)
  localStorage.clear()
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup() // unmount first, so nothing can start a request while the mock is being removed
  vi.stubGlobal('fetch', noNetwork)
})
