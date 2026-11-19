/** Line icons drawn on a 24px grid, in the current text colour. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function ShopIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 9.5 5 4.5h14l1.5 5" />
      <path d="M3.5 9.5a2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.8 0" />
      <path d="M5 11.8V19.5h14v-7.7" />
      <path d="M10 19.5v-4.5h4v4.5" />
    </svg>
  )
}

export function CartIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 3.5h2.6l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7.5H6" />
      <circle cx="9.5" cy="19.5" r="1.25" />
      <circle cx="17" cy="19.5" r="1.25" />
    </svg>
  )
}

export function SearchIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

export function PlusIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg {...base} strokeWidth={2} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CheckIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg {...base} strokeWidth={2} className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

/** Points to the end of the line (right in English); mirror it in right-to-left with rtl:-scale-x-100. */
export function ChevronIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg {...base} strokeWidth={2.25} className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function MenuIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg {...base} strokeWidth={2} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CloseIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg {...base} strokeWidth={2} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
