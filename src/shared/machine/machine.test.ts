import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MACHINE_CONFIG as CFG,
  INITIAL_STATE,
  describeState,
  focusProgress,
  focusRemaining,
  isAway,
  lockView,
  reduce
} from './machine'
import type {
  DistractionTarget,
  Effect,
  LockPlan,
  MachineEvent,
  MachineState,
  PrayerRef,
  TickContext
} from './types'
import { MINUTE, SECOND } from '../time'

const T0 = new Date('2026-09-27T15:09:00+03:00').getTime()
const ASR: PrayerRef = { prayer: 'asr', day: '2026-09-27', at: T0, adhanAt: T0, isJumuah: false }
const MAGHRIB: PrayerRef = {
  prayer: 'maghrib',
  day: '2026-09-27',
  at: T0 + 156 * MINUTE,
  adhanAt: T0 + 156 * MINUTE,
  isJumuah: false
}
/** Asr whose lock comes 20 minutes after its adhan (the iqama). */
const ASR_IQAMA: PrayerRef = { ...ASR, adhanAt: T0 - 20 * MINUTE }
const PLAN: LockPlan = {
  lockMs: 15 * MINUTE,
  minUnlockMs: 5 * MINUTE,
  chime: true,
  snooze: true
}
const CTX: TickContext = {
  idleSeconds: 0,
  screenLocked: false,
  inMeeting: false,
  mediaPlaying: false
}
const TARGET: DistractionTarget = {
  kind: 'site',
  label: 'YouTube',
  process: 'chrome.exe',
  site: 'youtube',
  hwnd: 42,
  bounds: null
}

function run(
  state: MachineState,
  ...events: MachineEvent[]
): { state: MachineState; effects: Effect[] } {
  let s = state
  const effects: Effect[] = []
  for (const e of events) {
    const r = reduce(s, e)
    s = r.state
    effects.push(...r.effects)
  }
  return { state: s, effects }
}

const types = (effects: Effect[]): string[] => effects.map((e) => e.type)
const tick = (now: number, ctx: Partial<TickContext> = {}): MachineEvent => ({
  type: 'TICK',
  now,
  ctx: { ...CTX, ...ctx }
})
const due = (
  now = T0,
  ctx: Partial<TickContext> = {},
  plan: LockPlan | null = PLAN,
  ref = ASR
): MachineEvent => ({
  type: 'PRAYER_DUE',
  now,
  ref,
  plan,
  ctx: { ...CTX, ...ctx }
})
const logs = (effects: Effect[]) =>
  effects.flatMap((e) => (e.type === 'logPrayer' ? [e.entry] : []))
const toastKinds = (effects: Effect[]) =>
  effects.flatMap((e) => (e.type === 'toast' ? [e.toast.kind] : []))

const shown = (now = T0): MachineEvent => ({ type: 'LOCK_SHOWN', now })
/** A lock whose window appeared at once (its countdown runs from T0). */
const locked = (): MachineState => run(INITIAL_STATE, due(), shown()).state

describe('pre-reminder', () => {
  it('idle → reminding with a toast', () => {
    const r = reduce(INITIAL_STATE, {
      type: 'PRE_REMINDER_DUE',
      now: T0 - 10 * MINUTE,
      ref: ASR,
      minutesBefore: 10
    })
    expect(r.state.prayer.kind).toBe('reminding')
    expect(toastKinds(r.effects)).toEqual(['preReminder'])
  })

  it('is ignored when already past the prayer or busy', () => {
    expect(
      reduce(INITIAL_STATE, { type: 'PRE_REMINDER_DUE', now: T0 + 1, ref: ASR, minutesBefore: 10 })
        .effects
    ).toEqual([])
    expect(
      reduce(locked(), { type: 'PRE_REMINDER_DUE', now: T0, ref: MAGHRIB, minutesBefore: 10 })
        .effects
    ).toEqual([])
  })

  it('reminding → locked at prayer time', () => {
    const r = run(
      INITIAL_STATE,
      { type: 'PRE_REMINDER_DUE', now: T0 - 10 * MINUTE, ref: ASR, minutesBefore: 10 },
      due()
    )
    expect(r.state.prayer.kind).toBe('locked')
  })

  it('a stale reminder returns to idle', () => {
    const r = run(
      INITIAL_STATE,
      { type: 'PRE_REMINDER_DUE', now: T0 - 10 * MINUTE, ref: ASR, minutesBefore: 10 },
      tick(T0 + 6 * MINUTE)
    )
    expect(r.state.prayer.kind).toBe('idle')
  })
})

