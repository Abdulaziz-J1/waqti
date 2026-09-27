import { motion } from 'motion/react'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { nextEvent } from '@shared/prayer/schedule'
import { greetings, prayerNames, today as t, common } from '@shared/strings'
import { minutesOfDay } from '@shared/time'
import { AppIcon } from '../components/AppIcon'
import { Button } from '../components/Button'
import { CategoryBar } from '../components/CategoryBar'
import { CountUp } from '../components/CountUp'
import { Divider } from '../components/Divider'
import { EmptyState } from '../components/EmptyState'
import { FocusCountdown } from '../components/FocusCountdown'
import { NextPrayerCountdown } from '../components/NextPrayerCountdown'
import { Panel } from '../components/Panel'
import { SkyArc } from '../components/SkyArc'
import { TimelineStrip } from '../components/TimelineStrip'
import { api } from '../lib/api'
import { takeEntrance } from '../lib/entrance'
import { useFmt } from '../lib/fmt'
import { go } from '../lib/nav'
import { useNow } from '../lib/now'
import { useSkyTheme } from '../lib/sky'
import { useSnapshot } from '../lib/store'
import { useData } from '../lib/useData'
import { useCatColor } from '../lib/tone'
import { fadeUp, stagger } from '../motion'
import s from './Today.module.css'

export function TodayPage(): React.JSX.Element {
  const snap = useSnapshot()
  const fmt = useFmt()
  // Everything on the page except the countdowns changes at most once a minute.
  const now = useNow(60_000)
  const sky = useSkyTheme()
  const catColor = useCatColor()
  const [entrance] = useState(takeEntrance)
  const today = useData(() => api.invoke('today:get'), [], 60_000)
  const bundle = snap.schedule
  const next = bundle
    ? nextEvent([bundle.yesterday, bundle.today, bundle.tomorrow], now, true)
    : null
  const focus = snap.machine.focus
  const data = today.data

  const startFocus = (): void => {
    void api.invoke('focus:start', { minutes: snap.settings.focus.lastMinutes })
    go('focus')
  }

  return (
    <motion.div
      className={s.page}
      initial="hidden"
      animate="show"
      variants={stagger(entrance ? 0.09 : 0.04, entrance ? 1.2 : 0)}
    >
      <motion.header className={s.header} variants={fadeUp}>
        <div>
          <h1 className={s.greeting}>{greetings[sky.period]}</h1>
          <p className={s.dates}>
            <span>{fmt.gregorian(now)}</span>
            <Divider />
            <span>{fmt.hijri(now)}</span>
          </p>
        </div>
      </motion.header>

      {/* Hero: the Sky Arc and the next prayer */}
      <section className={s.hero} aria-label={t.nextPrayer}>
        {bundle ? (
          <>
            <SkyArc bundle={bundle} now={now} nextSlot={next?.slot ?? null} entrance={entrance} />
            <NextPrayerCountdown bundle={bundle} entrance={entrance} />
          </>
        ) : (
          <EmptyState
            art="error"
            body={t.scheduleError}
            action={<Button onClick={() => go('prayer')}>{t.fixLocation}</Button>}
          />
        )}
      </section>

      <div className={s.grid}>
        <Panel title={t.totalsTitle} id="today-totals">
          {data && data.totalMs > 0 ? (
            <div className={s.totals}>
              <div className={s.total}>
                <CountUp value={data.totalMs} format={(v) => fmt.dur(v)} className={s.totalValue} />
                <span className={s.totalLabel}>{t.totalLabel}</span>
              </div>
              <CategoryBar totals={data.totals} />
            </div>
          ) : today.error ? (
            <EmptyState
              art="error"
              body={common.loadError}
              action={<Button onClick={today.reload}>{common.retry}</Button>}
            />
          ) : (
            <EmptyState body={t.empty} />
          )}
        </Panel>

        <Panel title={t.topTitle} id="today-top">
          {data && data.top.length > 0 ? (
            <ol className={s.top}>
              {data.top.map((a, i) => {
                const raw = data.categories.find((c) => c.id === a.categoryId)?.color
                const color = raw ? catColor(raw) : undefined
                return (
                  <motion.li
                    key={a.key}
                    className={s.row}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                  >
                    <AppIcon icon={a.icon} name={a.label} site={a.site} color={color} />
                    <div className={s.rowText}>
                      <span className={s.rowName}>
                        <bdi>{a.label}</bdi>
                      </span>
                      {a.site ? (
                        <span className={s.rowSub}>
                          <bdi>{t.via(a.appName)}</bdi>
                        </span>
                      ) : null}
                      <span className={s.rowBar} aria-hidden>
                        <motion.span
                          className={s.rowFill}
                          style={{ background: color }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: a.ms / (data.top[0]?.ms || 1) }}
                          transition={{
                            type: 'spring',
                            stiffness: 200,
                            damping: 26,
                            delay: 0.1 + i * 0.05
                          }}
                        />
                      </span>
                    </div>
                    <span className={`${s.rowValue} num`}>{fmt.durShort(a.ms)}</span>
                  </motion.li>
                )
              })}
            </ol>
          ) : (
            <EmptyState body={t.emptyTop} />
          )}
        </Panel>

        <Panel title={focus.kind === 'off' ? t.startFocus : t.focusRunning} id="today-focus">
          {focus.kind !== 'off' ? (
            <div className={s.focusCard}>
              <FocusCountdown focus={focus} className={s.focusTimer} />
              <Button variant="primary" onClick={() => go('focus')}>
                {t.openFocus}
              </Button>
            </div>
          ) : (
            <div className={s.focusCard}>
              <p className={s.focusLine}>
                {data && data.focus.sessions > 0
                  ? t.focusToday(fmt.sessions(data.focus.sessions), fmt.dur(data.focus.focusedMs))
                  : t.focusPitch(fmt.minutes(snap.settings.focus.lastMinutes))}
              </p>
              <Button variant="primary" icon={<Play size={16} />} onClick={startFocus}>
                {t.startFocus}
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title={t.timelineTitle}
        id="today-timeline"
        actions={<span className={s.hint}>{t.timelineHint}</span>}
      >
        {data && data.timeline.length > 0 && bundle ? (
          <TimelineStrip
            segments={data.timeline}
            categories={data.categories}
            dayStart={new Date(bundle.today.times.fajr).setHours(0, 0, 0, 0)}
            nowMin={minutesOfDay(now)}
            prayerMarks={(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => ({
              min: minutesOfDay(bundle.today.times[p]),
              label: prayerNames[p]
            }))}
          />
        ) : (
          <EmptyState body={t.empty} />
        )}
      </Panel>
    </motion.div>
  )
}
