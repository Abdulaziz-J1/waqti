import { z } from 'zod'
import type { Channel, EventName } from './ipc-channels'
import type { AdhanView, MachineState, LockView, GuardView, PrayerLogEntry } from './machine/types'
import type { DaySchedule, PrayerId } from './prayer/schedule'
import type { Settings } from './settings/schema'
import type { Category, Rule } from './tracking/categorize'
import type {
  ActivityTotal,
  CategoryTotal,
  DayStack,
  HourStack,
  FocusSessionRecord,
  FocusStats,
  RangeKind,
  TimelineSegment
} from './tracking/aggregate'
import type { SkyPalette, PeriodId } from './sky'

// ---------------------------------------------------------------------------
// Shared data shapes
// ---------------------------------------------------------------------------

export type Page = 'today' | 'focus' | 'reports' | 'prayer' | 'settings'

export interface ScheduleBundle {
  yesterday: DaySchedule
  today: DaySchedule
  tomorrow: DaySchedule
}

export interface TrackingStatus {
  paused: boolean
  /** Counting right now (not idle, locked, paused or excluded). */
  active: boolean
  reason: 'active' | 'paused' | 'idle' | 'locked' | 'overlay' | 'excluded' | 'none'
  current: { appName: string; site: string | null } | null
}

export interface DebugState {
  offsetMs: number
  idleOverride: boolean
  meetingOverride: boolean
}

export interface AppSnapshot {
  version: string
  settings: Settings
  machine: MachineState
  /** Scheduler clock offset (debug). Renderer "now" = Date.now() + clockOffsetMs. */
  clockOffsetMs: number
  schedule: ScheduleBundle | null
  scheduleError: string | null
  tracking: TrackingStatus
  debug: DebugState
  /** Notice to show once in the app (database restored, etc.). */
  notice: 'dbRestored' | 'dbReset' | null
}

export interface TodayData {
  day: string
  totalMs: number
  totals: CategoryTotal[]
  top: Array<ActivityTotal & { icon: string | null }>
  timeline: TimelineSegment[]
  categories: Category[]
  focus: FocusStats
  sessions: FocusSessionRecord[]
}

export interface ReportData {
  kind: RangeKind
  from: string
  to: string
  days: string[]
  totalMs: number
  prevTotalMs: number
  totals: CategoryTotal[]
  stacks: DayStack[]
  /** Per-hour stacks for the Day tab (null for week/month). */
  hourly: HourStack[] | null
  activities: Array<ActivityTotal & { icon: string | null }>
  categories: Category[]
  focus: FocusStats
  prevFocus: FocusStats
  queryMs: number
}

export interface RunningApp {
  process: string
  appName: string
  exePath: string
  icon: string | null
}

export type OverlayKind = 'lock' | 'guard' | 'adhan'

export interface OverlayState {
  kind: OverlayKind | 'none'
  lock: LockView | null
  guard: GuardView | null
  adhan: AdhanView | null
  /** Sky colours of the prayer period, for the lock background. */
  sky: SkyPalette & { period: PeriodId }
  clockOffsetMs: number
  digits: Settings['general']['digits']
  clock: Settings['general']['clock']
  reduceMotion: boolean
  /** Only the primary display plays the chime. */
  primary: boolean
}

export interface DebugReadout {
  state: string
  foreground: { appName: string; process: string; title: string; site: string | null } | null
  provider: string
  cpuPercent: number
  memoryMB: number
  inMeeting: boolean
  idleSeconds: number
  startupMs: number | null
  intervals: number
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  node: string
  userDataPath: string
  logPath: string
  licenses: string
}

export interface CategoriesData {
  categories: Category[]
  rules: Rule[]
}

export interface DataCounts {
  intervals: number
  sessions: number
  prayers: number
}

// ---------------------------------------------------------------------------
// Request schemas (validated in main)
// ---------------------------------------------------------------------------

const prayerId = z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])
const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const locationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('city'), cityId: z.string().min(1).max(40) }),
  z.object({
    kind: z.literal('custom'),
    lat: z.number().min(-65).max(65),
    lng: z.number().min(-180).max(180),
    label: z.string().max(40).optional()
  })
])