describe('prayer time → lock', () => {
  it('idle → locked with overlay, anchored to the prayer time', () => {
    const r = reduce(INITIAL_STATE, due(T0 + 2 * SECOND))
    expect(r.state.prayer.kind).toBe('locked')
    expect(types(r.effects)).toEqual(['showLock'])
    if (r.state.prayer.kind !== 'locked') throw new Error()
    expect(r.state.prayer.until).toBe(T0 + 15 * MINUTE)
    expect(r.state.prayer.minUnlockAt).toBe(T0 + 2 * SECOND + 5 * MINUTE)
    expect(r.state.prayer.hardUntil).toBe(T0 + 2 * SECOND + 60 * MINUTE)
  })

  it('without a lock plan does nothing (the adhan notice announced it)', () => {
    const r = reduce(INITIAL_STATE, due(T0, {}, null))
    expect(r.state.prayer.kind).toBe('idle')
    expect(r.effects).toEqual([])
  })

  it('logs the adhan as the scheduled time when the lock comes at the iqama', () => {
    const r = run(INITIAL_STATE, due(T0, {}, PLAN, ASR_IQAMA), {
      type: 'EMERGENCY_EXIT',
      now: T0 + MINUTE
    })
    expect(logs(r.effects)[0]).toMatchObject({ scheduledAt: T0 - 20 * MINUTE })
  })

  it('a late PRAYER_DUE still locks for the full duration', () => {
    const r = reduce(INITIAL_STATE, due(T0 + 20 * MINUTE))
    if (r.state.prayer.kind !== 'locked') throw new Error()
    expect(r.state.prayer.until).toBe(T0 + 35 * MINUTE)
  })

  it('ignores a duplicate PRAYER_DUE for the active prayer', () => {
    const s = locked()
    expect(reduce(s, due(T0 + SECOND)).state).toBe(s)
  })

  it('supersedes an older prayer still in progress', () => {
    const r = run(locked(), due(MAGHRIB.at, {}, PLAN, MAGHRIB))
    expect(logs(r.effects)[0]).toMatchObject({
      prayer: 'asr',
      outcome: 'ended',
      reason: 'superseded'
    })
    expect(r.state.prayer.kind).toBe('locked')
  })
})

describe('smart rules', () => {
  it('skips when the user is away (idle ≥ 5 min)', () => {
    const r = reduce(INITIAL_STATE, due(T0, { idleSeconds: 301 }))
    expect(r.state.prayer.kind).toBe('idle')
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'skipped', reason: 'away' })
  })

  it('skips when the screen is locked', () => {
    const r = reduce(INITIAL_STATE, due(T0, { screenLocked: true }))
    expect(logs(r.effects)[0]).toMatchObject({ reason: 'away' })
  })

  it('someone watching a video is not away, even without input', () => {
    const r = reduce(INITIAL_STATE, due(T0, { idleSeconds: 1200, mediaPlaying: true }))
    expect(r.state.prayer.kind).toBe('locked')
    expect(isAway({ ...CTX, idleSeconds: 1200, mediaPlaying: true }, CFG)).toBe(false)
    // A locked Windows session is away whatever plays behind it.
    expect(isAway({ ...CTX, screenLocked: true, mediaPlaying: true }, CFG)).toBe(true)
  })

  it('does not skip when the away rule is off', () => {
    const r = reduce(INITIAL_STATE, due(T0, { idleSeconds: 999 }), { ...CFG, skipWhenAway: false })
    expect(r.state.prayer.kind).toBe('locked')
  })

  it('defers during a meeting and rechecks every 60 s', () => {
    const r = reduce(INITIAL_STATE, due(T0, { inMeeting: true }))
    expect(r.state.prayer.kind).toBe('meetingDeferred')
    expect(toastKinds(r.effects)).toEqual(['meeting'])
    // Not yet time to recheck.
    const r2 = reduce(r.state, tick(T0 + 30 * SECOND, { inMeeting: false }))
    expect(r2.state).toBe(r.state)
    // Still in the meeting at the recheck.
    const r3 = reduce(r.state, tick(T0 + 60 * SECOND, { inMeeting: true }))
    expect(r3.state.prayer.kind).toBe('meetingDeferred')
    if (r3.state.prayer.kind !== 'meetingDeferred') throw new Error()
    expect(r3.state.prayer.nextCheckAt).toBe(T0 + 120 * SECOND)
  })

  it('locks when the meeting ends inside the lock window', () => {
    const r = run(INITIAL_STATE, due(T0, { inMeeting: true }), tick(T0 + 3 * MINUTE))
    expect(r.state.prayer.kind).toBe('locked')
    if (r.state.prayer.kind !== 'locked') throw new Error()
    expect(r.state.prayer.until).toBe(T0 + 15 * MINUTE)
  })

  it('gives at least the minimum late-lock time near the window end', () => {
    const r = run(INITIAL_STATE, due(T0, { inMeeting: true }), tick(T0 + 14 * MINUTE))
    if (r.state.prayer.kind !== 'locked') throw new Error()
    expect(r.state.prayer.until).toBe(T0 + 19 * MINUTE)
  })

  it('shows a final reminder when the meeting outlasts the lock window', () => {
    let s = reduce(INITIAL_STATE, due(T0, { inMeeting: true })).state
    const all: Effect[] = []
    for (let t = T0 + MINUTE; t <= T0 + 30 * MINUTE; t += MINUTE) {
      const r = reduce(s, tick(t, { inMeeting: true }))
      s = r.state
      all.push(...r.effects)
    }
    expect(s.prayer.kind).toBe('idle')
    expect(toastKinds(all)).toEqual(['meetingFinal'])
    expect(logs(all)[0]).toMatchObject({ outcome: 'skipped', reason: 'meeting' })
  })

  it('locks at the 30-minute give-up point if still inside a long lock window (Friday)', () => {
    const friday: LockPlan = { ...PLAN, lockMs: 40 * MINUTE }
    let s = reduce(INITIAL_STATE, due(T0, { inMeeting: true }, friday)).state
    for (let t = T0 + MINUTE; t <= T0 + 30 * MINUTE; t += MINUTE) {
      s = reduce(s, tick(t, { inMeeting: true })).state
    }
    expect(s.prayer.kind).toBe('locked')
  })

  it('does not defer when the meeting rule is off', () => {
    const r = reduce(INITIAL_STATE, due(T0, { inMeeting: true }), {
      ...CFG,
      deferInMeetings: false
    })
    expect(r.state.prayer.kind).toBe('locked')
  })
})

