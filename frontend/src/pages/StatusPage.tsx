import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type State = { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string }

export default function StatusPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    api
      .get<{ status: string }>('/healthz')
      .then(() => !cancelled && setState({ kind: 'ok' }))
      .catch((e: Error) => !cancelled && setState({ kind: 'error', message: e.message }))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Shop</h1>
      {state.kind === 'loading' && <p role="status">Checking the API…</p>}
      {state.kind === 'ok' && <p role="status">API and database are reachable.</p>}
      {state.kind === 'error' && <p role="alert">API unreachable: {state.message}</p>}
    </main>
  )
}
