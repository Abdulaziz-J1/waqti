import { describe, expect, it } from 'vitest'
import { dueBetween, prayersBetween, recentPrayer, refForToday } from './due'
import { buildDaySchedule } from './schedule'
import { applyPatch, defaultSettings } from '../settings/schema'
import { MINUTE } from '../time'

const RIYADH = { lat: 24.7136, lng: 46.6753 }
const sunday = buildDaySchedule('2026-09-27', RIYADH)
const friday = buildDaySchedule('2026-10-02', RIYADH)
const s = defaultSettings()

describe('due events', () => {
  it('fires the pre-reminder and the prayer exactly once across ticks', () => {
    const asr = sunday.times.asr
    const pre = dueBetween([sunday], s, asr - 10 * MINUTE - 1000, asr - 10 * MINUTE)
    expect(pre).toEqual([
      {
        kind: 'pre',
        fireAt: asr - 10 * MINUTE,
        ref: { prayer: 'asr', day: '2026-09-27', at: asr, isJumuah: false },
        minutesBefore: 10
      }
    ])
    expect(dueBetween([sunday], s, asr - 10 * MINUTE, asr - 10 * MINUTE + 1000)).toEqual([])
    const at = dueBetween([sunday], s, asr - 1000, asr)
    expect(at.map((e) => e.kind)).toEqual(['prayer'])
  })

  it('never fires sunrise', () => {
    const r = dueBetween(
      [sunday],
      s,
      sunday.times.sunrise - 20 * MINUTE,
      sunday.times.sunrise + MINUTE
    )
    expect(r).toEqual([])
  })

  it('uses the Friday reminder for Jumuah', () => {
    const dhuhr = friday.times.dhuhr
    const r = dueBetween([friday], s, dhuhr - 46 * MINUTE, dhuhr)
    expect(r.map((e) => [e.kind, e.fireAt === dhuhr - 45 * MINUTE || e.fireAt === dhuhr])).toEqual([
      ['pre', true],
      ['prayer', true]
    ])
    expect(r[1]!.ref.isJumuah).toBe(true)
  })

  it('skips reminders set to 0 and empty windows', () => {
    const none = applyPatch(s, { reminderMinutes: 0 })
    const asr = sunday.times.asr
    expect(dueBetween([sunday], none, asr - 11 * MINUTE, asr - 9 * MINUTE)).toEqual([])
    expect(dueBetween([sunday], s, asr, asr)).toEqual([])
  })

  it('returns events in chronological order over a long window', () => {
    const r = dueBetween([sunday], s, sunday.times.fajr - 60 * MINUTE, sunday.times.isha + 1)
    expect(r.filter((e) => e.kind === 'prayer').map((e) => e.ref.prayer)).toEqual([
      'fajr',
      'dhuhr',
      'asr',
      'maghrib',
      'isha'
    ])
    for (let i = 1; i < r.length; i++) expect(r[i]!.fireAt).toBeGreaterThanOrEqual(r[i - 1]!.fireAt)
  })
})

describe('missed and recent prayers', () => {
  it('lists prayers that passed while asleep with their plans', () => {
    const m = prayersBetween(
      [sunday],
      applyPatch(s, { prayers: { maghrib: { lock: false } } }),
      sunday.times.asr - 1,
      sunday.times.maghrib
    )
    expect(m.map((x) => [x.ref.prayer, x.plan === null])).toEqual([
      ['asr', false],
      ['maghrib', true]
    ])
  })

  it('finds the latest prayer within the startup window', () => {
    const asr = sunday.times.asr
    expect(recentPrayer([sunday], s, asr + 4 * MINUTE, 10 * MINUTE)?.ref.prayer).toBe('asr')
    expect(recentPrayer([sunday], s, asr + 11 * MINUTE, 10 * MINUTE)).toBeNull()
  })

  it('builds a ref for today', () => {
    expect(refForToday(friday, 'dhuhr', 5).isJumuah).toBe(true)
    expect(refForToday(sunday, 'dhuhr', 5).isJumuah).toBe(false)
  })
})
