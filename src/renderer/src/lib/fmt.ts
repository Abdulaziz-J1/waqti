import { useMemo } from 'react'
import * as F from '@shared/format'
import type { DurationOptions, FormatPrefs } from '@shared/format'
import { useSettings } from './store'

/** Formatters bound to the user's digit and clock preferences. */
export function useFmt() {
  const { digits, clock } = useSettings().general
  return useMemo(() => {
    const prefs: FormatPrefs = { digits, clock }
    return {
      prefs,
      digits,
      num: (n: number, o?: Intl.NumberFormatOptions) => F.fmtNum(n, digits, o),
      pct: (r: number) => F.fmtPercent(r, digits),
      dur: (ms: number, o?: DurationOptions) => F.fmtDuration(ms, digits, o),
      durShort: (ms: number) => F.fmtDurationShort(ms, digits),
      hoursAxis: (ms: number) => F.fmtHoursAxis(ms, digits),
      clock: (at: number) => F.fmtClock(at, prefs),
      hour: (h: number) => F.fmtHourLabel(h, prefs),
      countdown: (ms: number) => F.fmtCountdown(ms, digits),
      hijri: (at: number) => F.fmtHijri(at, digits),
      gregorian: (at: number) => F.fmtGregorian(at, digits),
      dayMonth: (at: number) => F.fmtDayMonth(at, digits),
      weekday: (at: number) => F.fmtWeekday(at),
      dayAxis: (day: string, long: boolean) => F.fmtDayAxis(day, digits, long),
      dayRange: (from: string, to: string) => F.fmtDayRange(from, to, digits),
      minutes: (n: number, c?: F.GramCase) => F.minutesPhrase(n, digits, c),
      hours: (n: number, c?: F.GramCase) => F.hoursPhrase(n, digits, c),
      days: (n: number, c?: F.GramCase) => F.daysPhrase(n, digits, c),
      sessions: (n: number, c?: F.GramCase) => F.sessionsPhrase(n, digits, c),
      times: (n: number, c?: F.GramCase) => F.timesPhrase(n, digits, c),
      compare: (cur: number, prev: number, label: string) => F.fmtCompare(cur, prev, label, digits),
      digitsOf: (s: string) => F.localizeDigits(s, digits)
    }
  }, [digits, clock])
}

export type Fmt = ReturnType<typeof useFmt>