describe('lock exits', () => {
  it('صلّيت only works after the minimum time', () => {
    const s = locked()
    expect(reduce(s, { type: 'PRAYED', now: T0 + 4 * MINUTE }).state).toBe(s)
    const r = reduce(s, { type: 'PRAYED', now: T0 + 5 * MINUTE })
    expect(r.state.prayer.kind).toBe('idle')
    expect(types(r.effects)).toEqual(['hideLock', 'logPrayer'])
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'prayed', snoozed: false })
  })

  it('auto-unlocks when the duration ends', () => {
    const r = run(locked(), tick(T0 + 15 * MINUTE))
    expect(r.state.prayer.kind).toBe('idle')
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'ended', reason: 'duration' })
  })

  it('emergency exit always works', () => {
    const r = reduce(locked(), { type: 'EMERGENCY_EXIT', now: T0 + SECOND })
    expect(r.state.prayer.kind).toBe('idle')
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'emergency' })
    expect(reduce(INITIAL_STATE, { type: 'EMERGENCY_EXIT', now: T0 }).effects).toEqual([])
  })

  it('force-unlocks from the independent safety timer', () => {
    const r = reduce(locked(), { type: 'FORCE_UNLOCK', now: T0 + 61 * MINUTE })
    expect(r.state.prayer.kind).toBe('idle')
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'ended', reason: 'safety' })
    expect(reduce(INITIAL_STATE, { type: 'FORCE_UNLOCK', now: T0 }).effects).toEqual([])
  })

  it('enforces the 60-minute hard maximum', () => {
    const long: LockPlan = { ...PLAN, lockMs: 90 * MINUTE }
    const s = reduce(INITIAL_STATE, due(T0, {}, long)).state
    if (s.prayer.kind !== 'locked') throw new Error()
    expect(s.prayer.until).toBe(T0 + 60 * MINUTE)
    const forced: MachineState = { ...s, prayer: { ...s.prayer, until: T0 + 120 * MINUTE } }
    const r = reduce(forced, tick(T0 + 60 * MINUTE))
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'ended', reason: 'safety' })
  })
})

describe('lock countdown', () => {
  const lockOf = (s: MachineState) => {
    if (s.prayer.kind !== 'locked') throw new Error('not locked')
    return s.prayer
  }

  it('stands still until the lock is on screen, then runs in whole seconds from there', () => {
    // Noticed 700 ms after the iqama: the time left would be 700 ms short of «صلّيت» + 10 min.
    const due700 = run(INITIAL_STATE, due(T0 + 700, {}, PLAN, ASR)).state
    const before = lockOf(due700)
    expect(before.runningSince).toBeNull()
    expect(lockView(before).runningSince).toBeNull()
    const shownAt = T0 + 1_900
    const after = lockOf(reduce(due700, shown(shownAt)).state)
    expect(after.runningSince).toBe(shownAt)
    // The full lengths, from the moment it appeared, a whole number of seconds apart.
    expect(after.until).toBe(shownAt + 15 * MINUTE)
    expect(after.minUnlockAt).toBe(shownAt + 5 * MINUTE)
    expect(after.startedAt).toBe(before.startedAt)
    // Shown again (another display, a re-render): nothing moves.
    expect(reduce({ ...due700, prayer: after }, shown(shownAt + 3_000)).state.prayer).toBe(after)
  })

  it('starts by itself if the window never says it is shown', () => {
    const s = run(INITIAL_STATE, due(), tick(T0 + 4 * SECOND)).state
    expect(lockOf(s).runningSince).toBeNull()
    const started = lockOf(reduce(s, tick(T0 + 5 * SECOND)).state)
    expect(started.runningSince).toBe(T0 + 5 * SECOND)
    expect(started.until).toBe(T0 + 5 * SECOND + 15 * MINUTE)
    expect(started.minUnlockAt).toBe(T0 + 5 * SECOND + 5 * MINUTE)
  })

  it('stands still again when a snoozed lock comes back', () => {
    const snoozed = run(locked(), { type: 'SNOOZE', now: T0 + 2 * MINUTE, minutes: 5 }).state
    const back = lockOf(reduce(snoozed, tick(T0 + 7 * MINUTE)).state)
    expect(back.runningSince).toBeNull()
    const again = lockOf(reduce({ ...snoozed, prayer: back }, shown(T0 + 7 * MINUTE + 1_500)).state)
    expect(again.until - again.minUnlockAt).toBe(10 * MINUTE)
    expect(again.until).toBe(T0 + 7 * MINUTE + 1_500 + 13 * MINUTE)
  })

  it('ignores a show when nothing is locked', () => {
    expect(reduce(INITIAL_STATE, shown()).state).toBe(INITIAL_STATE)
  })
})

