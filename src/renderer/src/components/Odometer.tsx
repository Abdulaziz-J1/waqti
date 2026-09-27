import { AnimatePresence, motion } from 'motion/react'
import s from './Odometer.module.css'

interface OdometerProps {
  value: string
  className?: string
  /** Accessible text (screen readers get this instead of per-digit spans). */
  label?: string
}

const isDigit = (c: string): boolean => /[0-9٠-٩]/.test(c)

/**
 * Countdown text whose digits roll like an odometer when they change. The row
 * is laid out left-to-right (as numbers read), isolated from the RTL text.
 */
export function Odometer({ value, className, label }: OdometerProps): React.JSX.Element {
  const chars = [...value]
  return (
    <span className={`${s.odo} num ${className ?? ''}`} role="timer" aria-label={label ?? value}>
      {chars.map((c, i) => {
        // Key by position from the right so units stay put when the length changes.
        const pos = chars.length - i
        if (!isDigit(c)) {
          return (
            <span key={`s${pos}`} className={s.sep} aria-hidden>
              {c}
            </span>
          )
        }
        return (
          <span key={`d${pos}`} className={s.cell} aria-hidden>
            <span className={s.sizer}>{c}</span>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={c}
                className={s.digit}
                initial={{ y: '-100%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              >
                {c}
              </motion.span>
            </AnimatePresence>
          </span>
        )
      })}
    </span>
  )
}
