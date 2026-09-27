import type { TrackingStatus } from '../../shared/ipc'
import { type DayKey, dayEndMs, dayKey } from '../../shared/time'
import type { ForegroundInfo } from '../../shared/tracking/apps'
import {
  DEFAULT_MERGE,
  type DayInterval,
  type Interval,
  type TrackSample,
  mergeStep,
  splitByDay,
  trimInterval
} from '../../shared/tracking/merge'
import { deriveSite } from '../../shared/tracking/sites'
import type { Repo } from './db/repo'
import { log } from './logger'

export interface TrackContext {
  now: number
  fg: ForegroundInfo | null
  idleSeconds: number
  idleThresholdSec: number
  screenLocked: boolean
  overlayVisible: boolean
  paused: boolean
  excluded: ReadonlySet<string>
  storeTitles: boolean
}

export const FLUSH_INTERVAL_MS = 30_000

/**
 * Turns 1 Hz foreground readings into intervals. Closed intervals are queued
 * and written in one transaction every 30 s (and on suspend / quit); the open
 * interval is inserted once and then updated in place.
 */
export class Tracker {
  private open: Interval | null = null
  private openId: number | null = null
  private pending: DayInterval[] = []
  private updates: Array<{ id: number; end: number; title: string | null }> = []
  private lastFlush = 0
  status: TrackingStatus = { paused: false, active: false, reason: 'none', current: null }

  constructor(private readonly repo: Repo) {}

  private closeOpen(iv: Interval): void {
    const parts = splitByDay(iv)
    if (this.openId !== null) {
      const first = parts.shift()
      if (first) this.updates.push({ id: this.openId, end: first.end, title: first.title })
      this.openId = null
    }
    this.pending.push(...parts)
  }

  private apply(sample: TrackSample | null): void {
    const prev = this.open
    const r = mergeStep(prev, sample, DEFAULT_MERGE)
    for (const c of r.closed) this.closeOpen(c)
    const continued =
      prev !== null &&
      r.open !== null &&
      r.open.start === prev.start &&
      r.open.process === prev.process &&
      r.open.site === prev.site
    // A new interval never reuses the previous row.
    if (!continued) this.openId = null
    this.open = r.open
  }

  tick(c: TrackContext): TrackingStatus {
    let reason: TrackingStatus['reason'] = 'active'
    let sample: TrackSample | null = null

    if (c.paused) reason = 'paused'
    else if (c.screenLocked) reason = 'locked'
    else if (c.idleSeconds >= c.idleThresholdSec) reason = 'idle'
    else if (c.overlayVisible) reason = 'overlay'
    else if (!c.fg) reason = 'none'
    else if (c.excluded.has(c.fg.process)) reason = 'excluded'
    else {
      const site = deriveSite(c.fg.process, c.fg.title)
      sample = {
        at: c.now,
        process: c.fg.process,
        appName: c.fg.appName,
        exePath: c.fg.exePath,
        site,
        title: c.storeTitles ? c.fg.title || null : null
      }
    }

    if (reason === 'idle' && this.open) {
      // Idle time is not usage: cut the open interval back to the last input.
      this.open = trimInterval(this.open, c.now - c.idleSeconds * 1000)
    }
    this.apply(sample)

    const prev = this.status
    this.status = {
      paused: c.paused,
      active: sample !== null,
      reason,
      current: sample ? { appName: sample.appName, site: sample.site } : null
    }

    if (c.now - this.lastFlush >= FLUSH_INTERVAL_MS) this.flush(c.now)
    return prev
  }

  /** Writes queued intervals and the open one. Safe to call any time. */
  flush(now: number): void {
    this.lastFlush = now
    try {
      // An open interval that crossed midnight is closed at midnight and continues as a new row.
      if (this.open) {
        const startDay: DayKey = dayKey(this.open.start)
        const boundary = dayEndMs(startDay)
        if (this.open.end > boundary) {
          const before = { ...this.open, end: boundary }
          this.closeOpen(before)
          this.open = { ...this.open, start: boundary }
        }
      }
      const pending = this.pending
      const updates = this.updates
      this.pending = []
      this.updates = []
      const open = this.open
      this.repo.transaction(() => {
        for (const u of updates) this.repo.updateInterval(u.id, u.end, u.title)
        this.repo.insertIntervals(pending)
        if (open && open.end - open.start >= 1000) {
          if (this.openId === null) {
            this.openId = this.repo.insertInterval({ ...open, day: dayKey(open.start) })
          } else {
            this.repo.updateInterval(this.openId, open.end, open.title)
          }
        }
      })
    } catch (err) {
      log.error('tracker flush failed', err)
    }
  }

  /** Forgets in-memory state after all data was deleted. */
  reset(): void {
    this.open = null
    this.openId = null
    this.pending = []
    this.updates = []
  }

  /** Closes the open interval and writes everything (suspend, quit, pause). */
  stop(now: number): void {
    this.apply(null)
    this.flush(now)
  }
}
