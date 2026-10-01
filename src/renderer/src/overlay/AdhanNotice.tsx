import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { fmtClock, fmtDuration } from '@shared/format'
import type { OverlayState } from '@shared/ipc'
import { prayerLabel } from '@shared/machine/toasts'
import { adhan as t } from '@shared/strings'
import { LogoMark } from '../components/NavIcons'
import { api } from '../lib/api'
import { playChime } from '../lib/chime'
import s from './AdhanNotice.module.css'

/**
 * The short notice at the adhan (the prayer, and when the lock follows at the
 * iqama) or before sunrise (the last of Fajr's time), with a close button. It never takes focus; a thin bar drains over
 * the notice's lifetime and the main process closes it at `until`.
 */
export function AdhanNotice({ state }: { state: OverlayState }): React.JSX.Element | null {
  const view = state.adhan
  const chimed = useRef<number | null>(null)
  // Read once: the drain animation runs from here and must not restart on re-render.
  const [mountedAt] = useState(() => Date.now())

  useEffect(() => {
    if (view && view.chime && chimed.current !== view.shownAt) {
      chimed.current = view.shownAt
      playChime()
    }
  }, [view])

  if (!view) return null
  const now = mountedAt + state.clockOffsetMs
  const total = Math.max(1, view.until - view.shownAt)
  const left = Math.max(0, view.until - now)
  const prefs = { digits: state.digits, clock: state.clock }

  return (
    <div className={s.wrap}>
      <motion.section
        className={s.card}
        role="status"
        aria-live="polite"
        data-testid="adhan-notice"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <LogoMark className={s.glyph} />
        <div className={s.text}>
          {view.kind === 'adhan' ? (
            <>
              <p className={s.title}>{t.title(prayerLabel(view.ref))}</p>
              {view.lockAt !== null ? (
                <p className={s.sub}>{t.lockAt(fmtClock(view.lockAt, prefs))}</p>
              ) : null}
            </>
          ) : view.sunriseAt - view.shownAt >= 30_000 ? (
            <>
              <p className={s.title}>
                {t.sunriseIn(
                  fmtDuration(view.sunriseAt - view.shownAt, state.digits, { round: 'round' })
                )}
              </p>
              <p className={s.sub}>{t.sunriseSub(fmtClock(view.sunriseAt, prefs))}</p>
            </>
          ) : (
            <>
              <p className={s.title}>{t.sunriseNow}</p>
              <p className={s.sub}>{t.sunriseEnded}</p>
            </>
          )}
        </div>
        <button
          type="button"
          className={s.close}
          onClick={() => void api.invoke('adhan:close')}
          data-testid="adhan-close"
        >
          {t.close}
        </button>
        <span
          className={`${s.progress} motion-essential`}
          style={{ '--from': left / total, animationDuration: `${left}ms` } as React.CSSProperties}
          aria-hidden
        />
      </motion.section>
    </div>
  )
}