describe('snooze', () => {
  it('locked → snoozed → locked with the remaining time, once per prayer', () => {
    const s = locked()
    const r = reduce(s, { type: 'SNOOZE', now: T0 + 2 * MINUTE, minutes: 5 })
    expect(r.state.prayer.kind).toBe('snoozed')
    expect(types(r.effects)).toEqual(['hideLock'])
    // Still snoozed before 5 minutes.
    expect(reduce(r.state, tick(T0 + 6 * MINUTE)).state.prayer.kind).toBe('snoozed')
    const back = reduce(r.state, tick(T0 + 7 * MINUTE))
    expect(back.state.prayer.kind).toBe('locked')
    if (back.state.prayer.kind !== 'locked') throw new Error()
    expect(back.state.prayer.until).toBe(T0 + 7 * MINUTE + 13 * MINUTE)
    expect(back.state.prayer.minUnlockAt).toBe(T0 + 7 * MINUTE + 3 * MINUTE)
    expect(back.state.prayer.snoozeUsed).toBe(true)
    // A second snooze is refused.
    expect(reduce(back.state, { type: 'SNOOZE', now: T0 + 8 * MINUTE, minutes: 5 }).state).toBe(
      back.state
    )
    const done = reduce(back.state, { type: 'PRAYED', now: T0 + 11 * MINUTE })
    expect(logs(done.effects)[0]).toMatchObject({ outcome: 'prayed', snoozed: true })
  })

  it('ignores snooze when not locked', () => {
    expect(reduce(INITIAL_STATE, { type: 'SNOOZE', now: T0, minutes: 5 }).effects).toEqual([])
  })

  it('snoozes for the minutes chosen on the lock screen, within 1 to 15', () => {
    const resumeAt = (minutes: number): number => {
      const r = reduce(locked(), { type: 'SNOOZE', now: T0, minutes })
      if (r.state.prayer.kind !== 'snoozed') throw new Error()
      return r.state.prayer.resumeAt
    }
    expect(resumeAt(1)).toBe(T0 + MINUTE)
    expect(resumeAt(10)).toBe(T0 + 10 * MINUTE)
    expect(resumeAt(0)).toBe(T0 + MINUTE)
    expect(resumeAt(99)).toBe(T0 + 15 * MINUTE)
    expect(resumeAt(Number.NaN)).toBe(T0 + MINUTE)
  })

  it('offers no snooze when it is turned off', () => {
    const s = run(INITIAL_STATE, due(T0, {}, { ...PLAN, snooze: false })).state
    expect(reduce(s, { type: 'SNOOZE', now: T0 + MINUTE, minutes: 5 }).state).toBe(s)
    if (s.prayer.kind !== 'locked') throw new Error()
    expect(lockView(s.prayer).snoozeAvailable).toBe(false)
    const on = locked()
    if (on.prayer.kind !== 'locked') throw new Error()
    expect(lockView(on.prayer).snoozeAvailable).toBe(true)
  })
})

describe('sleep and resume', () => {
  it('sleep during a lock: resumes the lock if still inside the window', () => {
    const r = run(
      locked(),
      { type: 'SUSPEND', now: T0 + MINUTE },
      { type: 'RESUME', now: T0 + 5 * MINUTE, missed: [] }
    )
    expect(r.state.prayer.kind).toBe('locked')
    expect(r.state.asleep).toBe(false)
    expect(types(r.effects)).toContain('showLock')
  })

  it('sleep during a lock: ends it when the window passed', () => {
    const r = run(
      locked(),
      { type: 'SUSPEND', now: T0 + MINUTE },
      { type: 'RESUME', now: T0 + 40 * MINUTE, missed: [] }
    )
    expect(r.state.prayer.kind).toBe('idle')
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'ended', reason: 'duration' })
  })

  it('asleep at prayer time: short reminder within 20 minutes', () => {
    const r = run(
      INITIAL_STATE,
      { type: 'SUSPEND', now: T0 - 30 * MINUTE },
      { type: 'RESUME', now: T0 + 12 * MINUTE, missed: [{ ref: ASR, plan: PLAN }] }
    )
    expect(toastKinds(r.effects)).toEqual(['resumeReminder'])
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'skipped', reason: 'asleep' })
    expect(r.state.prayer.kind).toBe('idle')
  })

  it('asleep at prayer time: nothing shown after 20 minutes', () => {
    const r = run(INITIAL_STATE, {
      type: 'RESUME',
      now: T0 + 25 * MINUTE,
      missed: [{ ref: ASR, plan: PLAN }]
    })
    expect(toastKinds(r.effects)).toEqual([])
    expect(logs(r.effects)).toHaveLength(1)
  })

  it('tells how long ago the adhan was when the lock came at the iqama', () => {
    const r = reduce(INITIAL_STATE, {
      type: 'RESUME',
      now: T0 + 12 * MINUTE,
      missed: [{ ref: ASR_IQAMA, plan: PLAN }]
    })
    const toast = r.effects.find((e) => e.type === 'toast')
    if (toast?.type !== 'toast' || toast.toast.kind !== 'resumeReminder') throw new Error()
    expect(toast.toast.agoMs).toBe(32 * MINUTE)
  })

  it('does not log prayers that have no lock', () => {
    const r = reduce(INITIAL_STATE, {
      type: 'RESUME',
      now: T0 + MINUTE,
      missed: [{ ref: ASR, plan: null }]
    })
    expect(logs(r.effects)).toHaveLength(0)
    expect(toastKinds(r.effects)).toEqual(['resumeReminder'])
  })
})

