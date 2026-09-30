import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import s from './HoldButton.module.css'

interface HoldButtonProps {
  holdMs: number
  onComplete: () => void
  children: ReactNode
  hint: string
}

/**
 * Press and hold to confirm. The ring is empty until the press starts; then
 * it fills in the hour's colours with a glow that swells behind it (mouse,
 * touch or Space/Enter), and drains when released early. Only opacity,
 * transforms and the ring's path length move.
 */
export function HoldButton({
  holdMs,
  onComplete,
  children,
  hint
}: HoldButtonProps): React.JSX.Element {
  const progress = useMotionValue(0)
  // Nothing shows before the press: a zero-length round-capped stroke is a dot.
  const fillOpacity = useTransform(progress, [0, 0.02], [0, 1])
  const glowOpacity = useTransform(progress, [0, 1], [0, 0.9])
  const glowScale = useTransform(progress, [0, 1], [0.55, 1.25])
  const anim = useRef<ReturnType<typeof animate> | null>(null)
  const done = useRef(false)
  const completeRef = useRef(onComplete)
  useEffect(() => {
    completeRef.current = onComplete
  })

  const start = (): void => {
    if (done.current) return
    anim.current?.stop()
    anim.current = animate(progress, 1, {
      duration: (holdMs / 1000) * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => {
        done.current = true
        completeRef.current()
      }
    })
  }

  const cancel = (): void => {
    if (done.current) return
    anim.current?.stop()
    anim.current = animate(progress, 0, { duration: 0.35, ease: [0.22, 1, 0.36, 1] })
  }

  useEffect(() => () => anim.current?.stop(), [])

  return (
    <button
      type="button"
      className={s.hold}
      aria-describedby="hold-hint"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          start()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') cancel()
      }}
      data-testid="emergency-exit"
    >
      <span className={s.ringWrap} aria-hidden>
        <motion.span className={s.glow} style={{ opacity: glowOpacity, scale: glowScale }} />
        <svg className={s.ring} viewBox="0 0 44 44">
          <defs>
            <linearGradient id="hold-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className={s.stopA} />
              <stop offset="1" className={s.stopB} />
            </linearGradient>
          </defs>
          <circle cx="22" cy="22" r="19" className={s.track} />
          <motion.circle
            cx="22"
            cy="22"
            r="19"
            className={s.fill}
            stroke="url(#hold-fill)"
            style={{ pathLength: progress, opacity: fillOpacity }}
          />
        </svg>
      </span>
      <span className={s.label}>{children}</span>
      <span id="hold-hint" className={s.hint}>
        {hint}
      </span>
    </button>
  )
}
