import { motion } from 'motion/react'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { spring } from '../motion'
import s from './Slider.module.css'
import { rtl } from '../lib/language'

interface SliderProps {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  label: string
  valueText: (v: number) => string
}

/**
 * The track fills from the reading start (right in Arabic, left in English).
 * The knob follows with a spring; keyboard and pointer both work.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  valueText
}: SliderProps): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null)
  const ratio = (value - min) / (max - min)

  const setFromPointer = (clientX: number): void => {
    const el = track.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Measured from the reading start.
    const fromStart = rtl() ? r.right - clientX : clientX - r.left
    const t = Math.min(1, Math.max(0, fromStart / r.width))
    const raw = min + t * (max - min)
    const snapped = Math.round(raw / step) * step
    if (snapped !== value) onChange(Math.min(max, Math.max(min, snapped)))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromPointer(e.clientX)
  }

  const keyTarget = (key: string): number | null => {
    switch (key) {
      case 'ArrowUp':
        return value + step
      case 'ArrowDown':
        return value - step
      case 'ArrowLeft':
        return rtl() ? value + step : value - step
      case 'ArrowRight':
        return rtl() ? value - step : value + step
      case 'Home':
        return min
      case 'End':
        return max
      case 'PageUp':
        return value + step * 5
      case 'PageDown':
        return value - step * 5
      default:
        return null
    }
  }

  const onKey = (e: KeyboardEvent): void => {
    const next = keyTarget(e.key)
    if (next === null) return
    e.preventDefault()
    onChange(Math.min(max, Math.max(min, next)))
  }

  return (
    <div
      ref={track}
      className={s.slider}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText(value)}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromPointer(e.clientX)
      }}
      onKeyDown={onKey}
    >
      <div className={s.rail}>
        <motion.div
          className={s.fill}
          initial={false}
          animate={{ scaleX: ratio }}
          transition={spring.snappy}
        />
      </div>
      {/* The lane spans the track; translating it by a share of its own width moves the knob with transforms only. */}
      <motion.div
        className={s.lane}
        initial={false}
        animate={{ x: `${-ratio * 100}%` }}
        transition={spring.snappy}
      >
        <span className={s.knob} />
      </motion.div>
    </div>
  )
}