describe('startup offer', () => {
  it('offers the lock through a toast within 10 minutes, never forcing it', () => {
    const r = reduce(INITIAL_STATE, {
      type: 'APP_STARTED',
      now: T0 + 4 * MINUTE,
      recent: { ref: ASR, plan: PLAN }
    })
    expect(r.state.prayer.kind).toBe('offered')
    expect(toastKinds(r.effects)).toEqual(['offer'])
    expect(types(r.effects)).not.toContain('showLock')
    const accepted = reduce(r.state, { type: 'OFFER_ACCEPTED', now: T0 + 5 * MINUTE })
    expect(accepted.state.prayer.kind).toBe('locked')
  })

  it('expires quietly when not accepted', () => {
    const s = reduce(INITIAL_STATE, {
      type: 'APP_STARTED',
      now: T0 + 4 * MINUTE,
      recent: { ref: ASR, plan: PLAN }
    }).state
    const r = reduce(s, tick(T0 + 15 * MINUTE))
    expect(r.state.prayer.kind).toBe('idle')
    expect(logs(r.effects)[0]).toMatchObject({ outcome: 'skipped', reason: 'late-start' })
  })

  it('does nothing after 10 minutes, without a plan, or with nothing recent', () => {
    expect(
      reduce(INITIAL_STATE, {
        type: 'APP_STARTED',
        now: T0 + 11 * MINUTE,
        recent: { ref: ASR, plan: PLAN }
      }).effects
    ).toEqual([])
    expect(
      reduce(INITIAL_STATE, {
        type: 'APP_STARTED',
        now: T0 + MINUTE,
        recent: { ref: ASR, plan: null }
      }).effects
    ).toEqual([])
    expect(reduce(INITIAL_STATE, { type: 'APP_STARTED', now: T0, recent: null }).effects).toEqual(
      []
    )
    expect(reduce(INITIAL_STATE, { type: 'OFFER_ACCEPTED', now: T0 }).effects).toEqual([])
  })

  it('keeps the offer open for a few minutes when the window already closed', () => {
    const short: LockPlan = { ...PLAN, lockMs: 5 * MINUTE }
    const r = reduce(INITIAL_STATE, {
      type: 'APP_STARTED',
      now: T0 + 8 * MINUTE,
      recent: { ref: ASR, plan: short }
    })
    if (r.state.prayer.kind !== 'offered') throw new Error()
    expect(r.state.prayer.expiresAt).toBe(T0 + 13 * MINUTE)
  })

  it('counts the window from the lock and tells the time since the adhan', () => {
    const r = reduce(INITIAL_STATE, {
      type: 'APP_STARTED',
      now: T0 + 4 * MINUTE,
      recent: { ref: ASR_IQAMA, plan: PLAN }
    })
    expect(r.state.prayer.kind).toBe('offered')
    const toast = r.effects.find((e) => e.type === 'toast')
    if (toast?.type !== 'toast' || toast.toast.kind !== 'offer') throw new Error()
    expect(toast.toast.agoMs).toBe(24 * MINUTE)
  })
})

describe('adhan notice', () => {
  const ADHAN = T0 - 20 * MINUTE
  const adhanDue = (locks: boolean): MachineEvent => ({
    type: 'ADHAN_DUE',
    now: ADHAN,
    ref: ASR_IQAMA,
    locks,
    chime: true
  })

  it('shows the notice with the lock time for 10 seconds', () => {
    const r = reduce(INITIAL_STATE, adhanDue(true))
    expect(r.state).toBe(INITIAL_STATE)
    expect(r.effects).toEqual([
      {
        type: 'showAdhan',
        adhan: {
          kind: 'adhan',
          ref: ASR_IQAMA,
          lockAt: T0,
          shownAt: ADHAN,
          until: ADHAN + 10 * SECOND,
          chime: true
        }
      }
    ])
  })

  it('has no lock time for a prayer that does not lock', () => {
    const e = reduce(INITIAL_STATE, adhanDue(false)).effects[0]
    if (e?.type !== 'showAdhan' || e.adhan.kind !== 'adhan') throw new Error()
    expect(e.adhan.lockAt).toBeNull()
  })

  it('stays away while a lock is up or the device sleeps', () => {
    expect(reduce(locked(), adhanDue(true)).effects).toEqual([])
    const asleep = reduce(INITIAL_STATE, { type: 'SUSPEND', now: ADHAN - MINUTE }).state
    expect(reduce(asleep, adhanDue(true)).effects).toEqual([])
  })

  it('a reminder before the adhan still leads to the lock at the iqama', () => {
    const r = run(
      INITIAL_STATE,
      { type: 'PRE_REMINDER_DUE', now: ADHAN - 10 * MINUTE, ref: ASR_IQAMA, minutesBefore: 10 },
      adhanDue(true),
      tick(T0 - MINUTE),
      due(T0, {}, PLAN, ASR_IQAMA)
    )
    expect(r.state.prayer.kind).toBe('locked')
  })
})

