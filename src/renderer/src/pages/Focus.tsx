import { motion } from 'motion/react'
import { Play, Square } from 'lucide-react'
import { useState } from 'react'
import { focusRemaining } from '@shared/machine/machine'
import type { FocusState } from '@shared/machine/types'
import { common, focusPage as t } from '@shared/strings'
import { dayKey } from '@shared/time'
import { Button } from '../components/Button'
import { DistractionEditor } from '../components/DistractionEditor'
import { EmptyState } from '../components/EmptyState'
import { SettingRow } from '../components/Field'
import { Odometer } from '../components/Odometer'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { Segmented } from '../components/Segmented'
import { Stepper } from '../components/Stepper'
import { TimerRing } from '../components/TimerRing'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import { useFmt } from '../lib/fmt'
import { useNow } from '../lib/now'
import { updateSettings, useSnapshot } from '../lib/store'
import { useData } from '../lib/useData'
import { stagger } from '../motion'
import s from './Focus.module.css'

type Choice = '25' | '50' | '90' | 'custom'
const PRESETS = [25, 50, 90]

/** The ring and countdown: the only part of the page that re-renders every second. */
function FocusTimer({ focus, minutes }: { focus: FocusState; minutes: number }): React.JSX.Element {
  const fmt = useFmt()
  const now = useNow(1000)
  const remaining = focusRemaining(focus, now)
  const session = focus.kind === 'off' ? null : focus.session
  const paused = focus.kind === 'focusPaused'
  const progress = session && remaining !== null ? 1 - remaining / session.plannedMs : 0
  return (
    <TimerRing progress={progress} paused={paused}>
      {session && remaining !== null ? (
        <>
          <span className={s.timerLabel}>{t.remaining}</span>
          <Odometer value={fmt.countdown(remaining)} className={s.timer} />
          <span className={s.timerSub}>
            {focus.kind === 'focusPaused'
              ? focus.reason === 'sleep'
                ? t.pausedSleep
                : t.pausedPrayer
              : t.endsAt(fmt.clock(now + remaining))}
          </span>
        </>
      ) : (
        <>
          <span className={`${s.timer} num`}>{fmt.countdown(minutes * 60_000)}</span>
          <span className={s.timerSub}>{fmt.minutes(minutes)}</span>
        </>
      )}
    </TimerRing>
  )
}

export function FocusPage(): React.JSX.Element {
  const snap = useSnapshot()
  const fmt = useFmt()
  const now = useNow(60_000)
  const settings = snap.settings
  const last = settings.focus.lastMinutes
  const [choice, setChoice] = useState<Choice>(
    PRESETS.includes(last) ? (String(last) as Choice) : 'custom'
  )
  const [custom, setCustom] = useState(PRESETS.includes(last) ? 30 : last)
  const minutes = choice === 'custom' ? custom : Number(choice)
  const focus = snap.machine.focus
  const running = focus.kind !== 'off'
  const today = dayKey(now)
  const sessions = useData(() => api.invoke('focus:sessions', { from: today, to: today }), [today])

  const session = running ? focus.session : null

  return (
    <motion.div className={s.page} initial="hidden" animate="show" variants={stagger()}>
      <PageHeader title={t.title} sub={t.lead} />

      <div className={s.top}>
        <Panel className={s.timerPanel} id="focus-timer">
          <div className={s.timerWrap}>
            <FocusTimer focus={focus} minutes={minutes} />

            {session ? (
              <div className={s.live}>
                <span>
                  {t.summaryBlocked}: <b className="num">{fmt.num(session.blocked)}</b>
                </span>
                <span>
                  {t.summarySnoozed}: <b className="num">{fmt.num(session.snoozed)}</b>
                </span>
              </div>
            ) : (
              <div className={s.choices}>
                <Segmented<Choice>
                  label={t.title}
                  value={choice}
                  onChange={setChoice}
                  options={[
                    ...PRESETS.map((p) => ({ value: String(p) as Choice, label: fmt.minutes(p) })),
                    { value: 'custom', label: t.custom }
                  ]}
                />
                {choice === 'custom' ? (
                  <Stepper
                    label={t.customMinutes}
                    value={custom}
                    min={5}
                    max={240}
                    step={5}
                    format={(v) => fmt.minutes(v)}
                    onChange={setCustom}
                  />
                ) : null}
              </div>
            )}

            {running ? (
              <Button
                variant="danger"
                size="lg"
                icon={<Square size={16} />}
                onClick={() => void api.invoke('focus:stop')}
                data-testid="focus-stop"
              >
                {t.stop}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                icon={<Play size={18} />}
                onClick={() => void api.invoke('focus:start', { minutes })}
                data-testid="focus-start"
              >
                {t.start}
              </Button>
            )}
          </div>

          <div className={s.breakRow}>
            <Toggle
              label={t.breakReminder}
              checked={settings.focus.breakReminder}
              onChange={(v) => void updateSettings({ focus: { breakReminder: v } })}
            />
            {settings.focus.breakReminder ? (
              <SettingRow label={t.breakMinutes}>
                <Stepper
                  label={t.breakMinutes}
                  value={settings.focus.breakMinutes}
                  min={1}
                  max={60}
                  format={(v) => fmt.minutes(v)}
                  onChange={(v) => void updateSettings({ focus: { breakMinutes: v } })}
                />
              </SettingRow>
            ) : null}
          </div>
        </Panel>

        <Panel title={t.distractionsTitle} id="focus-distractions">
          <DistractionEditor />
        </Panel>
      </div>

      <Panel title={t.todaySessions} id="focus-sessions">
        {sessions.error ? (
          <EmptyState
            art="error"
            body={common.loadError}
            action={<Button onClick={sessions.reload}>{common.retry}</Button>}
          />
        ) : sessions.data && sessions.data.length > 0 ? (
          <ul className={s.sessions}>
            {sessions.data.map((r) => (
              <li key={r.id} className={s.session}>
                <span className={`${s.sessionTime} num`}>
                  {fmt.clock(r.startedAt)} – {fmt.clock(r.endedAt)}
                </span>
                <span className={s.sessionDur}>{fmt.dur(r.focusedMs)}</span>
                <span className={s.sessionState} data-done={r.completed || undefined}>
                  {r.completed ? t.sessionDone : t.sessionStopped}
                </span>
                {r.blocked > 0 ? (
                  <span className={s.sessionMeta}>
                    {t.blockedCount(fmt.times(r.blocked, 'obl'))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState art="focus" body={t.emptySessions} />
        )}
      </Panel>
    </motion.div>
  )
}
