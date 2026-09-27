import { describe, expect, it } from 'vitest'
import {
  addDays,
  clamp,
  dayEndMs,
  dayKey,
  dayStartMs,
  daysBetween,
  isFriday,
  minutesOfDay,
  weekday
} from './time'

describe('time helpers', () => {
  it('computes local day keys', () => {
    expect(dayKey(new Date('2026-09-27T23:59:00+03:00'))).toBe('2026-09-27')
    expect(dayKey(new Date('2026-09-28T00:00:00+03:00').getTime())).toBe('2026-09-28')
  })

  it('handles month and year rollovers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('computes day bounds', () => {
    expect(dayEndMs('2026-09-27') - dayStartMs('2026-09-27')).toBe(24 * 3600 * 1000)
    expect(new Date(dayStartMs('2026-09-27')).getHours()).toBe(0)
  })

  it('lists days inclusively', () => {
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02'
    ])
    expect(daysBetween('2026-10-02', '2026-10-01')).toEqual([])
  })

  it('knows weekdays and Fridays', () => {
    expect(weekday('2026-09-27')).toBe(0)
    expect(isFriday('2026-10-02')).toBe(true)
    expect(isFriday('2026-10-03')).toBe(false)
  })

  it('computes minutes of day and clamps', () => {
    expect(minutesOfDay(new Date('2026-09-27T01:30:30+03:00').getTime())).toBe(90.5)
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
  })
})