const startFocus = (
  now = T0 - 60 * MINUTE,
  minutes = 25,
  breakMinutes: number | null = 5
): MachineEvent => ({
  type: 'FOCUS_START',
  now,
  id: 's1',
  seconds: minutes * 60,
  breakMinutes
})

describe('sunrise notice', () => {
  const sunrise = (now: number): MachineEvent => ({
    type: 'SUNRISE_DUE',
    now,
    sunriseAt: now + 15 * MINUTE,
    chime: true
  })

  it('shows the short notice before sunrise, closing after 10 s', () => {
    const r = reduce(INITIAL_STATE, sunrise(T0))
    expect(r.state).toBe(INITIAL_STATE)
    expect(r.effects).toEqual([
      {
        type: 'showAdhan',
        adhan: {
          kind: 'sunrise',
          sunriseAt: T0 + 15 * MINUTE,
          shownAt: T0,
          until: T0 + 10 * SECOND,
          chime: true
        }
      }
    ])
  })

  it('never shows over a lock or while the device sleeps', () => {
    expect(reduce(locked(), sunrise(T0 + MINUTE)).effects).toEqual([])
    const asleep = reduce(INITIAL_STATE, { type: 'SUSPEND', now: T0 }).state
    expect(reduce(asleep, sunrise(T0 + MINUTE)).effects).toEqual([])
  })
})

