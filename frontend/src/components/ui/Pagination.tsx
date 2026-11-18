import { useTranslation } from 'react-i18next'

interface Props {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onChange }: Props) {
  const { t } = useTranslation()
  if (totalPages <= 1) return null
  return (
    <nav aria-label={t('common.pagination')} className="flex items-center justify-between gap-3">
      <button type="button" className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t('common.previous')}
      </button>
      <span className="text-sm text-muted">{t('common.pageOf', { page, total: totalPages })}</span>
      <button
        type="button"
        className="btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        {t('common.next')}
      </button>
    </nav>
  )
}
