import type { DB } from './database'
import type { DemoData } from '../../../shared/demo/generate'
import type { ExportBundle } from '../../../shared/export'
import type { PrayerLogEntry } from '../../../shared/machine/types'
import type { PrayerId } from '../../../shared/prayer/schedule'
import { DAY, type DayKey } from '../../../shared/time'
import type { FocusSessionRecord, TimelineRow, UsageRow } from '../../../shared/tracking/aggregate'
import type { Category, Rule, RuleKind } from '../../../shared/tracking/categorize'
import type { DayInterval } from '../../../shared/tracking/merge'

export interface StoredInterval extends DayInterval {
  id: number
}

export interface DistractionRow {
  sessionId: string
  at: number
  label: string
  process: string
  site: string | null
  action: 'back' | 'snooze'
}

export interface AppRow {
  process: string
  name: string
  exePath: string
}

/**
 * All SQL lives here. Statements are prepared once; writes are batched in
 * transactions. Categorisation is applied by callers at query time.
 */
export class Repo {
  private appIds = new Map<string, number>()
  private s: ReturnType<Repo['prepare']>

  constructor(private readonly db: DB) {
    this.s = this.prepare()
  }

  private prepare() {
    const db = this.db
    return {
      appByProcess: db.prepare('SELECT id, name, exe_path FROM apps WHERE process = ?'),
      insertApp: db.prepare('INSERT INTO apps (process, name, exe_path) VALUES (?, ?, ?)'),
      updateApp: db.prepare('UPDATE apps SET name = ?, exe_path = ? WHERE id = ?'),
      insertInterval: db.prepare(
        `INSERT INTO intervals (app_id, site, title, start_ms, end_ms, day, demo)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (app_id, start_ms) DO UPDATE SET end_ms = MAX(end_ms, excluded.end_ms), title = COALESCE(excluded.title, title)
         RETURNING id`
      ),
      updateInterval: db.prepare('UPDATE intervals SET end_ms = ?, title = ? WHERE id = ?'),
      usage: db.prepare(
        `SELECT i.day AS day, a.process AS process, a.name AS appName, a.exe_path AS exePath,
                i.site AS site, SUM(i.end_ms - i.start_ms) AS ms
         FROM intervals i JOIN apps a ON a.id = i.app_id
         WHERE i.day BETWEEN ? AND ?
         GROUP BY i.day, i.app_id, i.site`
      ),
      totalBetween: db.prepare(
        `SELECT COALESCE(SUM(MIN(end_ms, @end) - MAX(start_ms, @start)), 0) AS ms
         FROM intervals
         WHERE start_ms >= @start - ${DAY} AND start_ms < @end AND end_ms > @start`
      ),
      timeline: db.prepare(
        `SELECT i.start_ms AS start, i.end_ms AS end, a.process AS process, a.name AS appName,
                a.exe_path AS exePath, i.site AS site
         FROM intervals i JOIN apps a ON a.id = i.app_id
         WHERE i.day = ? ORDER BY i.start_ms`
      ),
      recentApps: db.prepare(
        `SELECT a.process AS process, a.name AS name, a.exe_path AS exePath, SUM(i.end_ms - i.start_ms) AS ms
         FROM intervals i JOIN apps a ON a.id = i.app_id
         WHERE i.day >= ? GROUP BY a.id ORDER BY ms DESC LIMIT ?`
      ),
      insertSession: db.prepare(
        `INSERT OR REPLACE INTO focus_sessions
           (id, started_at, ended_at, planned_ms, focused_ms, blocked, snoozed, completed, demo)
         VALUES (@id, @startedAt, @endedAt, @plannedMs, @focusedMs, @blocked, @snoozed, @completed, @demo)`
      ),
      sessionsBetween: db.prepare(
        `SELECT id, started_at AS startedAt, ended_at AS endedAt, planned_ms AS plannedMs,
                focused_ms AS focusedMs, blocked, snoozed, completed
         FROM focus_sessions WHERE started_at >= ? AND started_at < ? ORDER BY started_at`
      ),
      insertDistraction: db.prepare(
        `INSERT INTO distractions (session_id, at_ms, label, process, site, action, demo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ),
      upsertPrayer: db.prepare(
        `INSERT INTO prayer_log (day, prayer, scheduled_at, outcome, reason, snoozed, at_ms, demo)
         VALUES (@day, @prayer, @scheduledAt, @outcome, @reason, @snoozed, @at, @demo)
         ON CONFLICT (day, prayer) DO UPDATE SET
           scheduled_at = excluded.scheduled_at, outcome = excluded.outcome, reason = excluded.reason,
           snoozed = excluded.snoozed, at_ms = excluded.at_ms, demo = excluded.demo
         WHERE prayer_log.demo = 1 OR excluded.demo = 0`
      ),
      prayersBetween: db.prepare(
        `SELECT day, prayer, scheduled_at AS scheduledAt, outcome, reason, snoozed, at_ms AS at
         FROM prayer_log WHERE day BETWEEN ? AND ? ORDER BY scheduled_at`
      ),
      categories: db.prepare('SELECT id, name, color FROM categories ORDER BY sort, rowid'),
      insertCategory: db.prepare(
        'INSERT INTO categories (id, name, color, sort) VALUES (?, ?, ?, ?)'
      ),
      rules: db.prepare('SELECT kind, pattern, category_id AS categoryId FROM rules ORDER BY id'),
      upsertRule: db.prepare(
        `INSERT INTO rules (kind, pattern, category_id) VALUES (?, ?, ?)
         ON CONFLICT (kind, pattern) DO UPDATE SET category_id = excluded.category_id`
      ),
      deleteRule: db.prepare('DELETE FROM rules WHERE kind = ? AND pattern = ?'),
      getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
      setMeta: db.prepare(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
      ),
      deleteMeta: db.prepare('DELETE FROM meta WHERE key = ?')
    }
  }

  /** Runs `fn` in one transaction (nested calls become savepoints). */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  // -- apps ------------------------------------------------------------------

  appId(process: string, name: string, exePath: string): number {
    const cached = this.appIds.get(process)
    if (cached !== undefined) return cached
    const row = this.s.appByProcess.get(process) as
      { id: number; name: string; exe_path: string } | undefined
    let id: number
    if (row) {
      id = row.id
      if ((name && row.name !== name) || (exePath && row.exe_path !== exePath)) {
        this.s.updateApp.run(name || row.name, exePath || row.exe_path, id)
      }
    } else {
      id = Number(this.s.insertApp.run(process, name, exePath).lastInsertRowid)
    }
    this.appIds.set(process, id)
    return id
  }

  // -- intervals ---------------------------------------------------------------

  /** Inserts an interval and returns its row id (merging with an existing row that has the same start). */
  insertInterval(iv: DayInterval, demo = false): number {
    const appId = this.appId(iv.process, iv.appName, iv.exePath)
    const r = this.s.insertInterval.get(
      appId,
      iv.site,
      iv.title,
      Math.round(iv.start),
      Math.round(iv.end),
      iv.day,
      demo ? 1 : 0
    ) as { id: number }
    return r.id
  }

  updateInterval(id: number, end: number, title: string | null): void {
    this.s.updateInterval.run(Math.round(end), title, id)
  }

  /** Writes a batch of closed intervals in one transaction. */
  insertIntervals(batch: DayInterval[], demo = false): void {
    if (!batch.length) return
    this.db.transaction(() => {
      for (const iv of batch) this.insertInterval(iv, demo)
    })()
  }

  usageRows(from: DayKey, to: DayKey): UsageRow[] {
    return this.s.usage.all(from, to) as UsageRow[]
  }

  totalBetween(start: number, end: number): number {
    return (this.s.totalBetween.get({ start, end }) as { ms: number }).ms
  }

  timelineRows(day: DayKey): TimelineRow[] {
    return this.s.timeline.all(day) as TimelineRow[]
  }

  recentApps(sinceDay: DayKey, limit: number): Array<AppRow & { ms: number }> {
    return this.s.recentApps.all(sinceDay, limit) as Array<AppRow & { ms: number }>
  }

  intervalCount(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM intervals').get() as { n: number }).n
  }

  // -- focus -----------------------------------------------------------------

  saveSession(r: FocusSessionRecord, demo = false): void {
    this.s.insertSession.run({ ...r, completed: r.completed ? 1 : 0, demo: demo ? 1 : 0 })
  }

  sessionsBetween(start: number, end: number): FocusSessionRecord[] {
    return (
      this.s.sessionsBetween.all(start, end) as Array<
        Omit<FocusSessionRecord, 'completed'> & { completed: number }
      >
    ).map((r) => ({ ...r, completed: Boolean(r.completed) }))
  }

  logDistraction(d: DistractionRow, demo = false): void {
    this.s.insertDistraction.run(
      d.sessionId,
      d.at,
      d.label,
      d.process,
      d.site,
      d.action,
      demo ? 1 : 0
    )
  }

  // -- prayers -----------------------------------------------------------------

  logPrayer(e: PrayerLogEntry, demo = false): void {
    this.s.upsertPrayer.run({ ...e, snoozed: e.snoozed ? 1 : 0, demo: demo ? 1 : 0 })
  }

  prayersBetween(from: DayKey, to: DayKey): PrayerLogEntry[] {
    return (
      this.s.prayersBetween.all(from, to) as Array<
        Omit<PrayerLogEntry, 'snoozed'> & { snoozed: number; prayer: PrayerId }
      >
    ).map((r) => ({ ...r, snoozed: Boolean(r.snoozed) }))
  }

  // -- categories and rules --------------------------------------------------

  customCategories(): Category[] {
    return (this.s.categories.all() as Array<Omit<Category, 'builtin'>>).map((c) => ({
      ...c,
      builtin: false
    }))
  }

  createCategory(id: string, name: string, color: string): void {
    const sort = this.customCategories().length
    this.s.insertCategory.run(id, name, color, sort)
  }

  updateCategory(id: string, name?: string, color?: string): void {
    if (name !== undefined)
      this.db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id)
    if (color !== undefined)
      this.db.prepare('UPDATE categories SET color = ? WHERE id = ?').run(color, id)
  }

  /** Deletes a custom category and every rule pointing at it (those activities fall back to defaults). */
  deleteCategory(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM rules WHERE category_id = ?').run(id)
      this.db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    })()
  }

  rules(): Rule[] {
    return this.s.rules.all() as Rule[]
  }

  setRule(kind: RuleKind, pattern: string, categoryId: string): void {
    this.s.upsertRule.run(kind, pattern, categoryId)
  }

  deleteRule(kind: RuleKind, pattern: string): void {
    this.s.deleteRule.run(kind, pattern)
  }

  // -- meta --------------------------------------------------------------------

  getMeta(key: string): string | null {
    return (this.s.getMeta.get(key) as { value: string } | undefined)?.value ?? null
  }

  setMeta(key: string, value: string): void {
    this.s.setMeta.run(key, value)
  }

  deleteMeta(key: string): void {
    this.s.deleteMeta.run(key)
  }

  // -- maintenance -------------------------------------------------------------

  /** Deletes tracked data older than `beforeDay` (retention). */
  deleteBefore(beforeDay: DayKey, beforeMs: number): number {
    return this.db.transaction(() => {
      const n = this.db.prepare('DELETE FROM intervals WHERE day < ?').run(beforeDay).changes
      this.db.prepare('DELETE FROM focus_sessions WHERE started_at < ?').run(beforeMs)
      this.db.prepare('DELETE FROM distractions WHERE at_ms < ?').run(beforeMs)
      this.db.prepare('DELETE FROM prayer_log WHERE day < ?').run(beforeDay)
      return n
    })()
  }

  counts(): { intervals: number; sessions: number; prayers: number } {
    const n = (sql: string): number => (this.db.prepare(sql).get() as { n: number }).n
    return {
      intervals: n('SELECT COUNT(*) AS n FROM intervals'),
      sessions: n('SELECT COUNT(*) AS n FROM focus_sessions'),
      prayers: n('SELECT COUNT(*) AS n FROM prayer_log')
    }
  }

  /** Deletes all user data (history, sessions, prayers, categories, rules). */
  deleteAll(): void {
    this.db.transaction(() => {
      for (const t of [
        'intervals',
        'focus_sessions',
        'distractions',
        'prayer_log',
        'rules',
        'categories',
        'apps'
      ]) {
        this.db.prepare(`DELETE FROM ${t}`).run()
      }
    })()
    this.appIds.clear()
    this.db.pragma('wal_checkpoint(TRUNCATE)')
    this.db.exec('VACUUM')
  }

  // -- demo data -----------------------------------------------------------------

  insertDemo(d: DemoData): number {
    return this.db.transaction(() => {
      for (const iv of d.intervals) this.insertInterval(iv, true)
      for (const s of d.sessions) this.saveSession(s, true)
      for (const x of d.distractions) this.logDistraction(x, true)
      for (const p of d.prayerLog) this.logPrayer(p, true)
      return d.intervals.length
    })()
  }

  clearDemo(): void {
    this.db.transaction(() => {
      for (const t of ['intervals', 'focus_sessions', 'distractions', 'prayer_log']) {
        this.db.prepare(`DELETE FROM ${t} WHERE demo = 1`).run()
      }
    })()
  }

  // -- export / import -----------------------------------------------------------

  exportBundle(now: number): ExportBundle {
    const apps = this.db
      .prepare('SELECT process, name, exe_path AS exePath FROM apps ORDER BY id')
      .all() as AppRow[]
    const intervals = this.db
      .prepare(
        `SELECT a.process AS process, i.site AS site, i.title AS title, i.start_ms AS start, i.end_ms AS end, i.day AS day
         FROM intervals i JOIN apps a ON a.id = i.app_id WHERE i.demo = 0 ORDER BY i.start_ms`
      )
      .all() as ExportBundle['intervals']
    const focusSessions = (
      this.db
        .prepare(
          `SELECT id, started_at AS startedAt, ended_at AS endedAt, planned_ms AS plannedMs,
                  focused_ms AS focusedMs, blocked, snoozed, completed
           FROM focus_sessions WHERE demo = 0 ORDER BY started_at`
        )
        .all() as Array<Omit<FocusSessionRecord, 'completed'> & { completed: number }>
    ).map((r) => ({ ...r, completed: Boolean(r.completed) }))
    const distractions = this.db
      .prepare(
        `SELECT session_id AS sessionId, at_ms AS at, label, process, site, action
         FROM distractions WHERE demo = 0 ORDER BY at_ms`
      )
      .all() as DistractionRow[]
    const prayerLog = (
      this.db
        .prepare(
          `SELECT day, prayer, scheduled_at AS scheduledAt, outcome, reason, snoozed, at_ms AS at
           FROM prayer_log WHERE demo = 0 ORDER BY scheduled_at`
        )
        .all() as Array<Omit<PrayerLogEntry, 'snoozed'> & { snoozed: number }>
    ).map((r) => ({ ...r, snoozed: Boolean(r.snoozed) }))
    return {
      format: 'waqti-export',
      version: 1,
      exportedAt: now,
      apps,
      intervals,
      focusSessions,
      distractions,
      prayerLog,
      categories: this.customCategories(),
      rules: this.rules()
    }
  }

  /** Merges an export bundle; existing rows are kept (no duplicates). */
  importBundle(b: ExportBundle): { intervals: number; sessions: number; prayers: number } {
    return this.db.transaction(() => {
      const names = new Map(b.apps.map((a) => [a.process, a]))
      const before = this.counts()
      const existingCats = new Set(this.customCategories().map((c) => c.id))
      for (const c of b.categories) {
        if (!existingCats.has(c.id)) this.createCategory(c.id, c.name, c.color)
      }
      for (const r of b.rules) this.setRule(r.kind, r.pattern, r.categoryId)
      const insertIgnore = this.db.prepare(
        `INSERT OR IGNORE INTO intervals (app_id, site, title, start_ms, end_ms, day, demo) VALUES (?, ?, ?, ?, ?, ?, 0)`
      )
      for (const iv of b.intervals) {
        const app = names.get(iv.process)
        const appId = this.appId(iv.process, app?.name ?? iv.process, app?.exePath ?? '')
        insertIgnore.run(appId, iv.site, iv.title, iv.start, iv.end, iv.day)
      }
      const insertSession = this.db.prepare(
        `INSERT OR IGNORE INTO focus_sessions (id, started_at, ended_at, planned_ms, focused_ms, blocked, snoozed, completed, demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      for (const s of b.focusSessions) {
        insertSession.run(
          s.id,
          s.startedAt,
          s.endedAt,
          s.plannedMs,
          s.focusedMs,
          s.blocked,
          s.snoozed,
          s.completed ? 1 : 0
        )
      }
      for (const d of b.distractions) this.logDistraction(d)
      const insertPrayer = this.db.prepare(
        `INSERT OR IGNORE INTO prayer_log (day, prayer, scheduled_at, outcome, reason, snoozed, at_ms, demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
      )
      for (const p of b.prayerLog) {
        insertPrayer.run(
          p.day,
          p.prayer,
          p.scheduledAt,
          p.outcome,
          p.reason,
          p.snoozed ? 1 : 0,
          p.at
        )
      }
      const after = this.counts()
      return {
        intervals: after.intervals - before.intervals,
        sessions: after.sessions - before.sessions,
        prayers: after.prayers - before.prayers
      }
    })()
  }
}
