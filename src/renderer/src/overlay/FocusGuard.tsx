import { motion } from 'motion/react'
import { fmtDuration } from '@shared/format'
import type { OverlayState } from '@shared/ipc'
import { guard as t } from '@shared/strings'
import { api } from '../lib/api'
import { useWallNow } from '../lib/now'
import { spring } from '../motion'
import s from './FocusGuard.module.css'

/** Dimmed overlay on the distraction's display with two choices. */
export function FocusGuard({ state }: { state: OverlayState }): React.JSX.Element | null {
  const wall = useWallNow(1000)
  const g = state.guard
  if (!g) return null
  const remaining = Math.max(0, g.sessionEndsAt - (wall + state.clockOffsetMs))
  const act = (action: 'back' | 'snooze'): void => {
    void api.invoke('guard:action', { action })
  }

  return (
    <motion.div
      className={s.scrim}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={s.card}
        role="alertdialog"
        aria-labelledby="guard-title"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring.gentle, delay: 0.05 }}
      >
        <svg className={s.art} viewBox="0 0 64 64" aria-hidden>
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".3"
          />
          <circle
            cx="32"
            cy="32"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".6"
          />
          <circle cx="32" cy="32" r="4" fill="currentColor" />
        </svg>
        <h1 id="guard-title" className={s.title}>
          {t.headline(fmtDuration(remaining, state.digits, { round: 'ceil' }))}
        </h1>
        <p className={s.sub}>
          {t.subStart}
          <bdi className={s.target}>{g.target.label}</bdi>
          {t.subEnd}
        </p>
        <div className={s.actions}>
          <button
            type="button"
            className={s.back}
            onClick={() => act('back')}
            autoFocus
            data-testid="guard-back"
          >
            {t.back}
          </button>
          <button
            type="button"
            className={s.snooze}
            onClick={() => act('snooze')}
            data-testid="guard-snooze"
          >
            {t.snooze}
            <span className={s.snoozeHint}>{t.snoozeHint}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
