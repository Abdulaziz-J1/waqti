import { AnimatePresence, motion } from 'motion/react'
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import { FOCUS_PRESETS, clampFocus, joinSeconds, splitSeconds } from '@shared/focus'
import { common, focusPage as t } from '@shared/strings'
import { useFmt } from '../lib/fmt'
import { duration, ease, spring } from '../motion'
import { Button } from './Button'
import s from './TimePicker.module.css'

const ITEM = 40

interface TimePickerProps {
  open: boolean
  seconds: number
  onChange: (seconds: number) => void
  onClose: () => void
  /** The clock face that opened the picker: clicks on it do not count as outside. */
  anchor: RefObject<HTMLElement | null>
}

/**
 * A drop-down under the dial's clock face: hours, minutes and seconds wheels
 * laid out like the clock (left to right), plus ready-made lengths. Wheels
 * turn with the mouse wheel, arrow keys, a click on a number or touch.
 */
export function TimePicker({
  open,
  seconds,
  onChange,
  onClose,
  anchor
}: TimePickerProps): React.JSX.Element {
  const fmt = useFmt()
  const box = useRef<HTMLDivElement>(null)
  const hms = splitSeconds(seconds)

  useEffect(() => {
    if (!open) return
    const first = requestAnimationFrame(() =>
      box.current?.querySelector<HTMLElement>('[data-unit="m"]')?.focus()
    )
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (box.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      const onWheel = (e.target as HTMLElement).getAttribute?.('role') === 'spinbutton'
      if (e.key === 'Escape' || (e.key === 'Enter' && onWheel)) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        anchor.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(first)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose, anchor])

  const set = (part: Partial<typeof hms>): void =>
    onChange(clampFocus(joinSeconds({ ...hms, ...part })))

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={box}
          role="dialog"
          aria-label={t.pickerTitle}
          className={s.pop}
          data-testid="time-picker"
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
          exit={{
            opacity: 0,
            y: -6,
            scale: 0.98,
            transition: { duration: duration.fast, ease: ease.inOut }
          }}
        >
          <span className={s.caret} aria-hidden />
          <header className={s.head}>
            <span className={s.title}>{t.pickerTitle}</span>
            <span className={s.words}>{fmt.dur(seconds * 1000, { round: 'round' })}</span>
          </header>

          <div className={s.wheels}>
            <span className={s.band} aria-hidden />
            <Wheel unit="h" count={24} value={hms.h} label={t.hours} onChange={(h) => set({ h })} />
            <span className={s.colon} aria-hidden>
              :
            </span>
            <Wheel
              unit="m"
              count={60}
              value={hms.m}
              label={t.minutes}
              onChange={(m) => set({ m })}
            />
            <span className={s.colon} aria-hidden>
              :
            </span>
            <Wheel
              unit="s"
              count={60}
              value={hms.s}
              label={t.seconds}
              onChange={(sec) => set({ s: sec })}
            />
          </div>

          <div className={s.presets} role="group" aria-label={t.presets}>
            {FOCUS_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${s.preset} num`}
                data-selected={p === seconds || undefined}
                aria-pressed={p === seconds}
                onClick={() => onChange(p)}
              >
                {fmt.durShort(p * 1000)}
              </button>
            ))}
          </div>

          <footer className={s.footer}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onClose()
                anchor.current?.focus()
              }}
              data-testid="time-picker-done"
            >
              {common.done}
            </Button>
          </footer>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** One wheel: a snapping column of two-digit numbers with the chosen one in the band. */
function Wheel({
  unit,
  count,
  value,
  label,
  onChange
}: {
  unit: 'h' | 'm' | 's'
  count: number
  value: number
  label: string
  onChange: (v: number) => void
}): React.JSX.Element {
  const fmt = useFmt()
  const ref = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const programmatic = useRef(false)
  const change = useRef(onChange)
  const current = useRef(value)
  useLayoutEffect(() => {
    change.current = onChange
    current.current = value
  })

  // Keep the column on the value (presets, clamping, keys) unless a finger is on it.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const top = value * ITEM
    if (Math.abs(el.scrollTop - top) < 1) return
    programmatic.current = true
    el.scrollTo({ top, behavior: mounted.current ? 'smooth' : 'instant' })
    mounted.current = true
  }, [value])

  // One step per wheel notch (touchpads add up their small deltas).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let acc = 0
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const notch = e.deltaMode !== 0 || Math.abs(e.deltaY) >= 50
      acc += notch ? Math.sign(e.deltaY) * ITEM : e.deltaY
      if (Math.abs(acc) < ITEM) return
      const dir = Math.sign(acc)
      acc = 0
      const next = Math.min(count - 1, Math.max(0, current.current + dir))
      if (next !== current.current) change.current(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [count])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const by: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 }
    let next: number | null = null
    if (e.key in by) next = value + by[e.key]!
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    if (next === null) return
    e.preventDefault()
    onChange(Math.min(count - 1, Math.max(0, next)))
  }

  const two = (n: number): string => fmt.num(n, { minimumIntegerDigits: 2 })

  return (
    <div className={s.wheelWrap}>
      <div
        ref={ref}
        className={s.wheel}
        role="spinbutton"
        tabIndex={0}
        data-unit={unit}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={value}
        aria-valuetext={fmt.num(value)}
        onKeyDown={onKeyDown}
        onScroll={() => {
          // Touch scrolling: follow the number in the band as it passes.
          if (programmatic.current) return
          const el = ref.current!
          const i = Math.min(count - 1, Math.max(0, Math.round(el.scrollTop / ITEM)))
          if (i !== current.current) change.current(i)
        }}
        onScrollEnd={() => {
          programmatic.current = false
          const el = ref.current!
          const top = current.current * ITEM
          if (Math.abs(el.scrollTop - top) >= 1) {
            programmatic.current = true
            el.scrollTo({ top, behavior: 'smooth' })
          }
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={`${s.item} num`}
            data-selected={i === value || undefined}
            onClick={() => onChange(i)}
          >
            {two(i)}
          </span>
        ))}
      </div>
      <span className={s.unit}>{label}</span>
    </div>
  )
}
