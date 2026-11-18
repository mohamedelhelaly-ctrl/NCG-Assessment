import { useTranslation } from 'react-i18next'
import type { StoreImage } from '../../lib/types'
import PackGlyph from '../ui/PackGlyph'

/** A 4:3 picture frame. Without a picture it shows a quiet placeholder instead of a broken image. */
export default function ProductImage({
  image,
  priority = false,
}: {
  image: StoreImage | null
  priority?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-primary-soft/60">
      {image ? (
        <img
          src={image.url}
          alt={image.alt}
          width={1200}
          height={900}
          loading={priority ? 'eager' : 'lazy'}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted">
          <PackGlyph units={4} />
          {t('store.noImage')}
        </div>
      )}
    </div>
  )
}
