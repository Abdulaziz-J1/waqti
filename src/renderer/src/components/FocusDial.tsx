import { Minus, Plus } from 'lucide-react'
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import {
  MAX_FOCUS_SECONDS,
  MIN_FOCUS_SECONDS,
  dialPosition,
  dialTurns,
  snapToMinute,
  turnDelta
} from '@shared/focus'
import s from './FocusDial.module.css'

const SIZE = 320
const C = SIZE / 2
const R = 124
const TICKS = Array.from({ length: 60 }, (_, i) => i)

interface FocusDialProps {
  /** Seconds on the dial: the length before a session, the time left during one. */
  seconds: number
  /** Before a session the ring can be dragged; during one it unwinds. */
  onDrag?: (seconds: number) => void
  paused?: boolean
  /** Accessible name and value text for the draggable ring. */
  label: string
  valueText: string
  onStep: (dir: 1 | -1) => void
  canStep: (dir: 1 | -1) => boolean
  stepLabels: { less: string; more: string; caption: string }
  children: ReactNode
}

/**
 * The focus dial: a kitchen timer where one turn is an hour. The arc and its
 * lit ticks show the length (or what is left), full hours sit beneath as a
 * faint ring, and − / + flank it, five minutes a press (hold to repeat).
 * Only CSS variables and transforms move.
 */
export function FocusDial({
  seconds,
  onDrag,
  paused,
  label,
  valueText,
  onStep,
  canStep,
  stepLabels,
  children
}: FocusDialProps): React.JSX.Element {
  const gradient = `dial-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ pos: number; acc: number; frame: number; next: number | null } | null>(null)
  const [dragging, setDragging] = useState(false)
  const { laps, fraction } = dialTurns(seconds)
  const lit = Math.round(fraction * 60)

  useEffect(
    () => () => {
      if (drag.current) cancelAnimationFrame(drag.current.frame)
    },
    []
  )

  const positionOf = (e: React.PointerEvent): number => {
    const box = svg.current!.getBoundingClientRect()
    return dialPosition(
      e.clientX - (box.left + box.width / 2),
      e.clientY - (box.top + box.height / 2)
    )
  }

  const onPointerDown = (e: React.PointerEvent<SVGElement>): void => {
    if (!onDrag || e.button !== 0) return
    e.preventDefault()
    const pos = positionOf(e)
    // Grabbing the knob keeps the length; pressing the ring jumps there within this hour.
    const onKnob = (e.target as Element).closest('[data-knob]') !== null
    const acc = onKnob ? seconds : laps * 3600 + pos * 3600
    drag.current = { pos, acc, frame: 0, next: null }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    if (!onKnob) onDrag(snapToMinute(acc))
  }

  const onPointerMove = (e: React.PointerEvent<SVGElement>): void => {
    const d = drag.current
    if (!d || !onDrag) return
    d.next = positionOf(e)
    if (d.frame) return
    d.frame = requestAnimationFrame(() => {
      d.frame = 0
      if (d.next === null) return
      const bounded = Math.min(
        MAX_FOCUS_SECONDS,
        Math.max(MIN_FOCUS_SECONDS, d.acc + turnDelta(d.pos, d.next) * 3600)
      )
      d.acc = bounded
      d.pos = d.next
      d.next = null
      onDrag(snapToMinute(bounded))
    })
  }

  const endDrag = (): void => {
    if (drag.current) cancelAnimationFrame(drag.current.frame)
    drag.current = null
    setDragging(false)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!onDrag) return
    const by: Record<string, number> = {
      ArrowUp: 60,
      ArrowRight: 60,
      ArrowDown: -60,
      ArrowLeft: -60,
      PageUp: 300,
      PageDown: -300
    }
    if (e.key in by) {
      e.preventDefault()
      onDrag(snapToMinute(seconds + by[e.key]!))
    } else if (e.key === 'Home') {
      e.preventDefault()
      onDrag(MIN_FOCUS_SECONDS)
    }
  }

  const ring = (
    <svg
      ref={svg}
      className={s.svg}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      data-testid="focus-ring"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className={s.stopA} />
          <stop offset="1" className={s.stopB} />
        </linearGradient>
      </defs>
      <g className={s.ticks}>
        {TICKS.map((i) => (
          <line
            key={i}
            x1={C}
            x2={C}
            y1={i % 5 === 0 ? 10 : 14}
            y2={22}
            className={s.tick}
            data-major={i % 5 === 0 || undefined}
            data-lit={i < lit || laps > 0 || undefined}
            transform={`rotate(${i * 6} ${C} ${C})`}
          />
        ))}
      </g>
      <circle cx={C} cy={C} r={R} className={s.track} />
      {laps > 0 ? <circle cx={C} cy={C} r={R} className={s.lap} /> : null}
      {/* Keyed by lap: winding past an hour starts a fresh arc instead of spinning back. */}
      <circle
        key={laps}
        cx={C}
        cy={C}
        r={R}
        pathLength={1}
        className={s.arc}
        stroke={`url(#${gradient})`}
        style={{ '--dial-fraction': fraction } as CSSProperties}
        data-empty={fraction === 0 || undefined}
      />
      {onDrag ? <circle cx={C} cy={C} r={R} className={s.hit} /> : null}
      <g
        key={`k${laps}`}
        className={s.hand}
        style={{ '--dial-turn': fraction } as CSSProperties}
        data-knob={onDrag ? true : undefined}
      >
        <circle cx={C} cy={C - R} r={onDrag ? 15 : 7} className={s.knobHalo} />
        <circle cx={C} cy={C - R} r={onDrag ? 9 : 5} className={s.knob} />
      </g>
    </svg>
  )

  return (
    <div className={s.row}>
      <StepButton
        dir={-1}
        label={stepLabels.less}
        caption={stepLabels.caption}
        disabled={!canStep(-1)}
        onStep={onStep}
      />
      <div
        className={s.dial}
        data-paused={paused || undefined}
        data-dragging={dragging || undefined}
        data-idle={onDrag ? true : undefined}
      >
        {ring}
        {onDrag ? (
          <div
            className={s.slider}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={MIN_FOCUS_SECONDS}
            aria-valuemax={MAX_FOCUS_SECONDS}
            aria-valuenow={seconds}
            aria-valuetext={valueText}
            onKeyDown={onKeyDown}
          />
        ) : null}
        <div className={s.inner}>{children}</div>
      </div>
      <StepButton
        dir={1}
        label={stepLabels.more}
        caption={stepLabels.caption}
        disabled={!canStep(1)}
        onStep={onStep}
      />
    </div>
  )
}

