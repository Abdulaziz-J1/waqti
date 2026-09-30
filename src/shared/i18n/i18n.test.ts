import { afterEach, describe, expect, it } from 'vitest'
import {
  fmtClock,
  fmtCompare,
  fmtDayRange,
  fmtDuration,
  fmtDurationShort,
  fmtGregorian,
  fmtHijri,
  fmtNum,
  minutesPhrase
} from '../format'
import { fmtHms } from '../focus'
import { dirOf, lang, nav, setLanguage } from '../strings'
import { HOUR, MINUTE } from '../time'
import { ar } from './ar'
import { en } from './en'

/** Every key path of a bundle, with the kind of value found there. */
function shape(v: unknown, path = ''): string[] {
  if (typeof v === 'function') return [`${path}:fn`]
  if (typeof v === 'string') return [`${path}:str`]
  if (Array.isArray(v)) return [`${path}:arr${v.length}`]
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => shape(x, `${path}.${k}`))
}

afterEach(() => setLanguage('ar'))

describe('language bundles', () => {
  it('English has exactly the Arabic keys, with the same kinds of values', () => {
    expect(shape(en)).toEqual(shape(ar))
  })

  it('switches every section at once and knows the reading direction', () => {
    expect(nav.today).toBe('اليوم')
    setLanguage('en')
    expect(lang).toBe('en')
    expect(nav.today).toBe('Today')
    expect(dirOf('ar')).toBe('rtl')
    expect(dirOf('en')).toBe('ltr')
  })
})

describe('English formatting', () => {
  it('writes durations and plurals in English with Western digits', () => {
    setLanguage('en')
    expect(minutesPhrase(1, 'arab')).toBe('1 minute')
    expect(minutesPhrase(25, 'arab')).toBe('25 minutes')
    expect(fmtDuration(90 * MINUTE, 'arab')).toBe('1 hour 30 minutes')
    expect(fmtDuration(2 * HOUR, 'latn')).toBe('2 hours')
    expect(fmtDuration(20_000, 'latn')).toBe('less than a minute')
    expect(fmtDurationShort(75 * MINUTE, 'arab')).toBe('1 h 15 min')
    expect(fmtNum(1234, 'arab')).toBe('1234')
    expect(fmtHms(1800, 'arab')).toBe('00:30:00')
  })

  it('writes clock times, dates and comparisons in English', () => {
    setLanguage('en')
    const at = new Date(2026, 9, 1, 15, 5).getTime()
    expect(fmtClock(at, { digits: 'arab', clock: '12h' })).toBe('3:05 PM')
    expect(fmtClock(at, { digits: 'arab', clock: '24h' })).toBe('15:05')
    expect(fmtGregorian(at, 'arab')).toBe('Thursday, October 1, 2026')
    expect(fmtHijri(at, 'arab')).toMatch(/1448 AH$/)
    expect(fmtDayRange('2026-09-21', '2026-09-27', 'latn')).toBe('September 21 – 27')
    expect(fmtCompare(3 * HOUR, 5 * HOUR, 'last week', 'latn')).toBe(
      'Less than last week by 2 hours'
    )
  })

  it('keeps Arabic as it was', () => {
    expect(fmtDuration(90 * MINUTE, 'arab')).toBe('ساعة و٣٠ دقيقة')
    expect(fmtDuration(2 * HOUR, 'arab')).toBe('ساعتان')
  })
})
