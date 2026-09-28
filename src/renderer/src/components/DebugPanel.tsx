import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DebugReadout } from '@shared/ipc'
import { PRAYERS, type PrayerId } from '@shared/prayer/schedule'
import { common, debug as t, prayerNames } from '@shared/strings'
import { siteLabel } from '@shared/tracking/sites'
import { api } from '../lib/api'
import { useFmt } from '../lib/fmt'
import { useSnapshot } from '../lib/store'
import { spring } from '../motion'
import { Button } from './Button'
import { Segmented } from './Segmented'
import { Stepper } from './Stepper'
import { Toggle } from './Toggle'
import s from './DebugPanel.module.css'

/**
 * Hidden test panel (Ctrl+Shift+D), available in production builds but not
 * linked in the UI. Everything here drives the real services.
 */
export function DebugPanel(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const snap = useSnapshot()
  const fmt = useFmt()
  const [prayer, setPrayer] = useState<PrayerId>('asr')
  const [offset, setOffset] = useState(Math.round(snap.debug.offsetMs / 60_000))
  const [readout, setReadout] = useState<DebugReadout | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd' || e.code === 'KeyD')) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    const off = api.on('debug:toggle', () => setOpen((o) => !o))
    return () => {
      window.removeEventListener('keydown', onKey)
      off()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let alive = true
    const read = (): void => {
      void api.invoke('debug:readout').then((r) => {
        if (alive) setReadout(r)
      })
    }
    read()
    const id = setInterval(read, 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [open])

  const run = (p: Promise<unknown>): void => {
    setMessage(null)
    p.catch(() => setMessage(common.saveError))
  }

  const offsetMin = Math.round(snap.debug.offsetMs / 60_000)

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          className={s.panel}
          role="dialog"
          aria-label={t.title}
          data-testid="debug-panel"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={spring.gentle}
        >
          <header className={s.head}>
            <div>
              <h2 className={s.title}>{t.title}</h2>
              <p className={s.hint}>{t.hint}</p>
            </div>
            <button
              type="button"
              className={s.close}
              aria-label={common.close}
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </header>

          <section className={s.section}>
            <h3>{t.simulate}</h3>
            <Segmented<PrayerId>
              label={t.simulate}
              size="sm"
              value={prayer}
              onChange={setPrayer}
              options={PRAYERS.map((p) => ({ value: p, label: prayerNames[p] }))}
            />
            <div className={s.row}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => run(api.invoke('debug:simulatePrayer', { prayer }))}
                data-testid="debug-simulate-prayer"
              >
                {t.prayerNow}
              </Button>
              <Button
                size="sm"
                onClick={() => run(api.invoke('debug:simulateAdhan', { prayer }))}
                data-testid="debug-simulate-adhan"
              >
                {t.adhanNow}
              </Button>
              <Button size="sm" onClick={() => run(api.invoke('debug:simulatePre', { prayer }))}>
                {t.preReminder}
              </Button>
              <Button size="sm" onClick={() => run(api.invoke('debug:startupOffer'))}>
                {t.startup}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  run(api.invoke('debug:simulateDistraction', { label: siteLabel('youtube') }))
                }
              >
                {t.distraction}
              </Button>
            </div>
            <Toggle
              label={t.idle}
              checked={snap.debug.idleOverride}
              onChange={(on) => run(api.invoke('debug:setIdle', { on }))}
            />
            <Toggle
              label={t.meeting}
              checked={snap.debug.meetingOverride}
              onChange={(on) => run(api.invoke('debug:setMeeting', { on }))}
            />
          </section>

          <section className={s.section}>
            <h3>
              {t.clock}
              <span className={`${s.badge} num`}>
                {t.offset}: {fmt.num(offsetMin)} {t.offsetMinutes}
              </span>
            </h3>
            <div className={s.row}>
              <Stepper
                label={t.offset}
                value={offset}
                min={-2880}
                max={2880}
                step={5}
                format={(v) => `${fmt.num(v)} ${t.offsetMinutes}`}
                onChange={setOffset}
              />
              <Button
                size="sm"
                onClick={() => run(api.invoke('debug:setOffset', { minutes: offset }))}
              >
                {t.apply}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOffset(0)
                  run(api.invoke('debug:setOffset', { minutes: 0 }))
                }}
              >
                {t.resetClock}
              </Button>
            </div>
            <div className={s.row}>
              <Button
                size="sm"
                onClick={() => run(api.invoke('debug:jumpBefore', { prayer, minutes: 1 }))}
              >
                {t.jumpBefore}
              </Button>
              <Button
                size="sm"
                onClick={() => run(api.invoke('debug:jumpBefore', { prayer, minutes: -3 }))}
              >
                {t.jumpAfter}
              </Button>
            </div>
          </section>

          <section className={s.section}>
            <h3>{t.demo}</h3>
            <div className={s.row}>
              {(['day', 'week', 'year'] as const).map((range) => (
                <Button
                  key={range}
                  size="sm"
                  onClick={() =>
                    run(
                      api.invoke('debug:seed', { range }).then((r) => {
                        setMessage(t.seeded(fmt.num(r.inserted), fmt.num(r.ms)))
                      })
                    )
                  }
                >
                  {range === 'day' ? t.seedDay : range === 'week' ? t.seedWeek : t.seedYear}
                </Button>
              ))}
              <Button size="sm" variant="danger" onClick={() => run(api.invoke('debug:clearDemo'))}>
                {t.clearDemo}
              </Button>
            </div>
            {message ? <p className={s.message}>{message}</p> : null}
          </section>

          <section className={s.section}>
            <h3>{t.live}</h3>
            {readout ? (
              <dl className={s.readout}>
                <dt>{t.state}</dt>
                <dd>
                  <bdi>{readout.state}</bdi>
                </dd>
                <dt>{t.foreground}</dt>
                <dd>
                  <bdi>
                    {readout.foreground
                      ? `${readout.foreground.appName}${readout.foreground.site ? ` · ${siteLabel(readout.foreground.site)}` : ''}`
                      : '—'}
                  </bdi>
                </dd>
                <dt>{t.provider}</dt>
                <dd>
                  <bdi>{readout.provider}</bdi>
                </dd>
                <dt>{t.cpu}</dt>
                <dd className="num">
                  {fmt.num(readout.cpuPercent, { maximumFractionDigits: 1 })}٪
                </dd>
                <dt>{t.memory}</dt>
                <dd className="num">
                  {fmt.num(readout.memoryMB)} <span dir="ltr">MB</span>
                </dd>
                <dt>{t.inMeeting}</dt>
                <dd>{readout.inMeeting ? t.yes : t.no}</dd>
                <dt>{t.idleSeconds}</dt>
                <dd className="num">{fmt.num(readout.idleSeconds)}</dd>
                <dt>{t.startupTime}</dt>
                <dd className="num">
                  {readout.startupMs !== null ? (
                    <>
                      {fmt.num(readout.startupMs)} <span dir="ltr">ms</span>
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>{t.intervals}</dt>
                <dd className="num">{fmt.num(readout.intervals)}</dd>
              </dl>
            ) : (
              <p className={s.hint}>{common.loading}</p>
            )}
          </section>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
