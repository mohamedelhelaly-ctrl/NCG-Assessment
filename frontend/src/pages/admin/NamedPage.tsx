import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Field from '../../components/common/Field'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState, Notice } from '../../components/ui/Feedback'
import { useApi } from '../../hooks/useApi'
import { usePageTitle } from '../../hooks/usePageTitle'
import { api, ApiError } from '../../lib/api'
import { errorText } from '../../lib/errors'
import type { NamedAdmin } from '../../lib/types'

type Kind = 'brand' | 'category'
const PATHS: Record<Kind, string> = {
  brand: '/api/v1/admin/brands',
  category: '/api/v1/admin/categories',
}

/** Brands and categories are managed the same way, so one page serves both. */
export default function NamedPage({ kind }: { kind: Kind }) {
  const { t } = useTranslation()
  usePageTitle(`admin.${kind}.title`)
  const path = PATHS[kind]
  const list = useApi(`named-${kind}`, () => api.get<NamedAdmin[]>(path))

  const [editing, setEditing] = useState<NamedAdmin | 'new' | null>(null)
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pageError, setPageError] = useState<unknown>(null)
  const [deleting, setDeleting] = useState<NamedAdmin | null>(null)
  const [busy, setBusy] = useState(false)

  function open(target: NamedAdmin | 'new') {
    setEditing(target)
    setName(target === 'new' ? '' : target.name)
    setNameAr(target === 'new' ? '' : (target.name_ar ?? ''))
    setErrors({})
    setFormError(null)
    setNotice(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = t('validation.required')
    else if (name.trim().length > 100) next.name = t('validation.maxLength', { max: 100 })
    if (nameAr.trim().length > 100) next.name_ar = t('validation.maxLength', { max: 100 })
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setFormError(null)
    const body = { name: name.trim(), name_ar: nameAr.trim() || null }
    try {
      if (editing === 'new') await api.post(path, body)
      else if (editing) await api.put(`${path}/${editing.id}`, body)
      setEditing(null)
      setNotice(t('common.saved'))
      list.reload()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'duplicate_name') {
        setErrors({ name: errorText(t, e) })
      } else if (e instanceof ApiError && Object.keys(e.fields).length > 0) {
        setErrors(e.fields)
      } else {
        setFormError(e)
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    setPageError(null)
    try {
      await api.delete(`${path}/${deleting.id}`)
      setNotice(t('common.deleted'))
      list.reload()
    } catch (e) {
      setPageError(e) // for example "Products using this brand: 3"
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  return (
    <section className="space-y-5" aria-labelledby={`${kind}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${kind}-heading`} className="text-2xl font-semibold">
          {t(`admin.${kind}.title`)}
        </h2>
        <button type="button" className="btn btn-primary" onClick={() => open('new')}>
          {t(`admin.${kind}.new`)}
        </button>
      </div>

      {notice && <Notice>{notice}</Notice>}
      {pageError !== null && <ErrorState message={errorText(t, pageError)} />}

      {editing && (
        <form
          onSubmit={onSubmit}
          noValidate
          className="space-y-4 rounded-lg border border-line bg-surface p-5"
        >
          <h3 className="text-lg font-semibold">
            {editing === 'new' ? t(`admin.${kind}.new`) : t(`admin.${kind}.edit`)}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t('admin.form.nameEn')}
dir="ltr"
lang="en"
              value={name}
              onChange={setName}
              error={errors.name}
              maxLength={100}
              required
            />
            <Field
              label={t('admin.form.nameAr')}
              value={nameAr}
              onChange={setNameAr}
              error={errors.name_ar}
              dir="rtl"
              lang="ar"
              maxLength={100}
              hint={nameAr.trim() ? undefined : t('admin.form.arabicHint')}
            />
          </div>
          {formError !== null && (
            <p role="alert" className="text-sm text-danger">
              {errorText(t, formError)}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {list.loading && !list.data && <LoadingState />}
      {list.error !== null && !list.data && (
        <ErrorState message={errorText(t, list.error)} onRetry={list.reload} />
      )}
      {list.data && list.data.length === 0 && <EmptyState>{t(`admin.${kind}.empty`)}</EmptyState>}
      {list.data && list.data.length > 0 && (
        <ul className="records">
          {list.data.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.display_name}</p>
                <p className="text-sm text-muted">
                  {item.name_ar ? `${item.name} / ${item.name_ar}` : t('admin.form.noArabic')}
                </p>
              </div>
              <span className="text-sm tabular-nums text-muted">
                {t('admin.productCount', { count: item.product_count })}
              </span>
              <button type="button" className="btn btn-sm" onClick={() => open(item)}>
                {t('common.edit')}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => setDeleting(item)}
              >
                {t('common.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t(`admin.${kind}.deleteTitle`)}
        body={t(`admin.${kind}.deleteBody`, { name: deleting?.display_name ?? '' })}
        confirmLabel={t('common.delete')}
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}
