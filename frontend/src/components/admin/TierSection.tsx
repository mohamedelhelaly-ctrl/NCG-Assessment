import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '../../lib/api'
import { errorText } from '../../lib/errors'
import { formatKwd } from '../../lib/money'
import { draftFromTier, emptyDraft, validateTier } from '../../lib/tiers'
import type { TierDraft, TierErrors } from '../../lib/tiers'
import type { TierAdmin } from '../../lib/types'
import ConfirmDialog from '../ui/ConfirmDialog'
import { EmptyState, ErrorState } from '../ui/Feedback'
import TierFields from './TierFields'

interface Props {
  productId: number
  tiers: TierAdmin[]
  /** Called after any change so the page can reload the product. */
  onChanged: (message?: string) => void
}

/** Edit mode: every tier saves on its own, straight to the server. */
export default function TierSection({ productId, tiers, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  return (
    <section aria-labelledby="tiers-heading" className="space-y-4">
      <div>
        <h3 id="tiers-heading" className="text-lg font-semibold">
          {t('admin.tiers.title')}
        </h3>
        <p className="mt-1 max-w-prose text-sm text-muted">{t('admin.tiers.intro')}</p>
      </div>
      {tiers.length === 0 && <EmptyState>{t('admin.tiers.empty')}</EmptyState>}
      <div className="records">
        {tiers.map((tier) => (
          <TierRow
            key={tier.id}
            tier={tier}
            summary={`${tier.label} · ${formatKwd(tier.price_fils, i18n.language)}`}
            onChanged={onChanged}
          />
        ))}
        <NewTierRow productId={productId} onChanged={onChanged} />
      </div>
    </section>
  )
}

/** Shared by the edit row and the new row: validate, call, and map server errors to fields. */
function useTierSave(
  draft: TierDraft,
  call: (value: NonNullable<ReturnType<typeof validateTier>['value']>) => Promise<void>,
) {
  const { t } = useTranslation()
  const [errors, setErrors] = useState<TierErrors>({})
  const [rowError, setRowError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<boolean> {
    const { errors: found, value } = validateTier(draft, t)
    setErrors(found)
    setRowError(null)
    if (!value) return false
    setBusy(true)
    try {
      await call(value)
      return true
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate_units') {
        setErrors({ units: errorText(t, e) })
      } else if (e instanceof ApiError && Object.keys(e.fields).length > 0) {
        setErrors(e.fields as TierErrors)
      } else {
        setRowError(e)
      }
      return false
    } finally {
      setBusy(false)
    }
  }
  return { errors, rowError, busy, save, clearErrors: () => setErrors({}) }
}

function TierRow({
  tier,
  summary,
  onChanged,
}: {
  tier: TierAdmin
  summary: string
  onChanged: (message?: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<TierDraft>(() => draftFromTier(tier))
  const [confirming, setConfirming] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<unknown>(null)
  const { errors, rowError, busy, save } = useTierSave(draft, async (value) => {
    await api.put(`/api/v1/admin/tiers/${tier.id}`, value)
  })

  async function confirmDelete() {
    setDeleteBusy(true)
    try {
      const result = await api.delete<{ product_deactivated: boolean }>(
        `/api/v1/admin/tiers/${tier.id}`,
      )
      onChanged(result.product_deactivated ? t('admin.tiers.deactivated') : t('common.deleted'))
    } catch (e) {
      setDeleteError(e)
      setConfirming(false)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div role="group" aria-label={summary} className="space-y-3 p-4">
      <TierFields
        draft={draft}
        fallbackTitle={tier.label}
        onChange={setDraft}
        errors={errors}
        disabled={busy}
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={async () => {
                if (await save()) onChanged(t('common.saved'))
              }}
            >
              {busy ? t('common.saving') : t('admin.tiers.saveRow')}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => setConfirming(true)}
            >
              {t('common.delete')}
            </button>
          </>
        }
      />
      {rowError !== null && <ErrorState message={errorText(t, rowError)} />}
      {deleteError !== null && <ErrorState message={errorText(t, deleteError)} />}
      <ConfirmDialog
        open={confirming}
        title={t('admin.tiers.deleteTitle')}
        body={t('admin.tiers.deleteBody', { name: tier.label })}
        confirmLabel={t('common.delete')}
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}

function NewTierRow({
  productId,
  onChanged,
}: {
  productId: number
  onChanged: (message?: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<TierDraft>(emptyDraft)
  const { errors, rowError, busy, save, clearErrors } = useTierSave(draft, async (value) => {
    await api.post(`/api/v1/admin/products/${productId}/tiers`, value)
  })

  return (
    <div role="group" aria-label={t('admin.tiers.newRow')} className="space-y-3 bg-paper p-4">
      <TierFields
        draft={draft}
        fallbackTitle={t('admin.tiers.newRow')}
        onChange={setDraft}
        errors={errors}
        disabled={busy}
        actions={
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy}
            onClick={async () => {
              if (await save()) {
                setDraft(emptyDraft())
                clearErrors()
                onChanged(t('admin.tiers.added'))
              }
            }}
          >
            {busy ? t('common.saving') : t('admin.tiers.addButton')}
          </button>
        }
      />
      {rowError !== null && <ErrorState message={errorText(t, rowError)} />}
    </div>
  )
}
