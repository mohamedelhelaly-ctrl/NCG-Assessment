import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { CheckIcon, ChevronIcon } from './Icons'

export interface DropdownOption {
  value: string
  label: string
}

interface Props {
  label: string
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  className?: string
}

/** A styled listbox that replaces the browser's own select menu. Keyboard: arrows, Home/End, Enter, Escape. */
export default function Dropdown({ label, value, options, onChange, className = '' }: Props) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = Math.max(0, options.findIndex((o) => o.value === value))

  useEffect(() => {
    if (!open) return
    function away(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  function show() {
    setActive(selected)
    setOpen(true)
  }
  function pick(index: number) {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
  }
  function onKeyDown(event: KeyboardEvent) {
    const last = options.length - 1
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return show()
      setActive((i) => Math.min(last, Math.max(0, i + (event.key === 'ArrowDown' ? 1 : -1))))
    } else if (event.key === 'Home' && open) {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End' && open) {
      event.preventDefault()
      setActive(last)
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault()
      pick(active)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        className="input flex h-12 items-center justify-between gap-2 text-start transition-colors hover:border-primary"
        data-value={value}
      >
        <span className="truncate">{options[selected]?.label}</span>
        <ChevronIcon
          className={`size-4 shrink-0 text-teal transition-transform ${open ? '-rotate-90' : 'rotate-90'}`}
        />
      </button>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-auto rounded-lg border border-line bg-surface py-1.5 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(index)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-[15px] ${
                  index === active ? 'bg-teal/10 text-primary-strong' : ''
                } ${isSelected ? 'font-semibold' : ''}`}
              >
                <span>{option.label}</span>
                {isSelected && <CheckIcon className="size-4 shrink-0 text-teal" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
