import { useTranslation } from 'react-i18next'
import { formatKwd } from '../../lib/money'
import { bestValueId, perPack, savingsPercent } from '../../lib/pricing'
import type { Tier } from '../../lib/types'
import PackGlyph from '../ui/PackGlyph'

interface Props {
  tiers: Tier[]
  selectedId: number
  onSelect: (tierId: number) => void
  /** Radio group name; unique per product on a page that lists several. */
  name: string
  /** Narrow layout for listing cards: two lines per row, no savings text. */
  compact?: boolean
}

/**
 * The price ladder: one row per bundle with the pack glyph, the bundle price and the price per
 * pack. The cheapest pack is marked "Best value". Works for one, two, three or more tiers.
 */
export default function OfferList({ tiers, selectedId, onSelect, name, compact = false }: Props) {
  const { t, i18n } = useTranslation()
  const best = bestValueId(tiers)
  const money = (fils: number) => formatKwd(fils, i18n.language)
  const rowBase =
    'rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary'

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="sr-only">{t('store.offerLegend')}</legend>
      {tiers.map((tier) => {
        const saving = savingsPercent(tier, tiers)
        return (
          <label key={tier.id} className="block cursor-pointer">
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              value={tier.id}
              checked={tier.id === selectedId}
              onChange={() => onSelect(tier.id)}
            />
            {compact ? (
              <span className={`${rowBase} grid grid-cols-[3.1rem_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5`}>
                <span className="row-span-2 self-center">
                  <PackGlyph units={tier.units} />
                </span>
                <bdi className="self-end whitespace-nowrap font-medium">{tier.label}</bdi>
                <span className="self-end text-end font-semibold tabular-nums">{money(tier.price_fils)}</span>
                <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 self-start text-xs">
                  {tier.units > 1 && (
                    <span className="font-medium tabular-nums text-amber">
                      {t('store.perPack', { price: money(perPack(tier)) })}
                    </span>
                  )}
                  {best === tier.id && <span className="badge badge-ok !px-1.5 !py-0">{t('store.bestValue')}</span>}
                </span>
              </span>
            ) : (
              <span className={`${rowBase} grid grid-cols-[3.1rem_minmax(0,1fr)_auto] items-center gap-x-3`}>
                <PackGlyph units={tier.units} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <bdi className="font-medium">{tier.label}</bdi>
                    {best === tier.id && (
                      <span className="badge badge-ok !px-1.5 !py-0">{t('store.bestValue')}</span>
                    )}
                  </span>
                  {saving > 0 && (
                    <span className="block text-xs text-muted">{t('store.save', { percent: saving })}</span>
                  )}
                </span>
                <span className="text-end">
                  <span className="block font-semibold tabular-nums">{money(tier.price_fils)}</span>
                  {tier.units > 1 && (
                    <span className="block text-xs font-medium tabular-nums text-amber">
                      {t('store.perPack', { price: money(perPack(tier)) })}
                    </span>
                  )}
                </span>
              </span>
            )}
          </label>
        )
      })}
    </fieldset>
  )
}
