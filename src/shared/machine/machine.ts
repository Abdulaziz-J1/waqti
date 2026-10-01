import { MINUTE, SECOND } from '../time'
import type { FocusSessionRecord } from '../tracking/aggregate'
import type {
  Effect,
  FocusSession,
  FocusState,
  LockPlan,
  LockView,
  MachineConfig,
  MachineEvent,
  MachineState,
  PlannedPrayer,
  PrayerLogEntry,
  PrayerReason,
  PrayerRef,
  PrayerState,
  TickContext,
  Transition
} from './types'

export const DEFAULT_MACHINE_CONFIG: MachineConfig = {
  skipWhenAway: true,
  deferInMeetings: true,
  awayThresholdSec: 5 * 60,
  meetingRecheckMs: 60 * SECOND,
  meetingMaxMs: 30 * MINUTE,
  snoozeMinMs: MINUTE,
  snoozeMaxMs: 15 * MINUTE,
  hardMaxMs: 60 * MINUTE,
  resumeReminderMs: 20 * MINUTE,
  startupOfferMs: 10 * MINUTE,
  guardSnoozeMs: 5 * MINUTE,
  guardGraceMs: 3 * SECOND,
  lateLockMinMs: 5 * MINUTE,
  adhanNoticeMs: 10 * SECOND,
  lockShowGraceMs: 5 * SECOND
}

export const INITIAL_STATE: MachineState = {
  prayer: { kind: 'idle' },
  focus: { kind: 'off' },
  asleep: false
}

const IDLE: PrayerState = { kind: 'idle' }

function sameRef(a: PrayerRef, b: PrayerRef): boolean {
  return a.prayer === b.prayer && a.day === b.day
}

function activeRef(p: PrayerState): PrayerRef | null {
  return p.kind === 'idle' ? null : p.ref
}

function log(
  ref: PrayerRef,
  outcome: PrayerLogEntry['outcome'],
  reason: PrayerReason | null,
  snoozed: boolean,
  at: number
): Effect {
  return {
    type: 'logPrayer',
    entry: {
      prayer: ref.prayer,
      day: ref.day,
      scheduledAt: ref.adhanAt,
      outcome,
      reason,
      snoozed,
      at
    }
  }
}

export function lockView(p: Extract<PrayerState, { kind: 'locked' }>): LockView {
  return {
    ref: p.ref,
    startedAt: p.startedAt,
    until: p.until,
    minUnlockAt: p.minUnlockAt,
    runningSince: p.runningSince,
    hardUntil: p.hardUntil,
    snoozeEnabled: p.plan.snooze,
    snoozeAvailable: p.plan.snooze && !p.snoozeUsed,
    chime: p.plan.chime
  }
}

function isLockingState(p: PrayerState): boolean {
  return p.kind === 'locked' || p.kind === 'snoozed'
}

// ---------------------------------------------------------------------------
// Focus helpers
// ---------------------------------------------------------------------------

function record(
  s: FocusSession,
  endedAt: number,
  focusedMs: number,
  completed: boolean
): FocusSessionRecord {
  return {
    id: s.id,
    startedAt: s.startedAt,
    endedAt,
    plannedMs: s.plannedMs,
    focusedMs: Math.max(0, Math.round(focusedMs)),
    blocked: s.blocked,
    snoozed: s.snoozed,
    completed
  }
}

function pauseFocus(
  f: FocusState,
  now: number,
  reason: 'prayer' | 'sleep',
  effects: Effect[]
): FocusState {
  if (f.kind !== 'focus' && f.kind !== 'guard') return f
  if (f.kind === 'guard') effects.push({ type: 'hideGuard' })
  const s = f.session
  return {
    kind: 'focusPaused',
    session: { ...s, focusedMs: s.focusedMs + Math.max(0, now - s.segmentStart) },
    remainingMs: Math.max(0, s.endsAt - now),
    pausedAt: now,
    reason
  }
}

function resumeFocus(f: FocusState, now: number, effects: Effect[], announce: boolean): FocusState {
  if (f.kind !== 'focusPaused') return f
  if (announce)
    effects.push({ type: 'toast', toast: { kind: 'focusResumed', remainingMs: f.remainingMs } })
  return {
    kind: 'focus',
    session: { ...f.session, endsAt: now + f.remainingMs, segmentStart: now, graceUntil: null }
  }
}