/** A round − or + that repeats while held, faster the longer it is held. */
function StepButton({
  dir,
  label,
  caption,
  disabled,
  onStep
}: {
  dir: 1 | -1
  label: string
  caption: string
  disabled: boolean
  onStep: (dir: 1 | -1) => void
}): React.JSX.Element {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step = useRef(onStep)
  useLayoutEffect(() => {
    step.current = onStep
  })

  const stop = (): void => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  useEffect(() => {
    if (disabled) stop()
  }, [disabled])

  const repeat = (delay: number): void => {
    timer.current = setTimeout(() => {
      step.current(dir)
      repeat(Math.max(90, delay * 0.8))
    }, delay)
  }

  return (
    <div className={s.stepWrap}>
      <button
        type="button"
        className={s.step}
        aria-label={label}
        disabled={disabled}
        data-testid={dir > 0 ? 'focus-more' : 'focus-less'}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          step.current(dir)
          repeat(420)
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(e) => {
          // Keyboard presses (Enter, Space) arrive as clicks with no pointer.
          if (e.detail === 0) step.current(dir)
        }}
      >
        {dir > 0 ? <Plus size={22} strokeWidth={2.4} /> : <Minus size={22} strokeWidth={2.4} />}
      </button>
      <span className={`${s.caption} num`} aria-hidden>
        {caption}
      </span>
    </div>
  )
}
