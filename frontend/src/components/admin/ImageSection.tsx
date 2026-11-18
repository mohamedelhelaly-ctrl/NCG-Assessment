import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '../../lib/api'
import { errorText } from '../../lib/errors'
import type { ImageAdmin } from '../../lib/types'
import Field from '../common/Field'
import ConfirmDialog from '../ui/ConfirmDialog'
import { EmptyState, ErrorState } from '../ui/Feedback'

const MAX_IMAGES = 10
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface Props {
  productId: number
  images: ImageAdmin[]
  onChanged: (message?: string) => void
}

/** Upload, reorder (the first image is the main one), edit alt text and delete. */
export default function ImageSection({ productId, images, onChanged }: Props) {
  const { t } = useTranslation()
  const base = `/api/v1/admin/products/${productId}/images`
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [altAr, setAltAr] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<ImageAdmin | null>(null)
  const full = images.length >= MAX_IMAGES

  async function upload(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!file) next.file = t('validation.fileRequired')
    else if (!TYPES.includes(file.type)) next.file = t('validation.imageType')
    else if (file.size > MAX_BYTES) next.file = t('validation.imageSize')
    if (!alt.trim()) next.alt = t('validation.required')
    else if (alt.trim().length > 200) next.alt = t('validation.maxLength', { max: 200 })
    if (altAr.trim().length > 200) next.alt_ar = t('validation.maxLength', { max: 200 })
    setErrors(next)
    setError(null)
    if (Object.keys(next).length > 0 || !file) return

    const form = new FormData()
    form.append('file', file)
    form.append('alt', alt.trim())
    if (altAr.trim()) form.append('alt_ar', altAr.trim())
    setBusy(true)
    try {
      await api.post(base, form)
      setFile(null)
      setAlt('')
      setAltAr('')
      if (fileRef.current) fileRef.current.value = ''
      onChanged(t('admin.images.uploaded'))
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) setErrors(e.fields)
      else setError(e)
    } finally {
      setBusy(false)
    }
  }

  async function reorder(ids: number[]) {
    setBusy(true)
    setError(null)
    try {
      await api.put(`${base}/order`, { image_ids: ids })
      onChanged(t('common.saved'))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, to: number) {
    const ids = images.map((i) => i.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(to, 0, moved)
    void reorder(ids)
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await api.delete(`/api/v1/admin/images/${deleting.id}`)
      onChanged(t('common.deleted'))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  return (
    <section aria-labelledby="images-heading" className="space-y-4">
      <div>
        <h3 id="images-heading" className="text-lg font-semibold">
          {t('admin.images.title')}
        </h3>
        <p className="mt-1 max-w-prose text-sm text-muted">{t('admin.images.hint', { max: MAX_IMAGES })}</p>
      </div>
      {error !== null && <ErrorState message={errorText(t, error)} />}

      {images.length === 0 && <EmptyState>{t('admin.images.empty')}</EmptyState>}
      {images.length > 0 && (
        <ul className="records">
          {images.map((image, index) => (
            <ImageCard
              key={image.id}
              image={image}
              index={index}
              isMain={index === 0}
              canMoveUp={index > 0}
              canMoveDown={index < images.length - 1}
              busy={busy}
              onMove={(to) => move(index, to)}
              onDelete={() => setDeleting(image)}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={upload}
        noValidate
        className="space-y-4 rounded-lg border border-dashed border-line bg-surface p-4"
        aria-label={t('admin.images.upload')}
      >
        <h4 className="font-semibold">{t('admin.images.upload')}</h4>
        {full && <p className="text-sm text-amber">{t('admin.images.full', { max: MAX_IMAGES })}</p>}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="image-file"
              ref={fileRef}
              type="file"
              className="peer sr-only"
              accept={TYPES.join(',')}
              disabled={full || busy}
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={errors.file ? 'image-file-error' : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="image-file"
              className="btn cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
            >
              {t('admin.images.file')}
            </label>
            <span className="min-w-0 truncate text-sm text-muted">
              {file ? file.name : t('admin.images.noFile')}
            </span>
          </div>
          {errors.file && (
            <p id="image-file-error" className="text-sm text-danger">
              {errors.file}
            </p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={t('admin.images.altEn')}
dir="ltr"
lang="en"
            value={alt}
            onChange={setAlt}
            error={errors.alt}
            maxLength={200}
            disabled={full || busy}
          />
          <Field
            label={t('admin.images.altAr')}
            value={altAr}
            onChange={setAltAr}
            error={errors.alt_ar}
            dir="rtl"
            lang="ar"
            maxLength={200}
            disabled={full || busy}
            hint={altAr.trim() ? undefined : t('admin.form.arabicHintShort')}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={full || busy}>
          {busy ? t('common.working') : t('admin.images.uploadButton')}
        </button>
      </form>

      <ConfirmDialog
        open={deleting !== null}
        title={t('admin.images.deleteTitle')}
        body={t('admin.images.deleteBody')}
        confirmLabel={t('common.delete')}
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}

function ImageCard({
  image,
  index,
  isMain,
  canMoveUp,
  canMoveDown,
  busy,
  onMove,
  onDelete,
  onChanged,
}: {
  image: ImageAdmin
  index: number
  isMain: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  onMove: (to: number) => void
  onDelete: () => void
  onChanged: (message?: string) => void
}) {
  const { t } = useTranslation()
  const [alt, setAlt] = useState(image.alt)
  const [altAr, setAltAr] = useState(image.alt_ar ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  async function saveAlt() {
    const next: Record<string, string> = {}
    if (!alt.trim()) next.alt = t('validation.required')
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    setError(null)
    try {
      await api.put(`/api/v1/admin/images/${image.id}`, {
        alt: alt.trim(),
        alt_ar: altAr.trim() || null,
      })
      onChanged(t('common.saved'))
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) setErrors(e.fields)
      else setError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md bg-paper">
        <img src={image.url} alt={image.alt} className="h-full w-full object-cover" />
        {isMain && (
          <span className="badge badge-ok absolute start-1.5 top-1.5 bg-surface/95">
            {t('admin.images.main')}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label={t('admin.images.altEn')}
dir="ltr"
lang="en"
            value={alt}
            onChange={setAlt}
            error={errors.alt}
            maxLength={200}
          />
          <Field
            label={t('admin.images.altAr')}
            value={altAr}
            onChange={setAltAr}
            error={errors.alt_ar}
            dir="rtl"
            lang="ar"
            maxLength={200}
          />
        </div>
        {error !== null && <ErrorState message={errorText(t, error)} />}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={saving || busy}
              onClick={() => void saveAlt()}
            >
              {saving ? t('common.saving') : t('admin.images.saveAlt')}
            </button>
            <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={onDelete}>
              {t('common.delete')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isMain && (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => onMove(0)}>
                {t('admin.images.makeMain')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm"
              disabled={!canMoveUp || busy}
              onClick={() => onMove(index - 1)}
            >
              {t('admin.images.moveEarlier')}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!canMoveDown || busy}
              onClick={() => onMove(index + 1)}
            >
              {t('admin.images.moveLater')}
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
