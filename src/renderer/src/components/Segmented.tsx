import { motion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { spring } from '../motion'
import s from './Segmented.module.css'

interface Option<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedProps<T extends string> {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
}

/** Tab-like choice with a sliding indicator (shared layout animation). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md'
}: SegmentedProps<T>): React.JSX.Element {
  const id = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKey = (e: KeyboardEvent, i: number): void => {
    // RTL: the left arrow moves forward (to the next option).
    const delta = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + options.length) % options.length
    const opt = options[next]
    if (opt) {
      onChange(opt.value)
      refs.current[next]?.focus()
    }
  }

  return (
    <div className={`${s.group} ${s[size]}`} role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={s.option}
            data-active={active || undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                className={s.indicator}
                transition={spring.snappy}
              />
            ) : null}
            <span className={s.text}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
