import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface State<T> {
  requestKey: string
  data: T | null
  error: unknown
}

/**
 * Load data and refetch when `key` or the language changes (responses depend on the language).
 * Stale responses are ignored. `loading` is derived, and the previous data stays available while a
 * refetch runs, so lists do not flash empty. `reload` refetches the same request.
 */
export function useApi<T>(key: string, fetcher: () => Promise<T>) {
  const { i18n } = useTranslation()
  const [version, setVersion] = useState(0)
  const requestKey = `${key}|${i18n.language}|${version}`
  const fetcherRef = useRef(fetcher)
  const [state, setState] = useState<State<T>>({ requestKey: '', data: null, error: null })

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let cancelled = false
    fetcherRef
      .current()
      .then((data) => !cancelled && setState({ requestKey, data, error: null }))
      .catch((error) => !cancelled && setState((s) => ({ requestKey, data: s.data, error })))
    return () => {
      cancelled = true
    }
  }, [requestKey])

  const loading = state.requestKey !== requestKey
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data: state.data, error: loading ? null : state.error, loading, reload }
}
