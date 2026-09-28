import { motion } from 'motion/react'
import { prayerLabel } from '@shared/machine/toasts'
import type { PrayerLogEntry } from '@shared/machine/types'
import { type PrayerId, nextEvent } from '@shared/prayer/schedule'
import { locationLabel } from '@shared/settings/plan'
import { common, prayerNames, prayerPage as t } from '@shared/strings'
import { addDays, dayKey, dayStart, isFriday } from '@shared/time'
import { Divider } from '../components/Divider'
import { EmptyState } from '../components/EmptyState'
import { SettingRow } from '../components/Field'
import { LocationPicker } from '../components/LocationPicker'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { Slider } from '../components/Slider'
import { Stepper } from '../components/Stepper'
import { Switch, Toggle } from '../components/Toggle'
import { Button } from '../components/Button'
import { api } from '../lib/api'
import { useFmt, type Fmt } from '../lib/fmt'
import { useNow } from '../lib/now'
import { updateSettings, useSnapshot } from '../lib/store'
import { useData } from '../lib/useData'
import { stagger } from '../motion'
import s from './Prayer.module.css'

function Signed({ v, fmt }: { v: number; fmt: Fmt }): React.JSX.Element {
  if (v === 0) return <span>{fmt.num(0)}</span>
  return (
    <span>
      <span dir="ltr">
        {v > 0 ? '+' : '−'}
        {fmt.num(Math.abs(v))}
      </span>{' '}
      د
    </span>
  )
}

const OUTCOME_TONE: Record<PrayerLogEntry['outcome'], string> = {
  prayed: 'good',
  ended: 'neutral',
  emergency: 'warn',
  skipped: 'muted'
}