export const requestSchemas = {
  'app:snapshot': z.undefined(),
  'app:info': z.undefined(),
  'app:ready': z.object({ at: z.number() }),
  'app:openFolder': z.object({ which: z.enum(['data', 'logs']) }),
  'app:dismissNotice': z.undefined(),
  'settings:update': z.record(z.string(), z.unknown()),
  'onboarding:complete': z.object({ launchAtStartup: z.boolean() }),
  'prayer:preview': z.object({ location: locationSchema }),
  'prayer:history': z.object({ from: dayKeySchema, to: dayKeySchema }),
  'today:get': z.undefined(),
  'reports:get': z.object({ kind: z.enum(['day', 'week', 'month']), anchor: dayKeySchema }),
  'focus:start': z.object({ minutes: z.number().int().min(1).max(240) }),
  'focus:stop': z.undefined(),
  'focus:sessions': z.object({ from: dayKeySchema, to: dayKeySchema }),
  'lock:action': z.object({ action: z.enum(['prayed', 'snooze', 'emergency']) }),
  'guard:action': z.object({ action: z.enum(['back', 'snooze']) }),
  'adhan:close': z.undefined(),
  'overlay:state': z.undefined(),
  'tracking:setPaused': z.object({ paused: z.boolean() }),
  'categories:get': z.undefined(),
  'categories:create': z.object({
    name: z.string().trim().min(1).max(30),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  }),
  'categories:update': z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(30).optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional()
  }),
  'categories:delete': z.object({ id: z.string().min(1) }),
  'rules:set': z.object({
    kind: z.enum(['app', 'site', 'path']),
    pattern: z.string().trim().min(1).max(300),
    categoryId: z.string().min(1)
  }),
  'rules:delete': z.object({ kind: z.enum(['app', 'site', 'path']), pattern: z.string().min(1) }),
  'apps:running': z.undefined(),
  'apps:recent': z.undefined(),
  'data:export': z.object({ format: z.enum(['json', 'csv']) }),
  'data:import': z.undefined(),
  'data:deleteAll': z.object({ confirm: z.literal('DELETE') }),
  'data:counts': z.undefined(),
  'debug:simulatePrayer': z.object({ prayer: prayerId }),
  'debug:simulatePre': z.object({ prayer: prayerId }),
  'debug:simulateAdhan': z.object({ prayer: prayerId }),
  'debug:setIdle': z.object({ on: z.boolean() }),
  'debug:setMeeting': z.object({ on: z.boolean() }),
  'debug:setOffset': z.object({ minutes: z.number().int().min(-2880).max(2880) }),
  'debug:jumpBefore': z.object({ prayer: prayerId, minutes: z.number().int().min(-60).max(60) }),
  'debug:seed': z.object({ range: z.enum(['day', 'week', 'year']) }),
  'debug:clearDemo': z.undefined(),
  'debug:readout': z.undefined(),
  'debug:startupOffer': z.undefined(),
  'debug:simulateDistraction': z.object({ label: z.string().min(1).max(60) })
} as const satisfies Record<Channel, z.ZodType>
export type RequestOf<C extends Channel> = z.infer<(typeof requestSchemas)[C]>

export interface ResponseMap {
  'app:snapshot': AppSnapshot
  'app:info': AppInfo
  'app:ready': null
  'app:openFolder': null
  'app:dismissNotice': null
  'settings:update': Settings
  'onboarding:complete': null
  'prayer:preview': { schedule: DaySchedule | null; error: string | null }
  'prayer:history': PrayerLogEntry[]
  'today:get': TodayData
  'reports:get': ReportData
  'focus:start': null
  'focus:stop': null
  'focus:sessions': FocusSessionRecord[]
  'lock:action': null
  'guard:action': null
  'adhan:close': null
  'overlay:state': OverlayState
  'tracking:setPaused': null
  'categories:get': CategoriesData
  'categories:create': Category
  'categories:update': null
  'categories:delete': null
  'rules:set': null
  'rules:delete': null
  'apps:running': RunningApp[]
  'apps:recent': RunningApp[]
  'data:export': { path: string | null }
  'data:import': { imported: DataCounts | null; error: string | null }
  'data:deleteAll': null
  'data:counts': DataCounts
  'debug:simulatePrayer': null
  'debug:simulatePre': null
  'debug:simulateAdhan': null
  'debug:setIdle': null
  'debug:setMeeting': null
  'debug:setOffset': null
  'debug:jumpBefore': null
  'debug:seed': { inserted: number; ms: number }
  'debug:clearDemo': null
  'debug:readout': DebugReadout
  'debug:startupOffer': null
  'debug:simulateDistraction': null
}

/** Events pushed from main to renderers. */
export interface EventMap extends Record<EventName, unknown> {
  'app:snapshot': AppSnapshot
  'nav:go': { page: Page }
  'focus:summary': FocusSessionRecord
  'data:changed': null
  'window:visibility': { visible: boolean }
  'overlay:state': OverlayState
  'debug:toggle': null
}

/** The API the preload exposes as `window.waqti`. */
export interface WaqtiApi {
  invoke<C extends Channel>(
    channel: C,
    ...args: RequestOf<C> extends undefined ? [] : [RequestOf<C>]
  ): Promise<ResponseMap[C]>
  on<E extends EventName>(event: E, cb: (payload: EventMap[E]) => void): () => void
}

export type PrayerIdRequest = PrayerId
export type { Channel, EventName }
