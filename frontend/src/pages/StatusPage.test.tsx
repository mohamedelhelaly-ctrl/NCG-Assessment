import { render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import StatusPage from './StatusPage'

afterEach(() => vi.unstubAllGlobals())

test('shows success when the API answers', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }))))
  render(<StatusPage />)
  expect(await screen.findByText(/reachable/i)).toBeInTheDocument()
})

test('shows an error when the API is down', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
  render(<StatusPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/unreachable/i)
})
