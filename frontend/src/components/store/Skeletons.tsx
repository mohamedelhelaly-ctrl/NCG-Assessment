import { useTranslation } from 'react-i18next'

const block = 'rounded-lg bg-line/50'

/** Quiet grey blocks where the products will be, so the page does not jump when they arrive. */
export function ProductGridSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('store.loading')} className="grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} aria-hidden="true" className="space-y-3">
          <div className={`aspect-[4/3] ${block}`} />
          <div className={`h-5 w-2/3 ${block}`} />
          <div className={`h-20 ${block}`} />
        </div>
      ))}
    </div>
  )
}

export function ProductPageSkeleton() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-label={t('common.loading')} className="grid gap-10 lg:grid-cols-2">
      <div aria-hidden="true" className={`aspect-[4/3] ${block}`} />
      <div aria-hidden="true" className="space-y-4">
        <div className={`h-8 w-3/4 ${block}`} />
        <div className={`h-4 w-1/3 ${block}`} />
        <div className={`h-52 ${block}`} />
      </div>
    </div>
  )
}
