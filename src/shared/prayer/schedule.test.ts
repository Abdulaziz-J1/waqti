import { describe, expect, it } from 'vitest'
import {
  RAMADAN_ISHA_OFFSET_MIN,
  SLOTS,
  buildDaySchedule,
  clampAdjustment,
  flattenSchedules,
  isPrayerId,
  isRamadanDay,
  nextEvent,
  previousEvent,
  schedulesAround
} from './schedule'
import { CITIES, findCity, isValidCoordinate } from './cities'
import { MINUTE } from '../time'

const RIYADH = { lat: 24.7136, lng: 46.6753 }
const JEDDAH = { lat: 21.4858, lng: 39.1925 }

/** HH:MM in Riyadh time, independent of the machine timezone. */
function hhmm(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(ms)
}

function table(city: { lat: number; lng: number }, day: string): Record<string, string> {
  const s = buildDaySchedule(day, city)
  return Object.fromEntries(SLOTS.map((k) => [k, hhmm(s.times[k])]))
}

describe('buildDaySchedule — regression snapshots (Umm al-Qura, Shafi Asr)', () => {
  it('Riyadh 2026-09-27', () => {
    expect(table(RIYADH, '2026-09-27')).toEqual({
      fajr: '04:26',
      sunrise: '05:44',
      dhuhr: '11:44',
      asr: '15:09',
      maghrib: '17:45',
      isha: '19:15'
    })
  })

  it('Riyadh 2026-06-21 (longest day)', () => {
    expect(table(RIYADH, '2026-06-21')).toEqual({
      fajr: '03:33',
      sunrise: '05:05',
      dhuhr: '11:55',
      asr: '15:16',
      maghrib: '18:45',
      isha: '20:15'
    })
  })

  it('Jeddah 2026-01-15', () => {
    expect(table(JEDDAH, '2026-01-15')).toEqual({
      fajr: '05:43',
      sunrise: '07:04',
      dhuhr: '12:33',
      asr: '15:40',
      maghrib: '18:02',
      isha: '19:32'
    })
  })

  it('Jeddah 2026-09-27', () => {
    expect(table(JEDDAH, '2026-09-27')).toEqual({
      fajr: '04:57',
      sunrise: '06:13',
      dhuhr: '12:14',
      asr: '15:38',
      maghrib: '18:15',
      isha: '19:45'
    })
  })
})

describe('ordering sanity', () => {
  it('Fajr < Sunrise < Dhuhr < Asr < Maghrib < Isha for every city across a year', () => {
    for (const city of CITIES) {
      for (const day of ['2026-01-01', '2026-03-20', '2026-06-21', '2026-09-23', '2026-12-21']) {
        const t = buildDaySchedule(day, city).times
        expect(t.fajr).toBeLessThan(t.sunrise)
        expect(t.sunrise).toBeLessThan(t.dhuhr)
        expect(t.dhuhr).toBeLessThan(t.asr)
        expect(t.asr).toBeLessThan(t.maghrib)
        expect(t.maghrib).toBeLessThan(t.isha)
      }
    }
  })
})

describe('Ramadan', () => {
  it('detects Ramadan with the Umm al-Qura calendar', () => {
    expect(isRamadanDay('2026-02-20')).toBe(true) // 3 Ramadan 1447
    expect(isRamadanDay('2026-09-27')).toBe(false)
    expect(isRamadanDay('2027-02-20')).toBe(true) // Ramadan 1448
  })

  it('adds 30 minutes to Isha (Isha = Maghrib + 120 min)', () => {
    const s = buildDaySchedule('2026-02-20', RIYADH)
    expect(s.isRamadan).toBe(true)
    expect((s.times.isha - s.times.maghrib) / MINUTE).toBe(90 + RAMADAN_ISHA_OFFSET_MIN)
    const normal = buildDaySchedule('2026-09-27', RIYADH)
    expect((normal.times.isha - normal.times.maghrib) / MINUTE).toBe(90)
  })

  it('keeps the Ramadan offset on top of a manual Isha adjustment', () => {
    const s = buildDaySchedule('2026-02-20', RIYADH, {
      fajr: 0,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 5,
      jumuah: 0
    })
    expect((s.times.isha - s.times.maghrib) / MINUTE).toBe(125)
  })
})

