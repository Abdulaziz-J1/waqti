import { describe, expect, it } from 'vitest'
import {
  countPhrase,
  daysPhrase,
  fmt2,
  fmtClock,
  fmtCompare,
  fmtCountdown,
  fmtDayAxis,
  fmtDayMonth,
  fmtDayRange,
  fmtDuration,
  fmtDurationShort,
  fmtGregorian,
  fmtHijri,
  fmtHourLabel,
  fmtHoursAxis,
  fmtNum,
  fmtPercent,
  fmtWeekday,
  hijriParts,
  hoursPhrase,
  localizeDigits,
  minutesPhrase,
  sessionsPhrase,
  timesPhrase,
  withBi
} from './format'
import { HOUR, MINUTE, SECOND } from './time'
import { units } from './strings'

const at = (iso: string): number => new Date(iso).getTime()

describe('digits', () => {
  it('formats Arabic-Indic and Latin digits through Intl', () => {
    expect(fmtNum(2026, 'arab')).toBe('٢٠٢٦')
    expect(fmtNum(2026, 'latn')).toBe('2026')
    expect(fmt2(5, 'arab')).toBe('٠٥')
    expect(fmt2(5, 'latn')).toBe('05')
  })

  it('localizes digits inside arbitrary strings', () => {
    expect(localizeDigits('10:05', 'arab')).toBe('١٠:٠٥')
    expect(localizeDigits('10:05', 'latn')).toBe('10:05')
  })

  it('formats percentages', () => {
    expect(fmtPercent(0.35, 'latn')).toContain('35')
    expect(fmtPercent(0.35, 'arab')).toContain('٣٥')
  })
})

describe('plurals — minutes', () => {
  it('uses the one / two / few / many / other forms', () => {
    expect(minutesPhrase(1, 'arab')).toBe('دقيقة')
    expect(minutesPhrase(2, 'arab')).toBe('دقيقتان')
    expect(minutesPhrase(3, 'arab')).toBe('٣ دقائق')
    expect(minutesPhrase(10, 'arab')).toBe('١٠ دقائق')
    expect(minutesPhrase(11, 'arab')).toBe('١١ دقيقة')
    expect(minutesPhrase(45, 'arab')).toBe('٤٥ دقيقة')
    expect(minutesPhrase(100, 'arab')).toBe('١٠٠ دقيقة')
    expect(minutesPhrase(103, 'arab')).toBe('١٠٣ دقائق')
    expect(minutesPhrase(0, 'arab')).toBe('٠ دقيقة')
  })

  it('uses the oblique dual after prepositions', () => {
    expect(minutesPhrase(2, 'arab', 'obl')).toBe('دقيقتين')
    expect(minutesPhrase(5, 'latn', 'obl')).toBe('5 دقائق')
  })
})

describe('plurals — hours, days, sessions, times', () => {
  it('hours', () => {
    expect(hoursPhrase(1, 'arab')).toBe('ساعة')
    expect(hoursPhrase(2, 'arab')).toBe('ساعتان')
    expect(hoursPhrase(2, 'arab', 'obl')).toBe('ساعتين')
    expect(hoursPhrase(3, 'arab')).toBe('٣ ساعات')
    expect(hoursPhrase(11, 'arab')).toBe('١١ ساعة')
    expect(hoursPhrase(120, 'latn')).toBe('120 ساعة')
  })

  it('days', () => {
    expect(daysPhrase(1, 'arab')).toBe('يوم')
    expect(daysPhrase(2, 'arab')).toBe('يومان')
    expect(daysPhrase(7, 'arab')).toBe('٧ أيام')
    expect(daysPhrase(30, 'arab')).toBe('٣٠ يومًا')
    expect(daysPhrase(365, 'arab')).toBe('٣٦٥ يومًا')
    expect(daysPhrase(100, 'arab')).toBe('١٠٠ يوم')
  })

  it('sessions and times', () => {
    expect(sessionsPhrase(1, 'arab')).toBe('جلسة')
    expect(sessionsPhrase(4, 'arab')).toBe('٤ جلسات')
    expect(timesPhrase(2, 'arab')).toBe('مرتان')
    expect(timesPhrase(12, 'arab')).toBe('١٢ مرة')
  })

  it('falls back to the many form when a unit has no other form', () => {
    expect(countPhrase(100, units.hour, 'latn')).toBe('100 ساعة')
  })
})

