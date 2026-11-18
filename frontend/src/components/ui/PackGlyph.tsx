/**
 * One small square per pack (up to 12, then a "+"), so a bundle can be read at a glance:
 * 1 pack is a single square, 12 packs is a block. Decorative: the number is always written too.
 */
export default function PackGlyph({
  units,
  tone = 'primary',
}: {
  units: number
  tone?: 'primary' | 'light'
}) {
  const shown = Math.min(Math.max(units, 0), 12)
  const color = tone === 'light' ? 'bg-white' : 'bg-primary'
  return (
    <span aria-hidden="true" className="inline-grid w-[3.1rem] grid-cols-6 gap-[3px]">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`h-[0.42rem] rounded-[2px] ${color}`} />
      ))}
      {units > 12 && <span className="col-span-6 text-[10px] leading-none text-muted">+</span>}
    </span>
  )
}
