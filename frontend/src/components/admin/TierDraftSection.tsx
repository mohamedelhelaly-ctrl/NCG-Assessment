import { useTranslation } from 'react-i18next'
import { emptyDraft } from '../../lib/tiers'
import type { TierDraft, TierErrors } from '../../lib/tiers'
import TierFields from './TierFields'

interface Props {
  drafts: TierDraft[]
  onChange: (drafts: TierDraft[]) => void
  errors: Record<string, TierErrors>
}

/** Used while creating a product: tiers are collected locally and sent with the product. */
export default function TierDraftSection({ drafts, onChange, errors }: Props) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="tiers-heading" className="space-y-4">
      <div>
        <h3 id="tiers-heading" className="text-lg font-semibold">
          {t('admin.tiers.title')}
        </h3>
        <p className="mt-1 max-w-prose text-sm text-muted">{t('admin.tiers.intro')}</p>
      </div>
      {drafts.length > 0 && (
        <div className="records">
          {drafts.map((draft, index) => {
            const title = t('admin.tiers.rowLabel', { number: index + 1 })
            return (
              <div key={draft.key} role="group" aria-label={title} className="p-4">
                <TierFields
                  draft={draft}
                  fallbackTitle={title}
                  onChange={(next) => onChange(drafts.map((d) => (d.key === draft.key ? next : d)))}
                  errors={errors[draft.key]}
                  actions={
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => onChange(drafts.filter((d) => d.key !== draft.key))}
                    >
                      {t('common.remove')}
                    </button>
                  }
                />
              </div>
            )
          })}
        </div>
      )}
      <button type="button" className="btn" onClick={() => onChange([...drafts, emptyDraft()])}>
        {t('admin.tiers.add')}
      </button>
    </section>
  )
}
