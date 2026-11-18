import { useTranslation } from 'react-i18next'

export function LoadingState() {
  const { t } = useTranslation()
  return (
    <p role="status" className="py-8 text-muted">
      {t('common.loading')}
    </p>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-md border-s-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center text-muted">
      {children}
    </p>
  )
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-md border-s-4 border-primary bg-primary-soft px-4 py-2.5 text-sm text-primary-strong"
    >
      {children}
    </p>
  )
}
