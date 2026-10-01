import type { PrayerId } from '../prayer/schedule'
import type { DayKey } from '../time'
import type { Bounds } from '../tracking/apps'
import type { FocusSessionRecord } from '../tracking/aggregate'

/** A specific prayer on a specific day. */
export interface PrayerRef {
  prayer: PrayerId
  day: DayKey
  /**
   * When the prayer is due to lock (epoch ms): the adhan plus the configured
   * delay, i.e. the iqama. Equals `adhanAt` when the prayer does not lock.
   */
  at: number
  /** The adhan, the prayer's scheduled time (epoch ms). */
  adhanAt: number
  /** Dhuhr on Friday. */
  isJumuah: boolean
}

/** How a prayer locks, resolved from settings by the scheduler. */
export interface LockPlan {
  lockMs: number
  minUnlockMs: number
  chime: boolean
  /** The once-per-prayer snooze is offered. */
  snooze: boolean
}

export type PrayerOutcome = 'prayed' | 'ended' | 'emergency' | 'skipped'
export type PrayerReason =
  | 'duration'
  | 'safety'
  | 'away'
  | 'meeting'
  | 'asleep'
  | 'late-start'
  | 'interrupted'
  | 'superseded'

export interface PrayerLogEntry {
  prayer: PrayerId
  day: DayKey
  scheduledAt: number
  outcome: PrayerOutcome
  reason: PrayerReason | null
  snoozed: boolean
  at: number
}

export type PrayerState =
  | { kind: 'idle' }
  | { kind: 'reminding'; ref: PrayerRef; remindedAt: number }
  | {
      kind: 'locked'
      ref: PrayerRef
      plan: LockPlan
      startedAt: number
      until: number
      minUnlockAt: number
      hardUntil: number
      snoozeUsed: boolean
      /**
       * When the countdown started: once the lock is on screen (LOCK_SHOWN).
       * Until then (null) the times stay whole and still, so the lock never
       * appears already short.
       */
      runningSince: number | null
    }
  | {
      kind: 'snoozed'
      ref: PrayerRef
      plan: LockPlan
      snoozedAt: number
      resumeAt: number
      /** Lock time left when the snooze started; restored on return. */
      remainingMs: number
      minRemainingMs: number
    }
  | {
      kind: 'meetingDeferred'
      ref: PrayerRef
      plan: LockPlan
      since: number
      nextCheckAt: number
      giveUpAt: number
    }
  | { kind: 'offered'; ref: PrayerRef; plan: LockPlan; expiresAt: number }

export interface DistractionTarget {
  kind: 'app' | 'site' | 'keyword'
  label: string
  process: string
  site: string | null
  hwnd: number | null
  bounds: Bounds | null
}

export interface FocusSession {
  id: string
  startedAt: number
  plannedMs: number
  endsAt: number
  /** Focus time banked before the current running segment. */
  focusedMs: number
  /** Start of the current running segment. */
  segmentStart: number
  blocked: number
  snoozed: number
  snoozeUntil: number | null
  graceUntil: number | null
  breakMs: number | null
}

export type FocusState =
  | { kind: 'off' }
  | { kind: 'focus'; session: FocusSession }
  | { kind: 'guard'; session: FocusSession; target: DistractionTarget }
  | {
      kind: 'focusPaused'
      session: FocusSession
      remainingMs: number
      pausedAt: number
      reason: 'prayer' | 'sleep'
    }

export interface MachineState {
  prayer: PrayerState
  focus: FocusState
  asleep: boolean
}

/** Environment readings attached to ticks and prayer events. */
export interface TickContext {
  idleSeconds: number
  screenLocked: boolean
  inMeeting: boolean
  /**
   * Some app reports media playing (a video, audio). Someone watching without
   * touching the keyboard is still there; only looked up when idle.
   */
  mediaPlaying: boolean
}

export interface PlannedPrayer {
  ref: PrayerRef
  /** null when this prayer does not lock (reminder only). */
  plan: LockPlan | null
}

