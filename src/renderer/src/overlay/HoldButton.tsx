import { animate, motion, useMotionValue } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import s from './HoldButton.module.css'

interface HoldButtonProps {
  holdMs: number
  onComplete: () => void
  children: ReactNode
  hint: string
}

/**
 * Press and hold to confirm. A ring fills while the button is held (mouse,
 * touch or Space/Enter) and drains when released early.
 */
export function HoldButton({
  holdMs,
  onComplete,
  children,
  hint
}: HoldButtonProps): React.JSX.Element {
  const progress = useMotionValue(0)
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
      <svg className={s.ring} viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r="19" className={s.track} />
        <motion.circle cx="22" cy="22" r="19" className={s.fill} style={{ pathLength: progress }} />
      </svg>
      <span className={s.label}>{children}</span>
      <span id="hold-hint" className={s.hint}>
        {hint}
      </span>
    </button>
  )
}
