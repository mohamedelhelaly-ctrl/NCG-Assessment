import { useTranslation } from 'react-i18next'

export function LoadingState() {
  const { t } = useTranslation()
  return (
    <p role="status" className="py-6 text-slate-600">
      {t('common.loading')}
    </p>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="space-y-2 rounded border border-red-300 bg-red-50 p-4 text-red-800">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-600">{children}</p>
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
      {children}
    </p>
  )
}
