import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Play, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FOCUS_STEP_SECONDS,
  MAX_FOCUS_SECONDS,
  MIN_FOCUS_SECONDS,
  fmtHms,
  lengthUntil,
  stepFocus
} from '@shared/focus'
import { focusRemaining } from '@shared/machine/machine'
import type { FocusState } from '@shared/machine/types'
import { lockDuring } from '@shared/prayer/due'
import { common, focusPage as t, prayerNames } from '@shared/strings'
import { MINUTE, dayKey } from '@shared/time'
import { Button } from '../components/Button'
import { DistractionEditor } from '../components/DistractionEditor'
import { EmptyState } from '../components/EmptyState'
import { SettingRow } from '../components/Field'
import { FocusDial } from '../components/FocusDial'
import { NavIcon } from '../components/NavIcons'
import { Odometer } from '../components/Odometer'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { Stepper } from '../components/Stepper'
import { TimePicker } from '../components/TimePicker'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import { useFmt } from '../lib/fmt'
import { useNow } from '../lib/now'
import { updateSettings, useSnapshot } from '../lib/store'
import { useData } from '../lib/useData'
import { duration, ease, stagger } from '../motion'
import s from './Focus.module.css'

const STEP_MINUTES = FOCUS_STEP_SECONDS / 60

/**
 * The length on the dial. It changes on the page at once (drags, wheels) and
 * is saved a moment after the last change, so the tray and Today offer it too.
 */
function useLength(saved: number): [number, (seconds: number) => void] {
  // The draft holds until the saved length changes (this page saving it, or a
  // session started from the tray); then the saved one shows.
  const [draft, setDraft] = useState({ seconds: saved, saved })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  const set = useCallback(
    (next: number) => {
      setDraft({ seconds: next, saved })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        void updateSettings({ focus: { lastSeconds: next } })
      }, 450)
    },
    [saved]
  )
  return [draft.saved === saved ? draft.seconds : saved, set]
}

/** The dial before a session: drag it, press − / +, or open the picker from the clock face. */
function LengthDial({
  seconds,
  onChange
}: {
  seconds: number
  onChange: (seconds: number) => void
}): React.JSX.Element {
  const fmt = useFmt()
  const now = useNow(15_000)
  const [picker, setPicker] = useState(false)
  const face = useRef<HTMLButtonElement>(null)
  const words = fmt.dur(seconds * 1000, { round: 'round' })
  const close = useCallback(() => setPicker(false), [])
  return (
    <FocusDial
      seconds={seconds}
      onDrag={onChange}
      label={t.dialLabel}
      valueText={words}
      onStep={(dir) => onChange(stepFocus(seconds, dir))}
      canStep={(dir) => (dir > 0 ? seconds < MAX_FOCUS_SECONDS : seconds > MIN_FOCUS_SECONDS)}
      stepLabels={{ less: t.less, more: t.more, caption: t.stepCaption(fmt.num(STEP_MINUTES)) }}
    >
      <span className={s.timerLabel}>{t.length}</span>
      <div className={s.faceAnchor}>
        <button
          ref={face}
          type="button"
          className={s.face}
          aria-label={t.lengthButton(words)}
          aria-expanded={picker}
          aria-haspopup="dialog"
          onClick={() => setPicker((o) => !o)}
          data-testid="focus-face"
        >
          <Odometer
            value={fmtHms(seconds, fmt.digits)}
            className={s.timer}
            label={words}
            dimLeading
          />
          <ChevronDown size={16} className={s.chevron} data-open={picker || undefined} />
        </button>
        <TimePicker
          open={picker}
          seconds={seconds}
          onChange={onChange}
          onClose={close}
          anchor={face}
        />
      </div>
      <span className={s.timerSub}>{t.endsIfNow(fmt.clock(now + seconds * 1000))}</span>
    </FocusDial>
  )
}

