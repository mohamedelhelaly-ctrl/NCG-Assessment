import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '../hooks/usePageTitle'
import { api } from '../lib/api'

type State = { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string }

export default function StatusPage() {
  const { t } = useTranslation()
  usePageTitle('title.home')
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
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-semibold">{t('app.name')}</h1>
      {state.kind === 'loading' && <p role="status">{t('status.checking')}</p>}
      {state.kind === 'ok' && <p role="status">{t('status.reachable')}</p>}
      {state.kind === 'error' && <p role="alert" className="text-danger">{t('status.unreachable', { message: state.message })}</p>}
    </main>
  )
}