describe('Friday', () => {
  it('flags Fridays so Dhuhr becomes Jumuah', () => {
    expect(buildDaySchedule('2026-10-02', RIYADH).isFriday).toBe(true)
    expect(buildDaySchedule('2026-09-27', RIYADH).isFriday).toBe(false)
    const events = flattenSchedules([buildDaySchedule('2026-10-02', RIYADH)])
    expect(events.find((e) => e.slot === 'dhuhr')?.isJumuah).toBe(true)
    expect(events.filter((e) => e.isJumuah)).toHaveLength(1)
  })

  it("moves Friday's Dhuhr by the Jumu'ah adjustment only", () => {
    const adj = { fajr: 0, dhuhr: 4, asr: 0, maghrib: 0, isha: 0, jumuah: -10 }
    const fri = buildDaySchedule('2026-10-02', RIYADH)
    const sun = buildDaySchedule('2026-09-27', RIYADH)
    expect(buildDaySchedule('2026-10-02', RIYADH, adj).times.dhuhr - fri.times.dhuhr).toBe(
      -10 * MINUTE
    )
    expect(buildDaySchedule('2026-09-27', RIYADH, adj).times.dhuhr - sun.times.dhuhr).toBe(
      4 * MINUTE
    )
  })
})

describe('manual adjustments', () => {
  it('shifts each prayer by its own offset', () => {
    const base = buildDaySchedule('2026-09-27', RIYADH)
    const adj = buildDaySchedule('2026-09-27', RIYADH, {
      fajr: -5,
      dhuhr: 3,
      asr: 15,
      maghrib: -15,
      isha: 1,
      jumuah: 0
    })
    expect((adj.times.fajr - base.times.fajr) / MINUTE).toBe(-5)
    expect((adj.times.dhuhr - base.times.dhuhr) / MINUTE).toBe(3)
    expect((adj.times.asr - base.times.asr) / MINUTE).toBe(15)
    expect((adj.times.maghrib - base.times.maghrib) / MINUTE).toBe(-15)
    // adhan applies adjustments after the interval, so Isha moves only by its own offset.
    expect((adj.times.isha - base.times.isha) / MINUTE).toBe(1)
    expect(adj.times.sunrise).toBe(base.times.sunrise)
  })

  it('clamps adjustments to −15…+15 and rounds', () => {
    expect(clampAdjustment(40)).toBe(15)
    expect(clampAdjustment(-40)).toBe(-15)
    expect(clampAdjustment(2.6)).toBe(3)
    expect(clampAdjustment(Number.NaN)).toBe(0)
  })
})

describe('next / previous events', () => {
  const around = schedulesAround(new Date('2026-09-27T13:00:00+03:00').getTime(), RIYADH)

  it('builds yesterday, today and tomorrow', () => {
    expect(around.map((s) => s.day)).toEqual(['2026-09-26', '2026-09-27', '2026-09-28'])
  })

  it('finds the next prayer and skips sunrise when asked', () => {
    const now = new Date('2026-09-27T13:00:00+03:00').getTime()
    expect(nextEvent(around, now)?.slot).toBe('asr')
    const beforeSunrise = new Date('2026-09-27T05:00:00+03:00').getTime()
    expect(nextEvent(around, beforeSunrise)?.slot).toBe('sunrise')
    expect(nextEvent(around, beforeSunrise, true)?.slot).toBe('dhuhr')
    const afterIsha = new Date('2026-09-27T22:00:00+03:00').getTime()
    const n = nextEvent(around, afterIsha)
    expect(n?.slot).toBe('fajr')
    expect(n?.day).toBe('2026-09-28')
  })

  it('finds the previous prayer', () => {
    const now = new Date('2026-09-27T13:00:00+03:00').getTime()
    expect(previousEvent(around, now)?.slot).toBe('dhuhr')
    const early = new Date('2026-09-27T06:00:00+03:00').getTime()
    expect(previousEvent(around, early)?.slot).toBe('sunrise')
    expect(previousEvent(around, early, true)?.slot).toBe('fajr')
  })

  it('returns null outside the covered range', () => {
    expect(nextEvent(around, Date.UTC(2030, 0, 1))).toBeNull()
    expect(previousEvent(around, Date.UTC(2020, 0, 1))).toBeNull()
  })

  it('identifies lockable prayers', () => {
    expect(isPrayerId('sunrise')).toBe(false)
    expect(isPrayerId('asr')).toBe(true)
  })
})

describe('cities', () => {
  it('ships the 13 region capitals plus the major cities, with unique ids', () => {
    expect(CITIES).toHaveLength(19)
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(19)
    for (const c of CITIES) {
      // Every city is inside Saudi Arabia's bounding box.
      expect(c.lat).toBeGreaterThan(16)
      expect(c.lat).toBeLessThan(32.2)
      expect(c.lng).toBeGreaterThan(34.5)
      expect(c.lng).toBeLessThan(55.7)
    }
    expect(findCity('jeddah')?.name).toBe('جدة')
    expect(findCity('nowhere')).toBeUndefined()
  })

  it('validates custom coordinates', () => {
    expect(isValidCoordinate(24.7, 46.7)).toBe(true)
    expect(isValidCoordinate(95, 46.7)).toBe(false)
    expect(isValidCoordinate(24.7, 200)).toBe(false)
    expect(isValidCoordinate(Number.NaN, 1)).toBe(false)
  })
})
