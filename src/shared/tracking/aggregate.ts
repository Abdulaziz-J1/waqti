import { type DayKey, MINUTE, addDays, dayEndMs, dayStartMs, daysBetween } from '../time'
import type { Activity, Category } from './categorize'
import { siteLabel } from './sites'

/** Usage grouped by day and activity, as returned by the database. */
export interface UsageRow {
  day: DayKey
  process: string
  appName: string
  exePath: string
  site: string | null
  ms: number
}

/** A raw interval for the day timeline. */
export interface TimelineRow {
  start: number
  end: number
  process: string
  appName: string
  exePath: string
  site: string | null
}

export type Categorizer = (a: Activity) => string

/** Sites are their own activity; everything else is the app. */
export function activityKey(r: { process: string; site: string | null }): string {
  return r.site ? `site:${r.site}` : `app:${r.process}`
}

export function activityLabel(r: { appName: string; site: string | null }): string {
  return r.site ? siteLabel(r.site) : r.appName
}

export function sumMs(rows: readonly { ms: number }[]): number {
  let t = 0
  for (const r of rows) t += r.ms
  return t
}

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  ms: number
}

/** Totals per category, in category order, including zero totals. */
export function totalsByCategory(
  rows: readonly UsageRow[],
  categorize: Categorizer,
  categories: readonly Category[]
): CategoryTotal[] {
  const acc = new Map<string, number>()
  for (const r of rows) {
    const c = categorize(r)
    acc.set(c, (acc.get(c) ?? 0) + r.ms)
  }
  return categories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    color: c.color,
    ms: acc.get(c.id) ?? 0
  }))
}

export interface ActivityTotal {
  key: string
  label: string
  process: string
  appName: string
  exePath: string
  site: string | null
  categoryId: string
  ms: number
}

