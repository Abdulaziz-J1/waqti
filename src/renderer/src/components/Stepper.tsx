import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { common } from '@shared/strings'
import s from './Stepper.module.css'

interface StepperProps {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format: (v: number) => ReactNode
  label: string
}

/**
 * Minus / value / plus with press-and-hold repeat. In RTL the minus button is
 * on the right (start) and plus on the left (end).
 */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  label
}: StepperProps): React.JSX.Element {
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  const bump = (dir: 1 | -1): void => {
    const next = Math.min(max, Math.max(min, valueRef.current + dir * step))
    if (next !== valueRef.current) {
      valueRef.current = next
      onChange(next)
    }
  }

  const hold = (dir: 1 | -1): void => {
    bump(dir)
    let delay = 380
    const repeat = (): void => {
      bump(dir)
      delay = Math.max(60, delay * 0.8)
      timer.current = setTimeout(repeat, delay)
    }
    timer.current = setTimeout(repeat, delay)
  }

  return (
    <div
      className={s.stepper}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault()
          bump(1)
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault()
          bump(-1)
        }
      }}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={common.minus}
        className={s.btn}
        disabled={value <= min}
        onPointerDown={(e) => {
          e.preventDefault()
          hold(-1)
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
      >
        <Minus size={16} strokeWidth={2} />
      </button>
      <span className={`${s.value} num`}>{format(value)}</span>
      <button
        type="button"
        tabIndex={-1}
        aria-label={common.plus}
        className={s.btn}
        disabled={value >= max}
        onPointerDown={(e) => {
          e.preventDefault()
          hold(1)
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
