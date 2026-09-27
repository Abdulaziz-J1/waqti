import type { Repo } from './db/repo'
import type { ReportData, TodayData } from '../../shared/ipc'
import {
  type RangeKind,
  focusStats,
  reportWindow,
  stackByDay,
  sumMs,
  timelineSegments,
  topActivities,
  totalsByCategory
} from '../../shared/tracking/aggregate'
import { allCategories, makeCategorizer } from '../../shared/tracking/categorize'
import { type DayKey, dayEndMs, dayKey, dayStartMs } from '../../shared/time'

type IconLookup = (exePath: string) => string | null

/** Builds Today and Reports data. Rules are applied here, at query time. */
export class Analytics {
  constructor(
    private readonly repo: Repo,
    private readonly iconFor: IconLookup = () => null
  ) {}

  private categorizer() {
    const categories = allCategories(this.repo.customCategories())
    return { categories, categorize: makeCategorizer(this.repo.rules(), categories) }
  }

  today(now: number): TodayData {
    const day = dayKey(now)
    const { categories, categorize } = this.categorizer()
    const rows = this.repo.usageRows(day, day)
    const sessions = this.repo.sessionsBetween(dayStartMs(day), dayEndMs(day))
    return {
      day,
      totalMs: sumMs(rows),
      totals: totalsByCategory(rows, categorize, categories),
      top: topActivities(rows, categorize, 5).map((a) => ({ ...a, icon: this.iconFor(a.exePath) })),
      timeline: timelineSegments(this.repo.timelineRows(day), categorize, day),
      categories,
      focus: focusStats(sessions),
      sessions
    }
  }

  report(kind: RangeKind, anchor: DayKey, now: number): ReportData {
    const t0 = performance.now()
    const w = reportWindow(kind, anchor, now)
    const { categories, categorize } = this.categorizer()
    const rows = this.repo.usageRows(w.from, w.to)
    const prevTotalMs = this.repo.totalBetween(w.prevStart, w.prevEnd)
    const sessions = this.repo.sessionsBetween(w.start, w.end)
    const prevSessions = this.repo.sessionsBetween(w.prevStart, w.prevEnd)
    const activities = topActivities(rows, categorize, 60)
    const result: ReportData = {
      kind,
      from: w.from,
      to: w.to,
      days: w.days,
      totalMs: sumMs(rows),
      prevTotalMs,
      totals: totalsByCategory(rows, categorize, categories),
      stacks: stackByDay(rows, w.days, categorize),
      activities: activities.map((a) => ({ ...a, icon: null })),
      categories,
      focus: focusStats(sessions),
      prevFocus: focusStats(prevSessions),
      queryMs: 0
    }
    result.queryMs = performance.now() - t0
    // Icons come from a cache; looking them up is not part of the query budget.
    result.activities = activities.map((a) => ({ ...a, icon: this.iconFor(a.exePath) }))
    return result
  }
}
