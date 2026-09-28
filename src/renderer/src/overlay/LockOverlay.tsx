import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { fmtCountdown, fmtDuration } from '@shared/format'
import type { OverlayState } from '@shared/ipc'
import { prayerLabel } from '@shared/machine/toasts'
import { isNightLike } from '@shared/sky'
import { lock as t } from '@shared/strings'
import { Odometer } from '../components/Odometer'
import { api } from '../lib/api'
import { playChime } from '../lib/chime'
import { useWallNow } from '../lib/now'
import { HoldButton } from './HoldButton'
import s from './LockOverlay.module.css'

const STARS = Array.from({ length: 46 }, (_, i) => {
  // Deterministic scatter so every display shows the same sky.
  const x = (i * 73.13) % 100
  const y = (i * 41.7 + (i % 7) * 9) % 62
  return { x, y, size: 1 + ((i * 7) % 3) * 0.6, delay: (i * 0.37) % 6, dur: 4 + ((i * 13) % 5) }
})

/**
 * Fullscreen prayer lock: the sky of the current period, the prayer name, a
 * breathing circle (4 s in, 4 s out), the time remaining, and the three exits.
 */
export function LockOverlay({ state }: { state: OverlayState }): React.JSX.Element | null {
  const wall = useWallNow(1000)
  const lock = state.lock
  const chimed = useRef<number | null>(null)

  useEffect(() => {
    if (lock && state.primary && lock.chime && chimed.current !== lock.startedAt) {
      chimed.current = lock.startedAt
      playChime()
    }
  }, [lock, state.primary])

  if (!lock) return null
  const now = wall + state.clockOffsetMs
  const name = prayerLabel(lock.ref)
  const remaining = Math.max(0, lock.until - now)
  const unlockIn = Math.max(0, lock.minUnlockAt - now)
  const canPray = unlockIn <= 0
  const night = isNightLike(state.sky.period)
  const act = (action: 'prayed' | 'snooze' | 'emergency'): void => {
    void api.invoke('lock:action', { action })
  }

  return (
    <motion.div
      className={s.lock}
      data-reduce={state.reduceMotion || undefined}
      data-tone={state.sky.tone}
      style={{
        background: `linear-gradient(180deg, ${state.sky.top} 0%, ${state.sky.mid} 60%, ${state.sky.horizon} 100%)`
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {night ? (
        <div className={s.stars} aria-hidden>
          {STARS.map((st, i) => (
            <span
              key={i}
              className={s.star}
              style={{
                insetInlineStart: `${st.x}%`,
                insetBlockStart: `${st.y}%`,
                inlineSize: st.size,
                blockSize: st.size,
                animationDelay: `${st.delay}s`,
                animationDuration: `${st.dur}s`
              }}
            />
          ))}
        </div>
      ) : null}
      <div className={s.horizon} aria-hidden />

      <main className={s.content}>
        <h1 className={s.headline}>{t.headline(name)}</h1>
        <p className={s.sub}>{t.sub}</p>

        {/* The breathing guide keeps moving under reduced motion (motion-essential). */}
        <div className={s.breath} aria-hidden>
          <span className={`${s.circle} motion-essential`} />
          <span className={`${s.circleCore} motion-essential`} />
          <span className={`${s.word} ${s.inhale} motion-essential`}>{t.breatheIn}</span>
          <span className={`${s.word} ${s.exhale} motion-essential`}>{t.breatheOut}</span>
        </div>

        <div className={s.remaining}>
          <span>{t.remainingLabel}</span>
          <Odometer
            value={fmtCountdown(remaining, state.digits)}
            className={s.remainingValue}
            label={t.remaining(fmtDuration(remaining, state.digits, { round: 'ceil' }))}
          />
        </div>

        <div className={s.actions}>
          <button
            type="button"
            className={s.prayed}
            disabled={!canPray}
            onClick={() => act('prayed')}
            data-testid="lock-prayed"
          >
            {canPray ? t.prayed : t.prayedIn(fmtCountdown(unlockIn, state.digits))}
          </button>
          <button
            type="button"
            className={s.snooze}
            disabled={!lock.snoozeAvailable}
            onClick={() => act('snooze')}
            data-testid="lock-snooze"
          >
            {lock.snoozeAvailable ? t.snooze : t.snoozeUsed}
          </button>
        </div>

        <HoldButton holdMs={3000} hint={t.emergencyHint} onComplete={() => act('emergency')}>
          {t.emergency}
        </HoldButton>
      </main>
    </motion.div>
  )
}
