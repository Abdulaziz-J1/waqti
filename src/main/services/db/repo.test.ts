import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, dailyBackup, openDatabase, openWithRecovery, type DB } from './database'
import { Repo } from './repo'
import { Analytics } from '../analytics'
import { generateDemo } from '../../../shared/demo/generate'
import { DAY, MINUTE, dayStartMs } from '../../../shared/time'
import type { DayInterval } from '../../../shared/tracking/merge'

let dir: string
let db: DB
let repo: Repo

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-db-'))
  db = openDatabase(path.join(dir, 'waqti.db'))
  repo = new Repo(db)
})

afterEach(() => {
  try {
    db.close()
  } catch {
    // already closed by the test
  }
  fs.rmSync(dir, { recursive: true, force: true })
})

const day = '2026-09-27'
const base = dayStartMs(day)
const iv = (
  startMin: number,
  endMin: number,
  process = 'code.exe',
  site: string | null = null
): DayInterval => ({
  process,
  appName: process === 'code.exe' ? 'Visual Studio Code' : process,
  exePath: `C:\\${process}`,
  site,
  title: 'title',
  start: base + startMin * MINUTE,
  end: base + endMin * MINUTE,
  day
})

describe('database', () => {
  it('migrates to the latest schema in WAL mode', () => {
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION)
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
  })

  it('stores intervals, merges same-start upserts and aggregates usage', () => {
    const id = repo.insertInterval(iv(600, 610))
    repo.updateInterval(id, base + 620 * MINUTE, 'new title')
    expect(repo.insertInterval(iv(600, 615))).toBe(id)
    repo.insertIntervals([
      iv(700, 730, 'chrome.exe', 'youtube'),
      iv(731, 740, 'chrome.exe', 'youtube')
    ])
    const rows = repo.usageRows(day, day)
    expect(rows.find((r) => r.process === 'code.exe')?.ms).toBe(20 * MINUTE)
    expect(rows.find((r) => r.site === 'youtube')?.ms).toBe(39 * MINUTE)
    expect(repo.timelineRows(day)).toHaveLength(3)
    expect(repo.totalBetween(base + 605 * MINUTE, base + 705 * MINUTE)).toBe(20 * MINUTE)
    expect(repo.intervalCount()).toBe(3)
    expect(repo.recentApps(day, 5).map((a) => a.process)).toEqual(['chrome.exe', 'code.exe'])
  })

  it('keeps app names up to date', () => {
    repo.appId('x.exe', 'Old', 'C:\\x.exe')
    const r2 = new Repo(db)
    r2.appId('x.exe', 'New', 'C:\\x.exe')
    expect(
      (db.prepare('SELECT name FROM apps WHERE process = ?').get('x.exe') as { name: string }).name
    ).toBe('New')
  })

  it('stores focus sessions and distractions', () => {
    repo.saveSession({
      id: 's',
      startedAt: base,
      endedAt: base + 1,
      plannedMs: 1,
      focusedMs: 1,
      blocked: 1,
      snoozed: 0,
      completed: true
    })
    repo.logDistraction({
      sessionId: 's',
      at: base,
      label: 'YouTube',
      process: 'chrome.exe',
      site: 'youtube',
      action: 'back'
    })
    expect(repo.sessionsBetween(base, base + DAY)[0]).toMatchObject({ id: 's', completed: true })
  })

  it('keeps one prayer entry per day and never lets demo data overwrite real entries', () => {
    const entry = {
      prayer: 'asr' as const,
      day,
      scheduledAt: base,
      outcome: 'prayed' as const,
      reason: null,
      snoozed: true,
      at: base
    }
    repo.logPrayer(entry)
    repo.logPrayer({ ...entry, outcome: 'emergency' }, true)
    expect(repo.prayersBetween(day, day)).toEqual([entry])
    repo.logPrayer({ ...entry, outcome: 'ended', reason: 'duration', snoozed: false })
    expect(repo.prayersBetween(day, day)[0]).toMatchObject({ outcome: 'ended', snoozed: false })
  })

  it('manages categories and rules; deleting a category removes its rules', () => {
    repo.createCategory('c1', 'قرآن', '#5E9E4A')
    repo.updateCategory('c1', 'تلاوة', '#8E6CC4')
    repo.setRule('site', 'quran.com', 'c1')
    repo.setRule('site', 'quran.com', 'work')
    repo.setRule('app', 'x.exe', 'c1')
    expect(repo.customCategories()).toEqual([
      { id: 'c1', name: 'تلاوة', color: '#8E6CC4', builtin: false }
    ])
    expect(repo.rules()).toHaveLength(2)
    repo.deleteCategory('c1')
    expect(repo.rules()).toEqual([{ kind: 'site', pattern: 'quran.com', categoryId: 'work' }])
    repo.deleteRule('site', 'quran.com')
    expect(repo.rules()).toEqual([])
  })

  it('stores meta values', () => {
    repo.setMeta('k', 'v')
    repo.setMeta('k', 'w')
    expect(repo.getMeta('k')).toBe('w')
    repo.deleteMeta('k')
    expect(repo.getMeta('k')).toBeNull()
  })

  it('applies retention', () => {
    repo.insertInterval({
      ...iv(600, 610),
      day: '2026-01-01',
      start: dayStartMs('2026-01-01'),
      end: dayStartMs('2026-01-01') + MINUTE
    })
    repo.insertInterval(iv(600, 610))
    expect(repo.deleteBefore('2026-06-01', dayStartMs('2026-06-01'))).toBe(1)
    expect(repo.intervalCount()).toBe(1)
  })

  it('exports and re-imports without duplicates', () => {
    repo.insertIntervals([iv(600, 610), iv(620, 640, 'chrome.exe', 'youtube')])
    repo.createCategory('c1', 'قرآن', '#5E9E4A')
    repo.setRule('app', 'code.exe', 'c1')
    repo.saveSession({
      id: 's',
      startedAt: base,
      endedAt: base + 1,
      plannedMs: 1,
      focusedMs: 1,
      blocked: 0,
      snoozed: 0,
      completed: false
    })
    repo.logPrayer({
      prayer: 'fajr',
      day,
      scheduledAt: base,
      outcome: 'prayed',
      reason: null,
      snoozed: false,
      at: base
    })
    repo.insertDemo(
      generateDemo({ endDay: day, days: 1, now: base + DAY, coords: { lat: 24.7, lng: 46.7 } })
    )
    const bundle = repo.exportBundle(base)
    expect(bundle.intervals).toHaveLength(2)
    expect(bundle.focusSessions).toHaveLength(1)
    expect(repo.importBundle(bundle)).toEqual({ intervals: 0, sessions: 0, prayers: 0 })

    repo.deleteAll()
    expect(repo.counts()).toEqual({ intervals: 0, sessions: 0, prayers: 0 })
    expect(repo.importBundle(bundle)).toEqual({ intervals: 2, sessions: 1, prayers: 1 })
    expect(repo.customCategories()).toHaveLength(1)
    expect(repo.rules()).toHaveLength(1)
  })

  it('inserts and clears demo data without touching real data', () => {
    repo.insertInterval(iv(600, 610))
    const demo = generateDemo({
      endDay: day,
      days: 3,
      now: base + DAY,
      coords: { lat: 24.7, lng: 46.7 }
    })
    expect(repo.insertDemo(demo)).toBe(demo.intervals.length)
    expect(repo.counts().intervals).toBeGreaterThan(1)
    repo.clearDemo()
    expect(repo.counts()).toEqual({ intervals: 1, sessions: 0, prayers: 0 })
  })
})

