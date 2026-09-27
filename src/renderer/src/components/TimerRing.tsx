import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { spring } from '../motion'
import s from './TimerRing.module.css'

interface TimerRingProps {
  /** 0…1 elapsed. */
  progress: number
  children: ReactNode
  paused?: boolean
}

/** A large ring that fills as the session runs, with the timer inside. */
export function TimerRing({ progress, children, paused }: TimerRingProps): React.JSX.Element {
  return (
    <div className={s.wrap} data-paused={paused || undefined}>
      <svg className={s.svg} viewBox="0 0 240 240" aria-hidden>
        <circle cx="120" cy="120" r="108" className={s.track} />
        <motion.circle
          cx="120"
          cy="120"
          r="108"
          className={s.fill}
          initial={false}
          animate={{
            pathLength: Math.max(0.001, Math.min(1, progress)),
            opacity: progress > 0 ? 1 : 0
          }}
          transition={spring.slow}
        />
      </svg>
      <div className={s.inner}>{children}</div>
    </div>
  )
}