export type MachineEvent =
  | { type: 'TICK'; now: number; ctx: TickContext }
  | { type: 'PRE_REMINDER_DUE'; now: number; ref: PrayerRef; minutesBefore: number }
  /** The adhan time came; `locks` says whether a lock follows at `ref.at`. */
  | { type: 'ADHAN_DUE'; now: number; ref: PrayerRef; locks: boolean; chime: boolean }
  /** Shortly before sunrise (or at it): the last of Fajr's time. */
  | { type: 'SUNRISE_DUE'; now: number; sunriseAt: number; chime: boolean }
  | { type: 'PRAYER_DUE'; now: number; ref: PrayerRef; plan: LockPlan | null; ctx: TickContext }
  | { type: 'PRAYED'; now: number }
  /** The lock is fully on screen: its countdown starts now. */
  | { type: 'LOCK_SHOWN'; now: number }
  /** Minutes chosen on the lock screen (clamped to the configured range). */
  | { type: 'SNOOZE'; now: number; minutes: number }
  | { type: 'EMERGENCY_EXIT'; now: number }
  /** The independent safety timer fired: end the lock whatever happened. */
  | { type: 'FORCE_UNLOCK'; now: number }
  | { type: 'SUSPEND'; now: number }
  | { type: 'RESUME'; now: number; missed: PlannedPrayer[] }
  | { type: 'APP_STARTED'; now: number; recent: PlannedPrayer | null }
  | { type: 'OFFER_ACCEPTED'; now: number }
  | { type: 'FOCUS_START'; now: number; id: string; seconds: number; breakMinutes: number | null }
  /** Lengthen or shorten the running session (− / + beside the dial). */
  | { type: 'FOCUS_ADJUST'; now: number; deltaMs: number }
  | { type: 'FOCUS_STOP'; now: number }
  | { type: 'DISTRACTION'; now: number; target: DistractionTarget }
  | { type: 'DISTRACTION_CLEARED'; now: number }
  | { type: 'GUARD_BACK'; now: number }
  | { type: 'GUARD_SNOOZE'; now: number }

export type ToastSpec =
  | { kind: 'preReminder'; ref: PrayerRef; minutesBefore: number }
  | { kind: 'meeting'; ref: PrayerRef }
  | { kind: 'meetingFinal'; ref: PrayerRef }
  | { kind: 'resumeReminder'; ref: PrayerRef; agoMs: number }
  | { kind: 'offer'; ref: PrayerRef; agoMs: number }
  | { kind: 'focusResumed'; remainingMs: number }
  | { kind: 'focusDone'; focusedMs: number }

/** What the lock overlay needs to render. */
export interface LockView {
  ref: PrayerRef
  startedAt: number
  until: number
  minUnlockAt: number
  /** Null until the lock is on screen: the times shown are the full lengths. */
  runningSince: number | null
  hardUntil: number
  /** The snooze is turned on for this lock (it may already be used). */
  snoozeEnabled: boolean
  snoozeAvailable: boolean
  chime: boolean
}

export interface GuardView {
  target: DistractionTarget
  sessionEndsAt: number
}

/** What the short adhan notice shows. */
interface NoticeTiming {
  shownAt: number
  /** It closes itself at this time unless the user closes it first. */
  until: number
  chime: boolean
}

/** The short notice: a prayer's adhan, or the sunrise (the end of Fajr's time). */
export type AdhanView =
  | (NoticeTiming & {
      kind: 'adhan'
      ref: PrayerRef
      /** When the lock follows (the iqama), or null when this prayer does not lock. */
      lockAt: number | null
    })
  | (NoticeTiming & { kind: 'sunrise'; sunriseAt: number })

export type Effect =
  | { type: 'toast'; toast: ToastSpec }
  | { type: 'showLock'; lock: LockView }
  | { type: 'hideLock' }
  | { type: 'showAdhan'; adhan: AdhanView }
  | { type: 'showGuard'; guard: GuardView }
  | { type: 'hideGuard' }
  | { type: 'minimize'; hwnd: number | null }
  | { type: 'logPrayer'; entry: PrayerLogEntry }
  | { type: 'saveFocus'; record: FocusSessionRecord }
  | { type: 'focusSummary'; record: FocusSessionRecord }
  | {
      type: 'logDistraction'
      sessionId: string
      at: number
      label: string
      process: string
      site: string | null
      action: 'back' | 'snooze'
    }
  | { type: 'breakReminder'; at: number }

export interface MachineConfig {
  skipWhenAway: boolean
  deferInMeetings: boolean
  awayThresholdSec: number
  meetingRecheckMs: number
  meetingMaxMs: number
  snoozeMinMs: number
  snoozeMaxMs: number
  hardMaxMs: number
  resumeReminderMs: number
  startupOfferMs: number
  guardSnoozeMs: number
  guardGraceMs: number
  lateLockMinMs: number
  adhanNoticeMs: number
  /** A lock whose window never reports itself shown starts counting after this. */
  lockShowGraceMs: number
}

export interface Transition {
  state: MachineState
  effects: Effect[]
}