function completeFocus(f: FocusState, now: number, effects: Effect[]): FocusState {
  if (f.kind !== 'focus' && f.kind !== 'guard') return f
  if (f.kind === 'guard') effects.push({ type: 'hideGuard' })
  const s = f.session
  const end = Math.min(now, s.endsAt)
  const rec = record(s, end, s.focusedMs + Math.max(0, end - s.segmentStart), true)
  effects.push(
    { type: 'saveFocus', record: rec },
    { type: 'focusSummary', record: rec },
    { type: 'toast', toast: { kind: 'focusDone', focusedMs: rec.focusedMs } }
  )
  if (s.breakMs) effects.push({ type: 'breakReminder', at: end + s.breakMs })
  return { kind: 'off' }
}

// ---------------------------------------------------------------------------
// Prayer helpers
// ---------------------------------------------------------------------------

function startLock(
  ref: PrayerRef,
  plan: LockPlan,
  now: number,
  until: number,
  cfg: MachineConfig,
  snoozeUsed: boolean
): Extract<PrayerState, { kind: 'locked' }> {
  const hardUntil = now + cfg.hardMaxMs
  const end = Math.min(until, hardUntil)
  return {
    kind: 'locked',
    ref,
    plan,
    startedAt: now,
    until: end,
    minUnlockAt: Math.min(now + plan.minUnlockMs, end),
    hardUntil,
    snoozeUsed,
    runningSince: null
  }
}

/**
 * Starts a lock's countdown at `now`, when it is on screen. Both lengths are
 * kept in whole seconds from the same instant, so the time left and
 * «صلّيت» tick together, and the lock shows its full length when it appears
 * (it may have been scheduled a moment before the window could show it).
 */
function runLock(
  p: Extract<PrayerState, { kind: 'locked' }>,
  now: number
): Extract<PrayerState, { kind: 'locked' }> {
  const whole = (ms: number): number => Math.ceil(Math.max(0, ms) / SECOND) * SECOND
  // The 60-minute safety maximum still counts from the start and is never moved.
  const until = Math.min(now + whole(p.until - p.startedAt), p.hardUntil)
  return {
    ...p,
    runningSince: now,
    until,
    minUnlockAt: Math.min(now + whole(p.minUnlockAt - p.startedAt), until)
  }
}

/** A lock that starts after its prayer time (meeting ended, offer accepted). */
function lateLock(ref: PrayerRef, plan: LockPlan, now: number, cfg: MachineConfig) {
  const windowEnd = ref.at + plan.lockMs
  const until = Math.max(windowEnd, now + Math.max(plan.minUnlockMs, cfg.lateLockMinMs))
  return startLock(ref, plan, now, until, cfg, false)
}

/** Closes whatever the prayer region was doing for an older prayer. */
function supersede(p: PrayerState, now: number, effects: Effect[]): void {
  switch (p.kind) {
    case 'locked':
      effects.push({ type: 'hideLock' }, log(p.ref, 'ended', 'superseded', p.snoozeUsed, now))
      return
    case 'snoozed':
      effects.push(log(p.ref, 'ended', 'superseded', true, now))
      return
    case 'meetingDeferred':
      effects.push(log(p.ref, 'skipped', 'meeting', false, now))
      return
    case 'offered':
      effects.push(log(p.ref, 'skipped', 'late-start', false, now))
      return
    default:
      return
  }
}

function endLock(
  s: MachineState,
  p: Extract<PrayerState, { kind: 'locked' }>,
  now: number,
  outcome: PrayerLogEntry['outcome'],
  reason: PrayerReason | null,
  effects: Effect[]
): MachineState {
  effects.push({ type: 'hideLock' }, log(p.ref, outcome, reason, p.snoozeUsed, now))
  return { ...s, prayer: IDLE, focus: resumeFocus(s.focus, now, effects, true) }
}

function enterLock(
  s: MachineState,
  lock: Extract<PrayerState, { kind: 'locked' }>,
  now: number,
  effects: Effect[]
): MachineState {
  // Hide the focus guard (if any) before the lock goes up.
  const focus = pauseFocus(s.focus, now, 'prayer', effects)
  effects.push({ type: 'showLock', lock: lockView(lock) })
  return { ...s, prayer: lock, focus }
}

