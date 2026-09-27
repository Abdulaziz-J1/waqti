import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DB } from './db/database'
import { Repo } from './db/repo'
import { type TrackContext, Tracker } from './tracker'
import { Scheduler } from './scheduler'
import type { ForegroundInfo } from '../../shared/tracking/apps'
import { defaultSettings, applyPatch } from '../../shared/settings/schema'
import { MINUTE, SECOND } from '../../shared/time'

let dir: string
let db: DB
let repo: Repo

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-tr-'))
  db = openDatabase(path.join(dir, 'w.db'))
  repo = new Repo(db)
})
afterEach(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

const fg = (process: string, title = 't'): ForegroundInfo => ({
  process,
  exePath: `C:\\${process}`,
  appName: process,
  title,
  pid: 1,
  hwnd: 1,
  bounds: null
})

const ctx = (now: number, over: Partial<TrackContext> = {}): TrackContext => ({
  now,
  fg: fg('code.exe'),
  idleSeconds: 0,
  idleThresholdSec: 180,
  screenLocked: false,
  overlayVisible: false,
  paused: false,
  excluded: new Set(),
  storeTitles: true,
  ...over
})

const T = new Date('2026-09-27T10:00:00+03:00').getTime()

function run(
  tracker: Tracker,
  from: number,
  seconds: number,
  over: Partial<TrackContext> = {}
): number {
  let t = from
  for (let i = 0; i < seconds; i++, t += SECOND) tracker.tick(ctx(t, over))
  return t
}

describe('tracker', () => {
  it('records app switches and flushes every 30 s', () => {
    const tr = new Tracker(repo)
    let t = run(tr, T, 60)
    t = run(tr, t, 30, { fg: fg('chrome.exe', 'Clip - YouTube - Google Chrome') })
    tr.stop(t)
    const rows = repo.usageRows('2026-09-27', '2026-09-27')
    expect(rows.find((r) => r.process === 'code.exe')?.ms).toBe(60 * SECOND)
    expect(rows.find((r) => r.site === 'youtube')?.ms).toBe(30 * SECOND)
    expect(repo.intervalCount()).toBe(2)
  })

  it('updates the open row in place across flushes', () => {
    const tr = new Tracker(repo)
    const t = run(tr, T, 95)
    expect(repo.intervalCount()).toBe(1)
    tr.stop(t)
    expect(repo.intervalCount()).toBe(1)
    expect(repo.usageRows('2026-09-27', '2026-09-27')[0]!.ms).toBe(95 * SECOND)
  })

  it('does not count idle time and trims back to the last input', () => {
    const tr = new Tracker(repo)
    let t = run(tr, T, 120)
    // Idle reaches 3 minutes: the last 180 s are removed from the interval.
    tr.tick(ctx(t + 180 * SECOND, { idleSeconds: 181 }))
    t = t + 181 * SECOND
    expect(tr.status.reason).toBe('idle')
    tr.stop(t)
    expect(repo.usageRows('2026-09-27', '2026-09-27')[0]!.ms).toBeLessThanOrEqual(121 * SECOND)
  })

  it('skips paused, locked, overlay and excluded time', () => {
    const tr = new Tracker(repo)
    let t = run(tr, T, 10, { paused: true })
    expect(tr.status.reason).toBe('paused')
    t = run(tr, t, 10, { screenLocked: true })
    expect(tr.status.reason).toBe('locked')
    t = run(tr, t, 10, { overlayVisible: true })
    expect(tr.status.reason).toBe('overlay')
    t = run(tr, t, 10, { excluded: new Set(['code.exe']) })
    expect(tr.status.reason).toBe('excluded')
    t = run(tr, t, 10, { fg: null })
    expect(tr.status.reason).toBe('none')
    tr.stop(t)
    expect(repo.intervalCount()).toBe(0)
  })

  it('does not store titles when the privacy setting is off', () => {
    const tr = new Tracker(repo)
    const t = run(tr, T, 5, { storeTitles: false, fg: fg('code.exe', 'secret.txt') })
    tr.stop(t)
    const title = (db.prepare('SELECT title FROM intervals').get() as { title: string | null })
      .title
    expect(title).toBeNull()
  })

  it('splits an interval that crosses midnight', () => {
    const tr = new Tracker(repo)
    const late = new Date('2026-09-27T23:59:00+03:00').getTime()
    const t = run(tr, late, 120)
    tr.stop(t)
    expect(repo.usageRows('2026-09-27', '2026-09-27')[0]!.ms).toBe(60 * SECOND)
    expect(repo.usageRows('2026-09-28', '2026-09-28')[0]!.ms).toBe(60 * SECOND)
  })
})

describe('scheduler', () => {
  const settings = defaultSettings()

  it('emits due events once and recomputes after midnight', () => {
    const start = new Date('2026-09-27T15:00:00+03:00').getTime()
    const sch = new Scheduler(() => settings, start)
    const asr = sch.bundle()!.today.times.asr
    let seen = 0
    for (let t = start + SECOND; t <= asr + 2 * SECOND; t += SECOND) {
      const r = sch.tick(t)
      if (r.kind === 'due') seen += r.events.filter((e) => e.kind === 'prayer').length
    }
    expect(seen).toBe(1)
    const nextDay = new Date('2026-09-28T00:00:01+03:00').getTime()
    sch.reset(nextDay - 2000)
    sch.tick(nextDay)
    expect(sch.bundle()!.today.day).toBe('2026-09-28')
  })

  it('reports missed prayers after a long gap or sleep', () => {
    const start = new Date('2026-09-27T14:00:00+03:00').getTime()
    const sch = new Scheduler(() => settings, start)
    const r = sch.tick(start + 3 * 60 * MINUTE)
    expect(r.kind).toBe('gap')
    if (r.kind === 'gap') expect(r.missed.map((m) => m.ref.prayer)).toEqual(['asr'])
    const missed = sch.resume(start, start + 5 * 60 * MINUTE)
    expect(missed.map((m) => m.ref.prayer)).toEqual(['asr', 'maghrib'])
    expect(sch.recent(sch.bundle()!.today.times.asr + MINUTE, 10 * MINUTE)?.ref.prayer).toBe('asr')
  })

  it('follows city changes and reports schedule errors', () => {
    let s = settings
    const now = new Date('2026-09-27T12:00:00+03:00').getTime()
    const sch = new Scheduler(() => s, now)
    const riyadhAsr = sch.bundle()!.today.times.asr
    s = applyPatch(settings, { location: { kind: 'city', cityId: 'jeddah' } })
    sch.reset(now)
    expect(sch.bundle()!.today.times.asr).toBeGreaterThan(riyadhAsr)
    expect(sch.error).toBeNull()
  })
})
