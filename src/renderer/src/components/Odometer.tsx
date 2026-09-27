import s from './Odometer.module.css'

interface OdometerProps {
  value: string
  className?: string
  /** Accessible text (screen readers get this instead of per-digit columns). */
  label?: string
}

const LATIN = '0123456789'
const ARABIC = '٠١٢٣٤٥٦٧٨٩'

function digitIndex(c: string): number {
  const i = LATIN.indexOf(c)
  return i >= 0 ? i : ARABIC.indexOf(c)
}

/**
 * Countdown whose digits roll like an odometer. Each position is a fixed
 * column of the ten digits that slides with a CSS transform transition, so
 * nothing is created or destroyed per second (cheap to paint, no memory churn).
 * The row reads left-to-right as numbers do, isolated from the RTL text.
 */
export function Odometer({ value, className, label }: OdometerProps): React.JSX.Element {
  const chars = [...value]
  const arabic = chars.some((c) => ARABIC.includes(c))
  const set = arabic ? ARABIC : LATIN
  return (
    <span className={`${s.odo} num ${className ?? ''}`} role="timer" aria-label={label ?? value}>
      {chars.map((c, i) => {
        // Key by position from the right so units stay put when the length changes.
        const pos = chars.length - i
        const d = digitIndex(c)
        if (d < 0) {
          return (
            <span key={`s${pos}`} className={s.sep} aria-hidden>
              {c}
            </span>
          )
        }
        return (
          <span key={`d${pos}`} className={s.cell} aria-hidden>
            <span className={s.column} style={{ transform: `translateY(${-d * 10}%)` }}>
              {[...set].map((digit) => (
                <span key={digit} className={s.digit}>
                  {digit}
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
