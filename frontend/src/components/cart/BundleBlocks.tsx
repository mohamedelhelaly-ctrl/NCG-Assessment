import PackGlyph from '../ui/PackGlyph'

const MAX_BLOCKS = 6

/**
 * The cart's one idea, drawn: each bundle is a block of squares (one per pack), and you buy
 * several blocks. 2 bundles of 4 packs is two blocks of four, not eight separate purchases.
 * Decorative: the numbers are always written next to it.
 */
export default function BundleBlocks({ units, bundles }: { units: number; bundles: number }) {
  const shown = Math.min(bundles, MAX_BLOCKS)
  return (
    <span aria-hidden="true" className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {Array.from({ length: shown }, (_, i) => (
        <PackGlyph key={i} units={units} />
      ))}
      {bundles > MAX_BLOCKS && (
        <span className="text-xs font-medium text-muted">+{bundles - MAX_BLOCKS}</span>
      )}
    </span>
  )
}
