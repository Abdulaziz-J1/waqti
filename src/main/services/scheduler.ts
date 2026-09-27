import type { PlannedPrayer } from '../../shared/machine/types'
import type { ScheduleBundle } from '../../shared/ipc'
import { type DueEvent, dueBetween, prayersBetween, recentPrayer } from '../../shared/prayer/due'
import { type DaySchedule, ScheduleError, schedulesAround } from '../../shared/prayer/schedule'
import { adjustmentsOf, coordsOf } from '../../shared/settings/plan'
import type { Settings } from '../../shared/settings/schema'
import { MINUTE, dayKey } from '../../shared/time'
import { log } from './logger'

/** A tick gap longer than this is treated like waking from sleep. */
export const MAX_TICK_GAP_MS = 5 * MINUTE

export type TickOutcome =
  { kind: 'due'; events: DueEvent[] } | { kind: 'gap'; missed: PlannedPrayer[] }

/**
 * Keeps yesterday/today/tomorrow schedules and turns the passage of time into
 * due events. Recomputes at midnight, on resume, on clock or timezone change
 * and when the location or adjustments change.
 */
export class Scheduler {
  private schedules: DaySchedule[] | null = null
  private builtFor: string | null = null
  private lastTick: number
  error: string | null = null

  constructor(
    private readonly settings: () => Settings,
    now: number
  ) {
    this.lastTick = now
    this.recompute(now)
  }

  recompute(now: number): void {
    const s = this.settings()
    try {
      this.schedules = schedulesAround(now, coordsOf(s), adjustmentsOf(s))
      this.error = null
    } catch (err) {
      this.schedules = null
      this.error = err instanceof ScheduleError ? err.message : String(err)
      log.error('schedule computation failed', err)
    }
    this.builtFor = dayKey(now)
  }

  bundle(): ScheduleBundle | null {
    const s = this.schedules
    if (!s || s.length !== 3) return null
    return { yesterday: s[0]!, today: s[1]!, tomorrow: s[2]! }
  }

  list(): DaySchedule[] {
    return this.schedules ?? []
  }

  /** Advances the scheduler to `now`. Returns due events, or missed prayers after a long gap. */
  tick(now: number): TickOutcome {
    if (dayKey(now) !== this.builtFor) this.recompute(now)
    const from = this.lastTick
    this.lastTick = now
    if (now - from > MAX_TICK_GAP_MS) {
      return { kind: 'gap', missed: prayersBetween(this.list(), this.settings(), from, now) }
    }
    return { kind: 'due', events: dueBetween(this.list(), this.settings(), from, now) }
  }

  /** After sleep: prayers that passed while suspended. */
  resume(suspendedAt: number, now: number): PlannedPrayer[] {
    this.recompute(now)
    const missed = prayersBetween(this.list(), this.settings(), suspendedAt, now)
    this.lastTick = now
    return missed
  }

  /** Clock or timezone changed, or a debug time jump: recompute and do not replay skipped events. */
  reset(now: number): void {
    this.recompute(now)
    this.lastTick = now
  }

  recent(now: number, windowMs: number): PlannedPrayer | null {
    return recentPrayer(this.list(), this.settings(), now, windowMs)
  }
}
