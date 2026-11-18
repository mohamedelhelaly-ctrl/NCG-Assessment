import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NamedCount } from '../../lib/types'

interface Props {
  categories: NamedCount[]
  brands: NamedCount[]
  category: string
  brand: string
  onCategory: (id: string) => void
  onBrand: (id: string) => void
}

/** Category and brand lists with counts. A button on a phone opens them; always open on desktop. */
export default function FilterPanel({ categories, brands, category, brand, onCategory, onBrand }: Props) {
  const { t } = useTranslation()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const active = (category ? 1 : 0) + (brand ? 1 : 0)
  const total = categories.reduce((sum, c) => sum + c.product_count, 0)

  return (
    <section aria-label={t('store.filterGroup')} className="min-w-0">
      <button
        type="button"
        className="btn w-full justify-between lg:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <span>{t('store.filters')}</span>
        {active > 0 && <span className="badge badge-ok">{active}</span>}
      </button>

      <div id={panelId} className={`${open ? 'mt-4 block' : 'hidden'} space-y-8 lg:mt-0 lg:block`}>
        <Group
          title={t('store.categoryTitle')}
          allLabel={t('store.allProducts')}
          allCount={total}
          items={categories}
          value={category}
          onChange={onCategory}
        />
        <Group
          title={t('store.brandTitle')}
          allLabel={t('store.allBrands')}
          items={brands}
          value={brand}
          onChange={onBrand}
        />
      </div>
    </section>
  )
}

function Group({
  title,
  allLabel,
  allCount,
  items,
  value,
  onChange,
}: {
  title: string
  allLabel: string
  allCount?: number
  items: NamedCount[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <ul className="space-y-0.5">
        <Option label={allLabel} count={allCount} selected={value === ''} onClick={() => onChange('')} />
        {items.map((item) => (
          <Option
            key={item.id}
            label={item.name}
            count={item.product_count}
            selected={value === String(item.id)}
            onClick={() => onChange(String(item.id))}
          />
        ))}
      </ul>
    </div>
  )
}

function Option({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count?: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={`flex w-full items-baseline justify-between gap-3 rounded-md border-s-2 px-3 py-1.5 text-start text-sm ${
          selected
            ? 'border-primary bg-primary-soft font-semibold text-primary-strong'
            : 'border-transparent text-muted hover:bg-primary-soft hover:text-ink'
        }`}
      >
        <bdi className="min-w-0">{label}</bdi>
        {count !== undefined && <span className="shrink-0 text-xs tabular-nums">{count}</span>}
      </button>
    </li>
  )
}
