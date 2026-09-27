import { describe, expect, it } from 'vitest'
import { DEMO_APPS, generateDemo, rng } from './generate'
import { BUILTIN_CATEGORIES, makeCategorizer } from '../tracking/categorize'
import { dayKey, dayStartMs } from '../time'

const RIYADH = { lat: 24.7136, lng: 46.6753 }
const NOW = new Date('2026-09-27T21:00:00+03:00').getTime()

describe('demo data', () => {
  it('is deterministic for a seed', () => {
    const a = generateDemo({ endDay: '2026-09-27', days: 3, now: NOW, coords: RIYADH, seed: 7 })
    const b = generateDemo({ endDay: '2026-09-27', days: 3, now: NOW, coords: RIYADH, seed: 7 })
    expect(a).toEqual(b)
    const r = rng(1)
    expect(r()).not.toBe(r())
  })

  it('generates well-formed, non-overlapping intervals within their day and before now', () => {
    const d = generateDemo({ endDay: '2026-09-27', days: 7, now: NOW, coords: RIYADH })
    expect(d.intervals.length).toBeGreaterThan(7 * 20)
    const sorted = [...d.intervals].sort((x, y) => x.start - y.start)
    for (let i = 0; i < sorted.length; i++) {
      const iv = sorted[i]!
      expect(iv.end).toBeGreaterThan(iv.start)
      expect(iv.end).toBeLessThanOrEqual(NOW)
      expect(dayKey(iv.start)).toBe(iv.day)
      expect(iv.start).toBeGreaterThanOrEqual(dayStartMs(iv.day))
      if (i > 0) expect(iv.start).toBeGreaterThanOrEqual(sorted[i - 1]!.end)
    }
  })

  it('covers every category with the default rules', () => {
    const cat = makeCategorizer([], BUILTIN_CATEGORIES)
    for (const [expected, apps] of Object.entries(DEMO_APPS)) {
      for (const a of apps) expect(cat(a)).toBe(expected)
    }
  })

  it('creates focus sessions, distractions and prayer history in the past only', () => {
    const d = generateDemo({ endDay: '2026-09-27', days: 30, now: NOW, coords: RIYADH })
    expect(d.sessions.length).toBeGreaterThan(10)
    expect(d.prayerLog.length).toBeGreaterThan(100)
    for (const s of d.sessions) expect(s.endedAt).toBeLessThanOrEqual(NOW)
    for (const p of d.prayerLog) expect(p.scheduledAt).toBeLessThanOrEqual(NOW)
    const ids = new Set(d.sessions.map((s) => s.id))
    for (const x of d.distractions) expect(ids.has(x.sessionId)).toBe(true)
    expect(new Set(d.prayerLog.map((p) => p.outcome)).size).toBeGreaterThan(2)
  })

  it('scales with density', () => {
    const base = generateDemo({ endDay: '2026-09-27', days: 5, now: NOW, coords: RIYADH })
    const heavy = generateDemo({
      endDay: '2026-09-27',
      days: 5,
      now: NOW,
      coords: RIYADH,
      density: 3
    })
    expect(heavy.intervals.length).toBeGreaterThan(base.intervals.length * 1.5)
  })
})