/** Away: the screen is locked, or no input for a while and nothing playing. */
export function isAway(ctx: TickContext, cfg: MachineConfig): boolean {
  if (ctx.screenLocked) return true
  return ctx.idleSeconds >= cfg.awayThresholdSec && !ctx.mediaPlaying
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onPrayerDue(
  s: MachineState,
  e: Extract<MachineEvent, { type: 'PRAYER_DUE' }>,
  cfg: MachineConfig,
  effects: Effect[]
): MachineState {
  const current = activeRef(s.prayer)
  if (current && sameRef(current, e.ref)) return s
  let base: MachineState = { ...s, prayer: IDLE }
  if (current && !sameRef(current, e.ref)) {
    supersede(s.prayer, e.now, effects)
    // A superseded lock paused focus; give it back unless the new prayer locks again below.
    if (isLockingState(s.prayer))
      base = { ...base, focus: resumeFocus(s.focus, e.now, effects, false) }
  }

  // A prayer that does not lock has nothing more to do: the adhan notice announced it.
  if (!e.plan) return base
  if (cfg.skipWhenAway && isAway(e.ctx, cfg)) {
    effects.push(log(e.ref, 'skipped', 'away', false, e.now))
    return base
  }
  if (cfg.deferInMeetings && e.ctx.inMeeting) {
    effects.push({ type: 'toast', toast: { kind: 'meeting', ref: e.ref } })
    return {
      ...base,
      prayer: {
        kind: 'meetingDeferred',
        ref: e.ref,
        plan: e.plan,
        since: e.now,
        nextCheckAt: e.now + cfg.meetingRecheckMs,
        giveUpAt: e.now + cfg.meetingMaxMs
      }
    }
  }
  const until = e.ref.at + e.plan.lockMs > e.now ? e.ref.at + e.plan.lockMs : e.now + e.plan.lockMs
  return enterLock(base, startLock(e.ref, e.plan, e.now, until, cfg, false), e.now, effects)
}

function onTick(
  s: MachineState,
  e: Extract<MachineEvent, { type: 'TICK' }>,
  cfg: MachineConfig,
  effects: Effect[]
): MachineState {
  const { now, ctx } = e
  let next = s
  const p = s.prayer

  switch (p.kind) {
    case 'locked':
      if (now >= p.hardUntil) next = endLock(s, p, now, 'ended', 'safety', effects)
      else if (p.runningSince === null && now - p.startedAt >= cfg.lockShowGraceMs) {
        // The window never said it was shown: count from when it should have been.
        next = { ...s, prayer: runLock(p, p.startedAt + cfg.lockShowGraceMs) }
      } else if (now >= p.until) next = endLock(s, p, now, 'ended', 'duration', effects)
      break
    case 'snoozed':
      if (now >= p.resumeAt) {
        const lock = startLock(p.ref, p.plan, now, now + p.remainingMs, cfg, true)
        lock.minUnlockAt = Math.min(now + p.minRemainingMs, lock.until)
        next = enterLock(s, lock, now, effects)
      }
      break
    case 'meetingDeferred':
      if (now >= p.nextCheckAt) {
        const windowEnd = p.ref.at + p.plan.lockMs
        const decide = !ctx.inMeeting || now >= p.giveUpAt
        if (!decide) {
          next = { ...s, prayer: { ...p, nextCheckAt: now + cfg.meetingRecheckMs } }
        } else if (now < windowEnd) {
          next = enterLock(s, lateLock(p.ref, p.plan, now, cfg), now, effects)
        } else {
          effects.push(
            { type: 'toast', toast: { kind: 'meetingFinal', ref: p.ref } },
            log(p.ref, 'skipped', 'meeting', false, now)
          )
          next = { ...s, prayer: IDLE }
        }
      }
      break
    case 'offered':
      if (now >= p.expiresAt) {
        effects.push(log(p.ref, 'skipped', 'late-start', false, now))
        next = { ...s, prayer: IDLE }
      }
      break
    default:
      break
  }

  const f = next.focus
  if ((f.kind === 'focus' || f.kind === 'guard') && now >= f.session.endsAt) {
    next = { ...next, focus: completeFocus(f, now, effects) }
  }
  return next
}

function onResume(
  s: MachineState,
  e: Extract<MachineEvent, { type: 'RESUME' }>,
  cfg: MachineConfig,
  effects: Effect[]
): MachineState {
  const { now } = e
  let next: MachineState = { ...s, asleep: false }
  const p = next.prayer
  if (p.kind === 'locked') {
    if (now >= p.until || now >= p.hardUntil) {
      next = endLock(next, p, now, 'ended', now >= p.hardUntil ? 'safety' : 'duration', effects)
    } else {
      // Re-assert the overlays after sleep (displays may have changed).
      effects.push({ type: 'showLock', lock: lockView(p) })
    }
  }

  const missed = [...e.missed].sort((a, b) => a.ref.at - b.ref.at)
  const latest = missed.at(-1)
  for (const m of missed) {
    if (m.plan) effects.push(log(m.ref, 'skipped', 'asleep', false, now))
  }
  if (latest && now - latest.ref.at <= cfg.resumeReminderMs) {
    effects.push({
      type: 'toast',
      toast: { kind: 'resumeReminder', ref: latest.ref, agoMs: now - latest.ref.adhanAt }
    })
  }

  if (next.focus.kind === 'focusPaused' && next.focus.reason === 'sleep') {
    next = isLockingState(next.prayer)
      ? { ...next, focus: { ...next.focus, reason: 'prayer' } }
      : { ...next, focus: resumeFocus(next.focus, now, effects, false) }
  }
  return next
}

function onAppStarted(
  s: MachineState,
  e: Extract<MachineEvent, { type: 'APP_STARTED' }>,
  cfg: MachineConfig,
  effects: Effect[]
): MachineState {
  const r: PlannedPrayer | null = e.recent
  if (!r || !r.plan || s.prayer.kind !== 'idle') return s
  const ago = e.now - r.ref.at
  if (ago < 0 || ago > cfg.startupOfferMs) return s
  const windowEnd = r.ref.at + r.plan.lockMs
  // The offer window counts from the lock time; the text says how long ago the adhan was.
  effects.push({
    type: 'toast',
    toast: { kind: 'offer', ref: r.ref, agoMs: e.now - r.ref.adhanAt }
  })
  return {
    ...s,
    prayer: {
      kind: 'offered',
      ref: r.ref,
      plan: r.plan,
      expiresAt: windowEnd > e.now ? windowEnd : e.now + cfg.lateLockMinMs
    }
  }
}

function onFocusStart(
  s: MachineState,
  e: Extract<MachineEvent, { type: 'FOCUS_START' }>,
  effects: Effect[]
): MachineState {
  if (s.focus.kind !== 'off') return s
  const plannedMs = Math.max(MINUTE, Math.round(e.seconds) * SECOND || MINUTE)
  const session: FocusSession = {
    id: e.id,
    startedAt: e.now,
    plannedMs,
    endsAt: e.now + plannedMs,
    focusedMs: 0,
    segmentStart: e.now,
    blocked: 0,
    snoozed: 0,
    snoozeUntil: null,
    graceUntil: null,
    breakMs: e.breakMinutes && e.breakMinutes > 0 ? e.breakMinutes * MINUTE : null
  }
  const running: FocusState = { kind: 'focus', session }
  if (isLockingState(s.prayer) || s.asleep) {
    return {
      ...s,
      focus: pauseFocus(running, e.now, s.asleep ? 'sleep' : 'prayer', effects)
    }
  }
  return { ...s, focus: running }
}

/**
 * − / + beside the running dial: moves the end by `deltaMs`, never leaving
 * less than a minute to go. The planned length follows so the ring stays true.
 */
function onFocusAdjust(s: MachineState, now: number, deltaMs: number): MachineState {
  const f = s.focus
  if (f.kind === 'off' || !Number.isFinite(deltaMs) || deltaMs === 0) return s
  if (f.kind === 'focusPaused') {
    const remainingMs = Math.max(MINUTE, f.remainingMs + deltaMs)
    const applied = remainingMs - f.remainingMs
    return {
      ...s,
      focus: {
        ...f,
        remainingMs,
        session: { ...f.session, plannedMs: f.session.plannedMs + applied }
      }
    }
  }
  const endsAt = Math.max(now + MINUTE, f.session.endsAt + deltaMs)
  const applied = endsAt - f.session.endsAt
  if (applied === 0) return s
  const session = { ...f.session, endsAt, plannedMs: f.session.plannedMs + applied }
  return { ...s, focus: { ...f, session } }
}

function onFocusStop(s: MachineState, now: number, effects: Effect[]): MachineState {
  const f = s.focus
  if (f.kind === 'off') return s
  if (f.kind === 'guard') effects.push({ type: 'hideGuard' })
  const running = f.kind === 'focus' || f.kind === 'guard'
  const focused = f.session.focusedMs + (running ? Math.max(0, now - f.session.segmentStart) : 0)
  effects.push({ type: 'saveFocus', record: record(f.session, now, focused, false) })
  return { ...s, focus: { kind: 'off' } }
}

/**
 * The orchestrator. Pure: the same state and event always produce the same
 * next state and effects. The main process executes the effects.
 */
export function reduce(
  s: MachineState,
  e: MachineEvent,
  cfg: MachineConfig = DEFAULT_MACHINE_CONFIG
): Transition {
  const effects: Effect[] = []
  let state = s

  switch (e.type) {
    case 'TICK':
      state = onTick(s, e, cfg, effects)
      break

    case 'ADHAN_DUE':
      // Announces the adhan; never over a lock or while the device sleeps.
      if (s.prayer.kind !== 'locked' && !s.asleep) {
        effects.push({
          type: 'showAdhan',
          adhan: {
            kind: 'adhan',
            ref: e.ref,
            lockAt: e.locks ? e.ref.at : null,
            shownAt: e.now,
            until: e.now + cfg.adhanNoticeMs,
            chime: e.chime
          }
        })
      }
      break

    case 'SUNRISE_DUE':
      // The same short notice as the adhan's; never over a lock or while asleep.
      if (s.prayer.kind !== 'locked' && !s.asleep) {
        effects.push({
          type: 'showAdhan',
          adhan: {
            kind: 'sunrise',
            sunriseAt: e.sunriseAt,
            shownAt: e.now,
            until: e.now + cfg.adhanNoticeMs,
            chime: e.chime
          }
        })
      }
      break

    case 'PRAYER_DUE':
      state = onPrayerDue(s, e, cfg, effects)
      break

    case 'LOCK_SHOWN':
      if (s.prayer.kind === 'locked' && s.prayer.runningSince === null) {
        state = { ...s, prayer: runLock(s.prayer, e.now) }
      }
      break

    case 'PRAYED':
      if (s.prayer.kind === 'locked' && e.now >= s.prayer.minUnlockAt) {
        state = endLock(s, s.prayer, e.now, 'prayed', null, effects)
      }
      break

    case 'SNOOZE':
      if (
        s.prayer.kind === 'locked' &&
        s.prayer.plan.snooze &&
        !s.prayer.snoozeUsed &&
        s.prayer.until > e.now
      ) {
        const p = s.prayer
        const snoozeMs = Math.min(
          cfg.snoozeMaxMs,
          Math.max(cfg.snoozeMinMs, Math.round(e.minutes) * MINUTE || cfg.snoozeMinMs)
        )
        effects.push({ type: 'hideLock' })
        state = {
          ...s,
          prayer: {
            kind: 'snoozed',
            ref: p.ref,
            plan: p.plan,
            snoozedAt: e.now,
            resumeAt: e.now + snoozeMs,
            remainingMs: p.until - e.now,
            minRemainingMs: Math.max(0, p.minUnlockAt - e.now)
          }
        }
      }
      break

    case 'EMERGENCY_EXIT':
      if (s.prayer.kind === 'locked') {
        state = endLock(s, s.prayer, e.now, 'emergency', null, effects)
      }
      break

    case 'FORCE_UNLOCK':
      if (s.prayer.kind === 'locked') {
        state = endLock(s, s.prayer, e.now, 'ended', 'safety', effects)
      }
      break

    case 'SUSPEND':
      state = { ...s, asleep: true, focus: pauseFocus(s.focus, e.now, 'sleep', effects) }
      break

    case 'RESUME':
      state = onResume(s, e, cfg, effects)
      break

    case 'APP_STARTED':
      state = onAppStarted(s, e, cfg, effects)
      break

    case 'OFFER_ACCEPTED':
      if (s.prayer.kind === 'offered') {
        state = enterLock(s, lateLock(s.prayer.ref, s.prayer.plan, e.now, cfg), e.now, effects)
      }
      break

    case 'FOCUS_START':
      state = onFocusStart(s, e, effects)
      break

    case 'FOCUS_ADJUST':
      state = onFocusAdjust(s, e.now, e.deltaMs)
      break

    case 'FOCUS_STOP':
      state = onFocusStop(s, e.now, effects)
      break

    case 'DISTRACTION': {
      const f = s.focus
      if (f.kind === 'focus') {
        const sess = f.session
        const snoozed = sess.snoozeUntil !== null && e.now < sess.snoozeUntil
        const grace = sess.graceUntil !== null && e.now < sess.graceUntil
        if (!snoozed && !grace) {
          effects.push({
            type: 'showGuard',
            guard: { target: e.target, sessionEndsAt: sess.endsAt }
          })
          state = { ...s, focus: { kind: 'guard', session: sess, target: e.target } }
        }
      } else if (f.kind === 'guard' && f.target.label !== e.target.label) {
        effects.push({
          type: 'showGuard',
          guard: { target: e.target, sessionEndsAt: f.session.endsAt }
        })
        state = { ...s, focus: { ...f, target: e.target } }
      }
      break
    }

    case 'DISTRACTION_CLEARED':
      if (s.focus.kind === 'guard') {
        effects.push({ type: 'hideGuard' })
        const sess = s.focus.session
        state = { ...s, focus: { kind: 'focus', session: { ...sess, blocked: sess.blocked + 1 } } }
      }
      break

    case 'GUARD_BACK':
      if (s.focus.kind === 'guard') {
        const { session: sess, target } = s.focus
        effects.push(
          { type: 'minimize', hwnd: target.hwnd },
          { type: 'hideGuard' },
          {
            type: 'logDistraction',
            sessionId: sess.id,
            at: e.now,
            label: target.label,
            process: target.process,
            site: target.site,
            action: 'back'
          }
        )
        state = {
          ...s,
          focus: {
            kind: 'focus',
            session: { ...sess, blocked: sess.blocked + 1, graceUntil: e.now + cfg.guardGraceMs }
          }
        }
      }
      break

    case 'GUARD_SNOOZE':
      if (s.focus.kind === 'guard') {
        const { session: sess, target } = s.focus
        effects.push(
          { type: 'hideGuard' },
          {
            type: 'logDistraction',
            sessionId: sess.id,
            at: e.now,
            label: target.label,
            process: target.process,
            site: target.site,
            action: 'snooze'
          }
        )
        state = {
          ...s,
          focus: {
            kind: 'focus',
            session: { ...sess, snoozed: sess.snoozed + 1, snoozeUntil: e.now + cfg.guardSnoozeMs }
          }
        }
      }
      break
  }

  return { state, effects }
}

/** Short label for the debug readout, e.g. "locked · focusPaused". */
export function describeState(s: MachineState): string {
  const parts: string[] = [s.prayer.kind]
  if (s.focus.kind !== 'off') parts.push(s.focus.kind)
  if (s.asleep) parts.push('asleep')
  return parts.join(' · ')
}

/** Remaining focus time at `now` (for the UI), or null when no session. */
export function focusRemaining(f: FocusState, now: number): number | null {
  if (f.kind === 'off') return null
  if (f.kind === 'focusPaused') return f.remainingMs
  return Math.max(0, f.session.endsAt - now)
}

/**
 * How far the session has run (0…1) for the taskbar button's progress bar,
 * and whether it is paused; null when no session.
 */
export function focusProgress(
  f: FocusState,
  now: number
): { fraction: number; paused: boolean } | null {
  const remaining = focusRemaining(f, now)
  if (f.kind === 'off' || remaining === null) return null
  const planned = Math.max(1, f.session.plannedMs)
  return {
    fraction: Math.min(1, Math.max(0, (planned - remaining) / planned)),
    paused: f.kind === 'focusPaused'
  }
}