describe('recovery and backups', () => {
  it('restores the newest healthy backup when the database is corrupt', async () => {
    repo.insertInterval(iv(600, 610))
    const backups = path.join(dir, 'backups')
    const written = await dailyBackup(db, backups, '2026-09-26')
    expect(written).toBeTruthy()
    expect(await dailyBackup(db, backups, '2026-09-26')).toBeNull()
    db.close()
    const file = path.join(dir, 'waqti.db')
    for (const ext of ['-wal', '-shm']) fs.rmSync(file + ext, { force: true })
    fs.writeFileSync(file, 'this is not a database'.repeat(100))
    const r = openWithRecovery(file, backups, 123)
    db = r.db
    expect(r.status).toBe('restored')
    expect(r.quarantined).toContain('corrupt-123')
    expect(new Repo(db).intervalCount()).toBe(1)
  })

  it('starts fresh when no backup is usable', () => {
    db.close()
    const file = path.join(dir, 'waqti.db')
    for (const ext of ['-wal', '-shm']) fs.rmSync(file + ext, { force: true })
    fs.writeFileSync(file, 'garbage'.repeat(500))
    const backups = path.join(dir, 'backups')
    fs.mkdirSync(backups)
    fs.writeFileSync(path.join(backups, 'waqti-2026-09-20.db'), 'also garbage'.repeat(200))
    const r = openWithRecovery(file, backups)
    db = r.db
    expect(r.status).toBe('reset')
    expect(new Repo(db).intervalCount()).toBe(0)
  })

  it('opens a healthy database untouched and keeps 7 backups', async () => {
    db.close()
    const r = openWithRecovery(path.join(dir, 'waqti.db'), path.join(dir, 'backups'))
    db = r.db
    expect(r.status).toBe('ok')
    for (let d = 1; d <= 9; d++) await dailyBackup(db, path.join(dir, 'backups'), `2026-09-0${d}`)
    expect(fs.readdirSync(path.join(dir, 'backups')).filter((f) => f.endsWith('.db'))).toHaveLength(
      7
    )
  })
})

describe('performance budget', () => {
  it('runs report queries on 1 year of heavy data in under 100 ms', () => {
    const now = new Date('2026-09-27T21:00:00+03:00').getTime()
    const demo = generateDemo({
      endDay: day,
      days: 365,
      now,
      coords: { lat: 24.7136, lng: 46.6753 },
      density: 6
    })
    repo.insertDemo(demo)
    expect(repo.intervalCount()).toBeGreaterThan(60_000)
    const analytics = new Analytics(repo)
    // Warm-up (statement caches), then measure.
    analytics.report('month', day, now)
    const timings: Record<string, number> = {}
    for (const kind of ['day', 'week', 'month'] as const) {
      const r = analytics.report(kind, day, now)
      timings[kind] = Math.round(r.queryMs * 10) / 10
      expect(r.queryMs).toBeLessThan(100)
    }
    const t0 = performance.now()
    analytics.today(now)
    timings['today'] = Math.round((performance.now() - t0) * 10) / 10
    expect(timings['today']).toBeLessThan(100)
    console.info(`query budget on ${repo.intervalCount()} intervals (1 year), ms:`, timings)
  })
})