describe('focus sessions', () => {
  const F0 = T0 - 60 * MINUTE

  it('off → focus → completes with a summary and break reminder', () => {
    const r = run(INITIAL_STATE, startFocus(), tick(F0 + 25 * MINUTE))
    expect(r.state.focus.kind).toBe('off')
    expect(types(r.effects)).toEqual(['saveFocus', 'focusSummary', 'toast', 'breakReminder'])
    const save = r.effects[0]
    if (save?.type !== 'saveFocus') throw new Error()
    expect(save.record).toMatchObject({ completed: true, focusedMs: 25 * MINUTE })
  })

  it('starts a length set to the second, never under a minute', () => {
    const planned = (seconds: number): number => {
      const f = reduce(INITIAL_STATE, { ...startFocus(), seconds } as MachineEvent).state.focus
      if (f.kind !== 'focus') throw new Error()
      return f.session.plannedMs
    }
    expect(planned(25 * 60 + 30)).toBe(25 * MINUTE + 30 * SECOND)
    expect(planned(10)).toBe(MINUTE)
    expect(planned(Number.NaN)).toBe(MINUTE)
  })

  it('− and + move the end of a running or paused session, keeping a minute', () => {
    const running = reduce(INITIAL_STATE, startFocus()).state
    const longer = reduce(running, { type: 'FOCUS_ADJUST', now: F0, deltaMs: 5 * MINUTE }).state
    if (longer.focus.kind !== 'focus') throw new Error()
    expect(longer.focus.session.endsAt).toBe(F0 + 30 * MINUTE)
    expect(longer.focus.session.plannedMs).toBe(30 * MINUTE)
    // Never less than a minute left.
    const nearEnd = reduce(longer, {
      type: 'FOCUS_ADJUST',
      now: F0 + 27 * MINUTE,
      deltaMs: -5 * MINUTE
    }).state
    if (nearEnd.focus.kind !== 'focus') throw new Error()
    expect(nearEnd.focus.session.endsAt).toBe(F0 + 28 * MINUTE)
    // Paused for prayer: the remaining time moves instead.
    const paused = reduce(running, due(F0 + 10 * MINUTE)).state
    const more = reduce(paused, {
      type: 'FOCUS_ADJUST',
      now: F0 + 11 * MINUTE,
      deltaMs: 5 * MINUTE
    })
    if (more.state.focus.kind !== 'focusPaused') throw new Error()
    expect(more.state.focus.remainingMs).toBe(20 * MINUTE)
    // Nothing to adjust, or nothing asked.
    expect(reduce(INITIAL_STATE, { type: 'FOCUS_ADJUST', now: F0, deltaMs: MINUTE }).state).toBe(
      INITIAL_STATE
    )
    expect(reduce(running, { type: 'FOCUS_ADJUST', now: F0, deltaMs: 0 }).state).toBe(running)
  })

  it('reports how far a session has run for the taskbar button', () => {
    const running = reduce(INITIAL_STATE, startFocus()).state
    expect(focusProgress(running.focus, F0 + 5 * MINUTE)).toEqual({ fraction: 0.2, paused: false })
    expect(focusProgress(running.focus, F0 + 60 * MINUTE)).toEqual({ fraction: 1, paused: false })
    const paused = reduce(running, due(F0 + 10 * MINUTE)).state
    expect(focusProgress(paused.focus, F0 + 12 * MINUTE)).toEqual({ fraction: 0.4, paused: true })
    expect(focusProgress(INITIAL_STATE.focus, F0)).toBeNull()
  })

  it('ignores a second start and supports stopping early', () => {
    const s = reduce(INITIAL_STATE, startFocus()).state
    expect(reduce(s, startFocus(F0 + MINUTE)).state).toBe(s)
    const r = reduce(s, { type: 'FOCUS_STOP', now: F0 + 10 * MINUTE })
    expect(r.state.focus.kind).toBe('off')
    const save = r.effects[0]
    if (save?.type !== 'saveFocus') throw new Error()
    expect(save.record).toMatchObject({ completed: false, focusedMs: 10 * MINUTE })
    expect(reduce(INITIAL_STATE, { type: 'FOCUS_STOP', now: F0 }).effects).toEqual([])
  })

  it('focus → guard on a distraction → back to work minimises the window', () => {
    const s = run(INITIAL_STATE, startFocus(), {
      type: 'DISTRACTION',
      now: F0 + MINUTE,
      target: TARGET
    }).state
    expect(s.focus.kind).toBe('guard')
    const r = reduce(s, { type: 'GUARD_BACK', now: F0 + MINUTE + SECOND })
    expect(r.state.focus.kind).toBe('focus')
    expect(types(r.effects)).toEqual(['minimize', 'hideGuard', 'logDistraction'])
    expect(r.effects[0]).toEqual({ type: 'minimize', hwnd: 42 })
    // Grace period: the same distraction right away does not re-open the guard.
    expect(
      reduce(r.state, { type: 'DISTRACTION', now: F0 + MINUTE + 2 * SECOND, target: TARGET }).state
        .focus.kind
    ).toBe('focus')
    expect(
      reduce(r.state, { type: 'DISTRACTION', now: F0 + 2 * MINUTE, target: TARGET }).state.focus
        .kind
    ).toBe('guard')
    if (r.state.focus.kind !== 'focus') throw new Error()
    expect(r.state.focus.session.blocked).toBe(1)
  })

  it('guard snooze allows 5 minutes and is recorded as a distraction', () => {
    const s = run(INITIAL_STATE, startFocus(), {
      type: 'DISTRACTION',
      now: F0 + MINUTE,
      target: TARGET
    }).state
    const r = reduce(s, { type: 'GUARD_SNOOZE', now: F0 + MINUTE })
    const log = r.effects.find((e) => e.type === 'logDistraction')
    expect(log).toMatchObject({ action: 'snooze', label: 'YouTube' })
    expect(
      reduce(r.state, { type: 'DISTRACTION', now: F0 + 5 * MINUTE, target: TARGET }).state.focus
        .kind
    ).toBe('focus')
    expect(
      reduce(r.state, { type: 'DISTRACTION', now: F0 + 6 * MINUTE + SECOND, target: TARGET }).state
        .focus.kind
    ).toBe('guard')
    if (r.state.focus.kind !== 'focus') throw new Error()
    expect(r.state.focus.session.snoozed).toBe(1)
  })

  it('guard closes when the distraction leaves the foreground', () => {
    const s = run(INITIAL_STATE, startFocus(), {
      type: 'DISTRACTION',
      now: F0 + MINUTE,
      target: TARGET
    }).state
    const r = reduce(s, { type: 'DISTRACTION_CLEARED', now: F0 + 2 * MINUTE })
    expect(r.state.focus.kind).toBe('focus')
    expect(types(r.effects)).toEqual(['hideGuard'])
    expect(reduce(INITIAL_STATE, { type: 'DISTRACTION_CLEARED', now: F0 }).effects).toEqual([])
  })

  it('updates the guard when a different distraction appears', () => {
    const s = run(INITIAL_STATE, startFocus(), {
      type: 'DISTRACTION',
      now: F0 + MINUTE,
      target: TARGET
    }).state
    const r = reduce(s, {
      type: 'DISTRACTION',
      now: F0 + MINUTE,
      target: { ...TARGET, label: 'Netflix' }
    })
    expect(types(r.effects)).toEqual(['showGuard'])
    expect(
      reduce(r.state, {
        type: 'DISTRACTION',
        now: F0 + MINUTE,
        target: { ...TARGET, label: 'Netflix' }
      }).effects
    ).toEqual([])
  })

  it('pauses for a prayer lock and resumes after unlock with a toast', () => {
    const s = run(INITIAL_STATE, startFocus(T0 - 10 * MINUTE), {
      type: 'DISTRACTION',
      now: T0 - MINUTE,
      target: TARGET
    }).state
    const r = reduce(s, due())
    expect(r.state.focus.kind).toBe('focusPaused')
    expect(types(r.effects)).toEqual(['hideGuard', 'showLock'])
    if (r.state.focus.kind !== 'focusPaused') throw new Error()
    expect(r.state.focus.remainingMs).toBe(15 * MINUTE)
    // The session does not end while paused.
    expect(reduce(r.state, tick(T0 + 14 * MINUTE)).state.focus.kind).toBe('focusPaused')
    const after = reduce(r.state, { type: 'PRAYED', now: T0 + 6 * MINUTE })
    expect(after.state.focus.kind).toBe('focus')
    expect(toastKinds(after.effects)).toEqual(['focusResumed'])
    expect(focusRemaining(after.state.focus, T0 + 6 * MINUTE)).toBe(15 * MINUTE)
    if (after.state.focus.kind !== 'focus') throw new Error()
    expect(after.state.focus.session.focusedMs).toBe(10 * MINUTE)
  })

  it('a session started during a lock starts paused', () => {
    const r = reduce(locked(), startFocus(T0 + MINUTE))
    expect(r.state.focus.kind).toBe('focusPaused')
  })

  it('sleep pauses focus; resume continues it without a toast', () => {
    const r = run(
      INITIAL_STATE,
      startFocus(F0),
      { type: 'SUSPEND', now: F0 + 5 * MINUTE },
      { type: 'RESUME', now: F0 + 65 * MINUTE, missed: [] }
    )
    expect(r.state.focus.kind).toBe('focus')
    expect(focusRemaining(r.state.focus, F0 + 65 * MINUTE)).toBe(20 * MINUTE)
    expect(toastKinds(r.effects)).toEqual([])
  })

  it('sleep during a lock with focus: stays paused for the prayer after resume', () => {
    const r = run(
      INITIAL_STATE,
      startFocus(T0 - 5 * MINUTE),
      due(),
      { type: 'SUSPEND', now: T0 + MINUTE },
      { type: 'RESUME', now: T0 + 2 * MINUTE, missed: [] }
    )
    expect(r.state.focus.kind).toBe('focusPaused')
    if (r.state.focus.kind !== 'focusPaused') throw new Error()
    expect(r.state.focus.reason).toBe('prayer')
  })

  it('focus started while asleep is paused for sleep', () => {
    const s = reduce(INITIAL_STATE, { type: 'SUSPEND', now: F0 }).state
    const r = reduce(s, startFocus(F0))
    if (r.state.focus.kind !== 'focusPaused') throw new Error()
    expect(r.state.focus.reason).toBe('sleep')
  })

  it('stopping from guard or paused saves the session', () => {
    const g = run(INITIAL_STATE, startFocus(), {
      type: 'DISTRACTION',
      now: F0 + MINUTE,
      target: TARGET
    }).state
    expect(types(reduce(g, { type: 'FOCUS_STOP', now: F0 + 2 * MINUTE }).effects)).toEqual([
      'hideGuard',
      'saveFocus'
    ])
    const p = run(INITIAL_STATE, startFocus(T0 - 5 * MINUTE), due()).state
    const r = reduce(p, { type: 'FOCUS_STOP', now: T0 + MINUTE })
    const save = r.effects[0]
    if (save?.type !== 'saveFocus') throw new Error()
    expect(save.record.focusedMs).toBe(5 * MINUTE)
  })

  it('completes from guard and hides it', () => {
    const s = run(INITIAL_STATE, startFocus(), {
      type: 'DISTRACTION',
      now: F0 + MINUTE,
      target: TARGET
    }).state
    expect(types(reduce(s, tick(F0 + 25 * MINUTE)).effects)[0]).toBe('hideGuard')
  })

  it('no break reminder when disabled', () => {
    const r = run(INITIAL_STATE, startFocus(F0, 25, null), tick(F0 + 25 * MINUTE))
    expect(types(r.effects)).not.toContain('breakReminder')
  })

  it('guard actions are ignored outside the guard', () => {
    expect(reduce(INITIAL_STATE, { type: 'GUARD_BACK', now: T0 }).effects).toEqual([])
    expect(reduce(INITIAL_STATE, { type: 'GUARD_SNOOZE', now: T0 }).effects).toEqual([])
    expect(reduce(INITIAL_STATE, { type: 'DISTRACTION', now: T0, target: TARGET }).effects).toEqual(
      []
    )
  })

  it('a superseded lock hands focus back when the new prayer does not lock', () => {
    const s = run(INITIAL_STATE, startFocus(T0 - 5 * MINUTE), due()).state
    const r = reduce(s, due(MAGHRIB.at, {}, null, MAGHRIB))
    expect(r.state.focus.kind).toBe('focus')
  })
})

