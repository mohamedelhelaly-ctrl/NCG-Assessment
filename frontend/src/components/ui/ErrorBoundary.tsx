import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Last line of defence: if a page crashes unexpectedly, show a calm screen with a way out instead
 * of a blank page. It sits outside the router, so it uses plain links.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Unexpected error', error, info.componentStack)
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children
  }
}

function CrashScreen() {
  const { t } = useTranslation()
  return (
    <main role="alert" className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <span aria-hidden="true" className="inline-grid w-fit grid-cols-2 gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="size-[0.75rem] rounded-[2px] bg-primary" />
        ))}
      </span>
      <h1 className="text-2xl font-semibold">{t('error.title')}</h1>
      <p className="text-muted">{t('error.body')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('error.reload')}
        </button>
        <a href="/" className="btn">
          {t('error.home')}
        </a>
      </div>
    </main>
  )
}