/** The dial during a session: it unwinds each second, and − / + move the end. */
function SessionDial({
  focus
}: {
  focus: Exclude<FocusState, { kind: 'off' }>
}): React.JSX.Element {
  const fmt = useFmt()
  const now = useNow(1000)
  const remaining = focusRemaining(focus, now) ?? 0
  const left = Math.ceil(remaining / 1000)
  const paused = focus.kind === 'focusPaused'
  return (
    <FocusDial
      seconds={left}
      paused={paused}
      label={t.remaining}
      valueText={fmt.dur(remaining, { round: 'ceil' })}
      onStep={(dir) => void api.invoke('focus:adjust', { minutes: dir * STEP_MINUTES })}
      canStep={(dir) => (dir > 0 ? left < MAX_FOCUS_SECONDS : remaining > MINUTE)}
      stepLabels={{ less: t.less, more: t.more, caption: t.stepCaption(fmt.num(STEP_MINUTES)) }}
    >
      <span className={s.timerLabel}>{t.remaining}</span>
      <Odometer value={fmtHms(left, fmt.digits)} className={s.timer} dimLeading />
      <span className={s.timerSub}>
        {paused
          ? focus.reason === 'sleep'
            ? t.pausedSleep
            : t.pausedPrayer
          : t.endsAt(fmt.clock(now + remaining))}
      </span>
    </FocusDial>
  )
}

/**
 * When a prayer locks inside the chosen length, say so (the session pauses
 * for it) and offer to finish with its adhan instead.
 */
function PrayerNote({
  seconds,
  onFit
}: {
  seconds: number
  onFit: (seconds: number) => void
}): React.JSX.Element {
  const snap = useSnapshot()
  const fmt = useFmt()
  const now = useNow(15_000)
  const b = snap.schedule
  const ref = b
    ? lockDuring([b.yesterday, b.today, b.tomorrow], snap.settings, now, now + seconds * 1000)
    : null
  const fit = ref ? lengthUntil(now, ref.adhanAt) : null
  const name = ref ? (ref.isJumuah ? prayerNames.jumuah : prayerNames[ref.prayer]) : ''
  return (
    <AnimatePresence initial={false}>
      {ref ? (
        <motion.div
          key="note"
          className={s.prayerNote}
          role="status"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
          exit={{ opacity: 0, y: 4, transition: { duration: duration.fast } }}
          data-testid="focus-prayer-note"
        >
          <span className={s.prayerIcon} aria-hidden>
            <NavIcon page="prayer" />
          </span>
          <span className={s.prayerText}>{t.prayerInside(name, fmt.clock(ref.at))}</span>
          {fit !== null ? (
            <button type="button" className={s.fit} onClick={() => onFit(fit)}>
              {t.fitBefore(name)}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function FocusPage(): React.JSX.Element {
  const snap = useSnapshot()
  const fmt = useFmt()
  const now = useNow(60_000)
  const settings = snap.settings
  const [length, setLength] = useLength(settings.focus.lastSeconds)
  const focus = snap.machine.focus
  const today = dayKey(now)
  const sessions = useData(() => api.invoke('focus:sessions', { from: today, to: today }), [today])

  const start = (): void => {
    void api.invoke('focus:start', { seconds: length })
    if (length !== settings.focus.lastSeconds)
      void updateSettings({ focus: { lastSeconds: length } })
  }

  return (
    <motion.div className={s.page} initial="hidden" animate="show" variants={stagger()}>
      <PageHeader title={t.title} sub={t.lead} />

      <div className={s.top}>
        <Panel className={s.timerPanel} id="focus-timer">
          <div className={s.timerWrap}>
            {focus.kind === 'off' ? (
              <LengthDial seconds={length} onChange={setLength} />
            ) : (
              <SessionDial focus={focus} />
            )}

            {focus.kind === 'off' ? (
              <PrayerNote seconds={length} onFit={setLength} />
            ) : (
              <div className={s.live}>
                <span>
                  {t.summaryBlocked}: <b className="num">{fmt.num(focus.session.blocked)}</b>
                </span>
                <span>
                  {t.summarySnoozed}: <b className="num">{fmt.num(focus.session.snoozed)}</b>
                </span>
              </div>
            )}

            {focus.kind === 'off' ? (
              <Button
                variant="primary"
                size="lg"
                icon={<Play size={18} />}
                onClick={start}
                data-testid="focus-start"
              >
                {t.start}
              </Button>
            ) : (
              <Button
                variant="danger"
                size="lg"
                icon={<Square size={16} />}
                onClick={() => void api.invoke('focus:stop')}
                data-testid="focus-stop"
              >
                {t.stop}
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