export function PrayerPage(): React.JSX.Element {
  const snap = useSnapshot()
  const fmt = useFmt()
  const now = useNow(30_000)
  const settings = snap.settings
  const bundle = snap.schedule
  const today = dayKey(now)
  const history = useData(
    () => api.invoke('prayer:history', { from: addDays(today, -6), to: today }),
    [today]
  )
  const next = bundle
    ? nextEvent([bundle.yesterday, bundle.today, bundle.tomorrow], now, true)
    : null
  const friday = bundle?.today.isFriday ?? false

  const setPrayer = (p: PrayerId, patch: Partial<(typeof settings.prayers)[PrayerId]>): void => {
    void updateSettings({ prayers: { [p]: patch } })
  }

  const days = [...new Set((history.data ?? []).map((e) => e.day))].sort().reverse()

  return (
    <motion.div className={s.page} initial="hidden" animate="show" variants={stagger()}>
      <PageHeader
        title={t.title}
        sub={
          <>
            {fmt.gregorian(now)}
            <Divider />
            {fmt.hijri(now)}
            <Divider />
            {locationLabel(settings, t.customCoords)}
          </>
        }
      />

      <Panel title={t.todayTimes} id="prayer-times">
        {bundle ? (
          <div className={s.table} role="table" aria-label={t.todayTimes}>
            <div className={s.head} role="row">
              <span role="columnheader">{t.title}</span>
              <span role="columnheader">{t.lock}</span>
              <span role="columnheader">{t.lockFor}</span>
              <span role="columnheader">{t.adjust}</span>
            </div>
            {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((slot) => {
              const at = bundle.today.times[slot]
              const isNext = next?.slot === slot && next.day === bundle.today.day
              if (slot === 'sunrise') {
                return (
                  <div key={slot} className={s.row} role="row" data-muted>
                    <span className={s.name} role="cell">
                      <span className={s.prayer}>{prayerNames.sunrise}</span>
                      <span className={`${s.time} num`}>{fmt.clock(at)}</span>
                    </span>
                    <span className={s.note} role="cell">
                      {t.sunriseNote}
                    </span>
                  </div>
                )
              }
              const p = settings.prayers[slot]
              const jumuah = slot === 'dhuhr' && friday
              const lockOn = jumuah ? settings.friday.lock : p.lock
              const lockMinutes = jumuah ? settings.friday.lockMinutes : p.lockMinutes
              return (
                <div key={slot} className={s.row} role="row" data-next={isNext || undefined}>
                  <span className={s.name} role="cell">
                    <span className={s.prayer}>
                      {prayerLabel({ prayer: slot, isJumuah: jumuah })}
                      {isNext ? <span className={s.nextTag}>{t.nextTag}</span> : null}
                    </span>
                    <span className={`${s.time} num`}>{fmt.clock(at)}</span>
                  </span>
                  <span role="cell">
                    <Switch
                      checked={lockOn}
                      label={`${t.lock} ${prayerNames[slot]}`}
                      onChange={(v) =>
                        jumuah
                          ? void updateSettings({ friday: { lock: v } })
                          : setPrayer(slot, { lock: v })
                      }
                    />
                  </span>
                  <span role="cell" className={lockOn ? undefined : s.dim}>
                    <Stepper
                      label={`${t.lockFor} ${prayerNames[slot]}`}
                      value={lockMinutes}
                      min={5}
                      max={60}
                      step={5}
                      format={(v) => fmt.minutes(v)}
                      onChange={(v) =>
                        jumuah
                          ? void updateSettings({ friday: { lockMinutes: v } })
                          : setPrayer(slot, { lockMinutes: v })
                      }
                    />
                  </span>
                  <span role="cell">
                    <Stepper
                      label={`${t.adjust} ${prayerNames[slot]}`}
                      value={p.adjust}
                      min={-15}
                      max={15}
                      format={(v) => <Signed v={v} fmt={fmt} />}
                      onChange={(v) => setPrayer(slot, { adjust: v })}
                    />
                  </span>
                </div>
              )
            })}
            <p className={s.footnote}>{t.adjustHint}</p>
          </div>
        ) : (
          <EmptyState art="error" body={snap.scheduleError ? t.coordsInvalid : common.loadError} />
        )}
      </Panel>

      {/* Two independent columns so short cards don't leave holes beside tall ones. */}
      <div className={s.columns}>
        <div className={s.column}>
          <Panel title={t.location} id="prayer-location">
            <LocationPicker
              value={settings.location}
              onChange={(loc) => void updateSettings({ location: loc })}
            />
          </Panel>

          <Panel title={t.reminders} id="prayer-reminders">
            <SettingRow label={t.reminderBefore}>
              <Stepper
                label={t.reminderBefore}
                value={settings.reminderMinutes}
                min={0}
                max={60}
                step={5}
                format={(v) => (v === 0 ? t.reminderOff : fmt.minutes(v))}
                onChange={(v) => void updateSettings({ reminderMinutes: v })}
              />
            </SettingRow>
            <Toggle
              label={t.chime}
              hint={t.chimeHint}
              checked={settings.chime}
              onChange={(v) => void updateSettings({ chime: v })}
            />
            <div className={s.sliderRow}>
              <div className={s.sliderLabel}>
                <span>{t.minUnlock}</span>
                <span className={`${s.sliderValue} num`}>
                  {settings.minUnlockMinutes === 0
                    ? t.immediately
                    : fmt.minutes(settings.minUnlockMinutes)}
                </span>
              </div>
              <Slider
                label={t.minUnlock}
                value={settings.minUnlockMinutes}
                min={0}
                max={15}
                valueText={(v) => (v === 0 ? t.immediately : fmt.minutes(v))}
                onChange={(v) => void updateSettings({ minUnlockMinutes: v })}
              />
            </div>
          </Panel>
        </div>

        <div className={s.column}>
          <Panel title={t.friday} id="prayer-friday">
            <p className={s.lead}>{t.fridayLead}</p>
            <Toggle
              label={t.lock}
              checked={settings.friday.lock}
              onChange={(v) => void updateSettings({ friday: { lock: v } })}
            />
            <SettingRow label={t.fridayReminder}>
              <Stepper
                label={t.fridayReminder}
                value={settings.friday.reminderMinutes}
                min={0}
                max={120}
                step={5}
                format={(v) => (v === 0 ? t.reminderOff : fmt.minutes(v))}
                onChange={(v) => void updateSettings({ friday: { reminderMinutes: v } })}
              />
            </SettingRow>
            <SettingRow label={t.fridayLock}>
              <Stepper
                label={t.fridayLock}
                value={settings.friday.lockMinutes}
                min={5}
                max={60}
                step={5}
                format={(v) => fmt.minutes(v)}
                onChange={(v) => void updateSettings({ friday: { lockMinutes: v } })}
              />
            </SettingRow>
          </Panel>

          <Panel title={t.smart} id="prayer-smart">
            <Toggle
              label={t.skipAway}
              hint={t.skipAwayHint}
              checked={settings.smart.skipWhenAway}
              onChange={(v) => void updateSettings({ smart: { skipWhenAway: v } })}
            />
            <Toggle
              label={t.deferMeetings}
              hint={t.deferMeetingsHint}
              checked={settings.smart.deferInMeetings}
              onChange={(v) => void updateSettings({ smart: { deferInMeetings: v } })}
            />
          </Panel>
        </div>
      </div>

      <Panel title={t.history} id="prayer-history">
        {history.error ? (
          <EmptyState
            art="error"
            body={common.loadError}
            action={<Button onClick={history.reload}>{common.retry}</Button>}
          />
        ) : days.length === 0 ? (
          <EmptyState body={t.emptyHistory} />
        ) : (
          <div className={s.history}>
            {days.map((d) => (
              <section key={d} className={s.day}>
                <h3 className={s.dayTitle}>
                  {fmt.weekday(dayStart(d).getTime())} {fmt.dayMonth(dayStart(d).getTime())}
                </h3>
                <ul className={s.entries}>
                  {(history.data ?? [])
                    .filter((e) => e.day === d)
                    .map((e) => (
                      <li key={`${e.day}-${e.prayer}`} className={s.entry}>
                        <span className={s.entryName}>
                          {prayerLabel({
                            prayer: e.prayer,
                            isJumuah: e.prayer === 'dhuhr' && isFriday(e.day)
                          })}
                        </span>
                        <span className={s.outcome} data-tone={OUTCOME_TONE[e.outcome]}>
                          {t.outcome[e.outcome]}
                        </span>
                        {e.reason && t.reason[e.reason] ? (
                          <span className={s.reason}>{t.reason[e.reason]}</span>
                        ) : null}
                        {e.snoozed ? <span className={s.snoozed}>{t.snoozedTag}</span> : null}
                        <span className={`${s.entryTime} num`}>{fmt.clock(e.scheduledAt)}</span>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </motion.div>
  )
}