describe('helpers', () => {
  it('describes states for the debug readout', () => {
    expect(describeState(INITIAL_STATE)).toBe('idle')
    const s = run(INITIAL_STATE, startFocus(T0 - 5 * MINUTE), due(), {
      type: 'SUSPEND',
      now: T0
    }).state
    expect(describeState(s)).toBe('locked · focusPaused · asleep')
    expect(focusRemaining({ kind: 'off' }, T0)).toBeNull()
  })

  it('supersede covers every in-progress prayer state', () => {
    const snoozed = reduce(locked(), { type: 'SNOOZE', now: T0 + MINUTE, minutes: 5 }).state
    expect(logs(reduce(snoozed, due(MAGHRIB.at, {}, PLAN, MAGHRIB)).effects)[0]).toMatchObject({
      reason: 'superseded'
    })
    const meeting = reduce(INITIAL_STATE, due(T0, { inMeeting: true })).state
    expect(logs(reduce(meeting, due(MAGHRIB.at, {}, PLAN, MAGHRIB)).effects)[0]).toMatchObject({
      reason: 'meeting'
    })
    const offered = reduce(INITIAL_STATE, {
      type: 'APP_STARTED',
      now: T0 + MINUTE,
      recent: { ref: ASR, plan: PLAN }
    }).state
    expect(logs(reduce(offered, due(MAGHRIB.at, {}, PLAN, MAGHRIB)).effects)[0]).toMatchObject({
      reason: 'late-start'
    })
  })
})
