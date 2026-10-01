import { describe, expect, it } from 'vitest'
import { dueBetween, lockDuring, prayersBetween, recentPrayer, refForToday } from './due'
import { buildDaySchedule } from './schedule'
import { applyPatch, defaultSettings } from '../settings/schema'
import { MINUTE } from '../time'

const RIYADH = { lat: 24.7136, lng: 46.6753 }
const sunday = buildDaySchedule('2026-09-27', RIYADH)
const friday = buildDaySchedule('2026-10-02', RIYADH)
const ramadanDay = buildDaySchedule('2027-02-15', RIYADH)
const s = defaultSettings()
const kinds = (from: number, to: number, settings = s, day = sunday): string[] =>
  dueBetween([day], settings, from, to).map((e) => e.kind)

describe('due events', () => {
  it('fires the notice at the adhan and the lock at the iqama, with no reminder before', () => {
    const asr = sunday.times.asr
    const ref = {
      prayer: 'asr',
      day: '2026-09-27',
      at: asr + 20 * MINUTE,
      adhanAt: asr,
      isJumuah: false
    }
    expect(dueBetween([sunday], s, asr - 60 * MINUTE, asr - 1000)).toEqual([])
    expect(dueBetween([sunday], s, asr - 1000, asr)).toEqual([{ kind: 'adhan', fireAt: asr, ref }])
    expect(dueBetween([sunday], s, asr, asr + 20 * MINUTE - 1000)).toEqual([])
    expect(dueBetween([sunday], s, asr + 20 * MINUTE - 1000, asr + 20 * MINUTE)).toEqual([
      { kind: 'prayer', fireAt: asr + 20 * MINUTE, ref }
    ])
  })

  it('uses each prayer’s own iqama delay', () => {
    const at = (p: 'fajr' | 'dhuhr' | 'maghrib' | 'isha'): number =>
      dueBetween([sunday], s, sunday.times.fajr - 1, sunday.times.isha + 30 * MINUTE).find(
        (e) => e.kind === 'prayer' && e.ref.prayer === p
      )!.fireAt - sunday.times[p]
    expect([at('fajr'), at('dhuhr'), at('maghrib'), at('isha')]).toEqual([
      25 * MINUTE,
      20 * MINUTE,
      10 * MINUTE,
      20 * MINUTE
    ])
  })

  it('shows the adhan notice only when it adds something', () => {
    const asr = sunday.times.asr
    // A prayer that does not lock: the notice, then the (lock-less) prayer event at the adhan.
    expect(kinds(asr - 1000, asr, applyPatch(s, { prayers: { asr: { lock: false } } }))).toEqual([
      'adhan',
      'prayer'
    ])
    // Locking with the adhan: the lock itself announces it.
    expect(
      kinds(asr - 1000, asr, applyPatch(s, { prayers: { asr: { lockDelayMinutes: 0 } } }))
    ).toEqual(['prayer'])
    // Turned off: nothing at the adhan, the lock still comes at the iqama.
    const off = applyPatch(s, { adhanNotice: false })
    expect(kinds(asr - 1000, asr, off)).toEqual([])
    expect(kinds(asr + 20 * MINUTE - 1000, asr + 20 * MINUTE, off)).toEqual(['prayer'])
  })

  it('uses the Ramadan iqama for Fajr and Maghrib only', () => {
    expect(ramadanDay.isRamadan).toBe(true)
    const events = dueBetween(
      [ramadanDay],
      s,
      ramadanDay.times.fajr - 1,
      ramadanDay.times.isha + 30 * MINUTE
    ).filter((e) => e.kind === 'prayer')
    const delay = (p: string): number => {
      const e = events.find((x) => x.ref.prayer === p)!
      return e.ref.at - e.ref.adhanAt
    }
    expect([delay('fajr'), delay('dhuhr'), delay('maghrib')]).toEqual([
      20 * MINUTE,
      20 * MINUTE,
      15 * MINUTE
    ])
    const changed = applyPatch(s, { ramadanLockDelay: { maghrib: 20 } })
    const m = dueBetween([ramadanDay], changed, ramadanDay.times.maghrib, ramadanDay.times.isha)
    expect(m.find((e) => e.kind === 'prayer')?.fireAt).toBe(ramadanDay.times.maghrib + 20 * MINUTE)
  })

  it('never locks at sunrise: only its notice', () => {
    expect(kinds(sunday.times.sunrise - 20 * MINUTE, sunday.times.sunrise + MINUTE)).toEqual([
      'sunrise'
    ])
  })

  it('locks Jumuah with its adhan, after the Friday reminder', () => {
    const dhuhr = friday.times.dhuhr
    const r = dueBetween([friday], s, dhuhr - 46 * MINUTE, dhuhr)
    expect(r.map((e) => [e.kind, e.fireAt === dhuhr - 45 * MINUTE || e.fireAt === dhuhr])).toEqual([
      ['pre', true],
      ['prayer', true]
    ])
    const lock = r[1]!
    if (lock.kind !== 'prayer') throw new Error(lock.kind)
    expect(lock.ref.isJumuah).toBe(true)
  })

  it('gives notice before sunrise, the end of Fajr, as configured', () => {
    const sunrise = sunday.times.sunrise
    const at = (settings = s) =>
      dueBetween([sunday], settings, sunrise - 61 * MINUTE, sunrise).filter(
        (e) => e.kind === 'sunrise'
      )
    // 15 minutes before by default.
    expect(at()).toEqual([{ kind: 'sunrise', fireAt: sunrise - 15 * MINUTE, sunriseAt: sunrise }])
    // At sunrise itself, or not at all.
    expect(at(applyPatch(s, { sunrise: { minutesBefore: 0 } }))[0]?.fireAt).toBe(sunrise)
    expect(at(applyPatch(s, { sunrise: { notice: false } }))).toEqual([])
  })

  it('skips the Friday reminder set to 0, and empty windows', () => {
    const none = applyPatch(s, { friday: { reminderMinutes: 0 } })
    const dhuhr = friday.times.dhuhr
    expect(kinds(dhuhr - 46 * MINUTE, dhuhr - 44 * MINUTE, none, friday)).toEqual([])
    expect(dueBetween([sunday], s, sunday.times.asr, sunday.times.asr)).toEqual([])
  })

  it('returns events in chronological order over a long window', () => {
    const r = dueBetween(
      [sunday],
      s,
      sunday.times.fajr - 60 * MINUTE,
      sunday.times.isha + 21 * MINUTE
    )
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
  it('lists prayers whose lock time passed while asleep, with their plans', () => {
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
    // Asr locks at its iqama, 20 minutes after the adhan.
    expect(prayersBetween([sunday], s, sunday.times.asr, sunday.times.asr + 19 * MINUTE)).toEqual(
      []
    )
  })

  it('finds the latest prayer whose lock time is within the startup window', () => {
    const iqama = sunday.times.asr + 20 * MINUTE
    expect(recentPrayer([sunday], s, sunday.times.asr + 4 * MINUTE, 10 * MINUTE)).toBeNull()
    expect(recentPrayer([sunday], s, iqama + 4 * MINUTE, 10 * MINUTE)?.ref.prayer).toBe('asr')
    expect(recentPrayer([sunday], s, iqama + 11 * MINUTE, 10 * MINUTE)).toBeNull()
  })

  it('finds the first lock a focus session would run into', () => {
    const asr = sunday.times.asr
    const iqama = asr + 20 * MINUTE
    const hit = lockDuring([sunday], s, asr - 30 * MINUTE, asr + 30 * MINUTE)
    expect(hit).toMatchObject({ prayer: 'asr', adhanAt: asr, at: iqama })
    // Ends before the iqama: the session never pauses.
    expect(lockDuring([sunday], s, asr - 30 * MINUTE, iqama - MINUTE)).toBeNull()
    // A prayer without a lock does not interrupt a session.
    const noAsr = applyPatch(s, { prayers: { asr: { lock: false } } })
    expect(lockDuring([sunday], noAsr, asr - 30 * MINUTE, asr + 30 * MINUTE)).toBeNull()
  })

  it('builds a ref for today whose adhan and lock are the same moment', () => {
    expect(refForToday(friday, 'dhuhr', 5)).toMatchObject({ isJumuah: true, at: 5, adhanAt: 5 })
    expect(refForToday(sunday, 'dhuhr', 5).isJumuah).toBe(false)
  })
})