describe('durations', () => {
  it('reads combined durations naturally', () => {
    expect(fmtDuration(2 * HOUR + 15 * MINUTE, 'arab')).toBe('ساعتان و١٥ دقيقة')
    expect(fmtDuration(HOUR + 3 * MINUTE, 'arab')).toBe('ساعة و٣ دقائق')
    expect(fmtDuration(3 * HOUR + 2 * MINUTE, 'arab')).toBe('٣ ساعات ودقيقتان')
    expect(fmtDuration(HOUR + MINUTE, 'arab')).toBe('ساعة ودقيقة')
    expect(fmtDuration(HOUR, 'arab')).toBe('ساعة')
    expect(fmtDuration(25 * MINUTE, 'arab')).toBe('٢٥ دقيقة')
    expect(fmtDuration(2 * HOUR + 15 * MINUTE, 'latn')).toBe('ساعتان و15 دقيقة')
  })

  it('says "less than a minute" under one minute', () => {
    expect(fmtDuration(30 * SECOND, 'arab')).toBe('أقل من دقيقة')
    expect(fmtDuration(0, 'arab')).toBe('٠ دقيقة')
    expect(fmtDuration(-5, 'arab')).toBe('٠ دقيقة')
  })

  it('supports rounding modes and the oblique case', () => {
    expect(fmtDuration(9 * MINUTE + 30 * SECOND, 'arab', { round: 'ceil' })).toBe('١٠ دقائق')
    expect(fmtDuration(9 * MINUTE + 30 * SECOND, 'arab')).toBe('٩ دقائق')
    expect(fmtDuration(2 * HOUR, 'arab', { gramCase: 'obl' })).toBe('ساعتين')
    expect(fmtDuration(30 * SECOND, 'arab', { round: 'ceil' })).toBe('دقيقة')
  })

  it('formats compact durations for charts', () => {
    expect(fmtDurationShort(2 * HOUR + 15 * MINUTE, 'arab')).toBe('٢ س ١٥ د')
    expect(fmtDurationShort(45 * MINUTE, 'arab')).toBe('٤٥ د')
    expect(fmtDurationShort(3 * HOUR, 'latn')).toBe('3 س')
    expect(fmtHoursAxis(2.5 * HOUR, 'latn')).toBe('2.5 س')
    expect(fmtHoursAxis(12 * HOUR, 'arab')).toBe('١٢ س')
  })

  it('attaches the preposition ب correctly', () => {
    expect(withBi('ساعتين')).toBe('بساعتين')
    expect(withBi('٣ ساعات')).toBe('بـ٣ ساعات')
    expect(withBi('3 ساعات')).toBe('بـ3 ساعات')
  })

  it('formats odometer countdowns', () => {
    expect(fmtCountdown(23 * MINUTE + 5 * SECOND, 'arab')).toBe('٢٣:٠٥')
    expect(fmtCountdown(HOUR + 2 * MINUTE + 5 * SECOND, 'latn')).toBe('1:02:05')
    expect(fmtCountdown(400, 'latn')).toBe('00:01')
    expect(fmtCountdown(-1000, 'latn')).toBe('00:00')
  })
})

describe('clock', () => {
  it('defaults to 12h with ص / م', () => {
    const prefs = { digits: 'arab', clock: '12h' } as const
    expect(fmtClock(at('2026-09-27T15:09:00+03:00'), prefs)).toBe('٣:٠٩ م')
    expect(fmtClock(at('2026-09-27T04:26:00+03:00'), prefs)).toBe('٤:٢٦ ص')
    expect(fmtClock(at('2026-09-27T00:05:00+03:00'), prefs)).toBe('١٢:٠٥ ص')
    expect(fmtClock(at('2026-09-27T12:00:00+03:00'), prefs)).toBe('١٢:٠٠ م')
  })

  it('supports 24h and Latin digits', () => {
    expect(fmtClock(at('2026-09-27T15:09:00+03:00'), { digits: 'latn', clock: '24h' })).toBe(
      '15:09'
    )
    expect(fmtClock(at('2026-09-27T04:06:00+03:00'), { digits: 'arab', clock: '24h' })).toBe(
      '٠٤:٠٦'
    )
  })

  it('formats hour labels', () => {
    expect(fmtHourLabel(15, { digits: 'arab', clock: '12h' })).toBe('٣ م')
    expect(fmtHourLabel(0, { digits: 'latn', clock: '12h' })).toBe('12 ص')
    expect(fmtHourLabel(24, { digits: 'latn', clock: '24h' })).toBe('00')
  })
})

describe('dates', () => {
  const sep27 = at('2026-09-27T12:00:00+03:00')

  it('formats Umm al-Qura Hijri dates', () => {
    expect(fmtHijri(sep27, 'arab')).toBe('١٦ ربيع الآخر ١٤٤٨ هـ')
    expect(fmtHijri(sep27, 'latn')).toBe('16 ربيع الآخر 1448 هـ')
    expect(hijriParts(sep27)).toEqual({ year: 1448, month: 4, day: 16 })
    expect(hijriParts(at('2026-02-20T12:00:00+03:00')).month).toBe(9)
  })

  it('formats Gregorian dates in Arabic', () => {
    expect(fmtGregorian(sep27, 'arab')).toBe('الأحد، ٢٧ سبتمبر ٢٠٢٦')
    expect(fmtDayMonth(sep27, 'latn')).toBe('27 سبتمبر')
    expect(fmtWeekday(sep27)).toBe('الأحد')
  })

  it('formats axis labels and ranges', () => {
    expect(fmtDayAxis('2026-09-27', 'arab', false)).toBe('الأحد')
    expect(fmtDayAxis('2026-09-27', 'arab', true)).toBe('٢٧/٩')
    expect(fmtDayRange('2026-09-21', '2026-09-27', 'arab')).toBe('٢١ – ٢٧ سبتمبر')
    expect(fmtDayRange('2026-08-29', '2026-09-27', 'latn')).toBe('29 أغسطس – 27 سبتمبر')
    expect(fmtDayRange('2026-09-27', '2026-09-27', 'latn')).toBe('27 سبتمبر')
  })
})

describe('period comparison', () => {
  it('describes less, more and about the same', () => {
    expect(fmtCompare(HOUR, 3 * HOUR, 'الأسبوع الماضي', 'arab')).toBe(
      'أقل من الأسبوع الماضي بساعتين'
    )
    expect(fmtCompare(4 * HOUR, HOUR, 'أمس', 'arab')).toBe('أكثر من أمس بـ٣ ساعات')
    expect(fmtCompare(HOUR + 30 * MINUTE, HOUR, 'أمس', 'arab')).toBe('أكثر من أمس بـ٣٠ دقيقة')
    expect(fmtCompare(HOUR, HOUR + 2 * MINUTE, 'الشهر الماضي', 'arab')).toBe('قريب من الشهر الماضي')
  })

  it('explains when there is nothing to compare with', () => {
    expect(fmtCompare(HOUR, 0, 'أمس', 'arab')).toBe('ما عندنا بيانات عن أمس للمقارنة')
  })
})
