import { animate } from 'motion/react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from '../lib/sky'

interface CountUpProps {
  value: number
  format: (v: number) => string
  className?: string
}

/**
 * Counts up to `value` by writing text directly (no React render per frame).
 * With reduced motion the final value appears immediately.
 */
export function CountUp({ value, format, className }: CountUpProps): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduced = useReducedMotion()
  const formatRef = useRef(format)
  useLayoutEffect(() => {
    formatRef.current = format
  })

  useLayoutEffect(() => {
    // First paint shows the starting value before the animation runs.
    if (ref.current && !ref.current.textContent)
      ref.current.textContent = formatRef.current(from.current)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.textContent = formatRef.current(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formatRef.current(v)
      }
    })
    from.current = value
    return () => controls.stop()
  }, [value, reduced])

  return <span ref={ref} className={`num ${className ?? ''}`} />
}