/** Activities (apps and sites) ranked by time, across all rows. */
export function topActivities(
  rows: readonly UsageRow[],
  categorize: Categorizer,
  limit = Infinity
): ActivityTotal[] {
  const acc = new Map<string, ActivityTotal>()
  for (const r of rows) {
    const key = activityKey(r)
    const cur = acc.get(key)
    if (cur) {
      cur.ms += r.ms
    } else {
      acc.set(key, {
        key,
        label: activityLabel(r),
        process: r.process,
        appName: r.appName,
        exePath: r.exePath,
        site: r.site,
        categoryId: categorize(r),
        ms: r.ms
      })
    }
  }
  return [...acc.values()]
    .sort((a, b) => b.ms - a.ms || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export interface DayStack {
  day: DayKey
  total: number
  byCategory: Record<string, number>
}

/** Per-day totals split by category, one entry per requested day (zeros included). */
export function stackByDay(
  rows: readonly UsageRow[],
  days: readonly DayKey[],
  categorize: Categorizer
): DayStack[] {
  const map = new Map<DayKey, DayStack>(days.map((d) => [d, { day: d, total: 0, byCategory: {} }]))
  for (const r of rows) {
    const stack = map.get(r.day)
    if (!stack) continue
    const c = categorize(r)
    stack.byCategory[c] = (stack.byCategory[c] ?? 0) + r.ms
    stack.total += r.ms
  }
  return days.map((d) => map.get(d)!)
}

export interface TimelineSegment {
  /** Minutes since the day's midnight. */
  startMin: number
  endMin: number
  categoryId: string
  label: string
  ms: number
}

/**
 * Day timeline segments. Consecutive rows of the same activity separated by
 * less than `joinGapMs` are joined so the strip stays readable.
 */
export function timelineSegments(
  rows: readonly TimelineRow[],
  categorize: Categorizer,
  day: DayKey,
  joinGapMs = 2 * MINUTE
): TimelineSegment[] {
  const start = dayStartMs(day)
  const end = dayEndMs(day)
  const sorted = [...rows].sort((a, b) => a.start - b.start)
  const out: Array<TimelineSegment & { key: string; lastEnd: number }> = []
  for (const r of sorted) {
    const s = Math.max(r.start, start)
    const e = Math.min(r.end, end)
    if (e <= s) continue
    const key = activityKey(r)
    const prev = out.at(-1)
    if (prev && prev.key === key && s - prev.lastEnd < joinGapMs) {
      prev.endMin = (e - start) / MINUTE
      prev.ms += e - s
      prev.lastEnd = e
      continue
    }
    out.push({
      key,
      lastEnd: e,
      startMin: (s - start) / MINUTE,
      endMin: (e - start) / MINUTE,
      categoryId: categorize(r),
      label: activityLabel(r),
      ms: e - s
    })
  }
  return out.map(({ key: _k, lastEnd: _l, ...seg }) => seg)
}

export interface HourStack {
  hour: number
  total: number
  byCategory: Record<string, number>
}

/** Usage per clock hour of one day, split by category (for the Day report tab). */
export function hourlyStacks(
  rows: readonly TimelineRow[],
  categorize: Categorizer,
  day: DayKey
): HourStack[] {
  const start = dayStartMs(day)
  const out: HourStack[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: 0,
    byCategory: {}
  }))
  for (const r of rows) {
    const cat = categorize(r)
    let s = Math.max(r.start, start)
    const e = Math.min(r.end, start + 24 * 60 * MINUTE)
    while (s < e) {
      const hour = Math.floor((s - start) / (60 * MINUTE))
      const hourEnd = start + (hour + 1) * 60 * MINUTE
      const piece = Math.min(e, hourEnd) - s
      const bucket = out[hour]
      if (!bucket) break
      bucket.byCategory[cat] = (bucket.byCategory[cat] ?? 0) + piece
      bucket.total += piece
      s += piece
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Report windows
// ---------------------------------------------------------------------------

export type RangeKind = 'day' | 'week' | 'month'
export const RANGE_DAYS: Record<RangeKind, number> = { day: 1, week: 7, month: 30 }

export interface ReportWindow {
  kind: RangeKind
  days: DayKey[]
  from: DayKey
  to: DayKey
  /** The current window, clipped to `now` when it includes today. */
  start: number
  end: number
  /** The previous window of the same elapsed length, for comparisons. */
  prevStart: number
  prevEnd: number
}

/**
 * The window for a report tab ending on `anchor`. When the window includes the
 * present, the comparison window is cut to the same elapsed time so a partial
 * day is compared fairly ("أقل من أمس" means less than yesterday by this time).
 */
export function reportWindow(kind: RangeKind, anchor: DayKey, now: number): ReportWindow {
  const n = RANGE_DAYS[kind]
  const from = addDays(anchor, -(n - 1))
  const start = dayStartMs(from)
  const end = Math.max(start, Math.min(dayEndMs(anchor), now))
  const prevStart = dayStartMs(addDays(from, -n))
  return {
    kind,
    days: daysBetween(from, anchor),
    from,
    to: anchor,
    start,
    end,
    prevStart,
    prevEnd: prevStart + (end - start)
  }
}

// ---------------------------------------------------------------------------
// Focus statistics
// ---------------------------------------------------------------------------

export interface FocusSessionRecord {
  id: string
  startedAt: number
  endedAt: number
  plannedMs: number
  focusedMs: number
  blocked: number
  snoozed: number
  completed: boolean
}

export interface FocusStats {
  sessions: number
  completed: number
  focusedMs: number
  blocked: number
  snoozed: number
  /** Completed / started, 0…1. */
  completionRate: number
  longestMs: number
}

export function focusStats(sessions: readonly FocusSessionRecord[]): FocusStats {
  let completed = 0
  let focusedMs = 0
  let blocked = 0
  let snoozed = 0
  let longestMs = 0
  for (const s of sessions) {
    if (s.completed) completed++
    focusedMs += s.focusedMs
    blocked += s.blocked
    snoozed += s.snoozed
    longestMs = Math.max(longestMs, s.focusedMs)
  }
  return {
    sessions: sessions.length,
    completed,
    focusedMs,
    blocked,
    snoozed,
    completionRate: sessions.length ? completed / sessions.length : 0,
    longestMs
  }
}
