import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { duration, ease } from '../motion'
import s from './Select.module.css'

export interface SelectOption<T extends string> {
  value: T
  label: ReactNode
  hint?: ReactNode
}

interface SelectProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (v: T) => void
  label: string
}

/** Accessible listbox dropdown with keyboard navigation and an animated popover. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label
}: SelectProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const openList = (): void => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value)
      )
    )
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => list.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  const choose = (i: number): void => {
    const o = options[i]
    if (o) onChange(o.value)
    setOpen(false)
  }

  const onListKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(options.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Home') {
      setActive(0)
    } else if (e.key === 'End') {
      setActive(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
    }
  }

  useEffect(() => {
    if (open)
      list.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  return (
    <div ref={root} className={s.root}>
      <button
        type="button"
        className={s.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            openList()
          }
        }}
      >
        <span className={s.current}>{current?.label}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: duration.base }}
          className={s.chev}
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-opt-${active}`}
            className={s.list}
            onKeyDown={onListKey}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: duration.base, ease: ease.out }
            }}
            exit={{ opacity: 0, y: -4, transition: { duration: duration.fast } }}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                data-index={i}
                aria-selected={o.value === value}
                data-active={i === active || undefined}
                className={s.option}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {o.hint ? <span className={s.hint}>{o.hint}</span> : null}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
