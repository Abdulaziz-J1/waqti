import { HOUR, MINUTE, SECOND, type DayKey, dayStart } from './time'
import { compare as compareStrings, lang, units } from './strings'

export type Digits = 'arab' | 'latn'
export type ClockStyle = '12h' | '24h'
/** Grammatical case for dual forms: nominative (ساعتان) or oblique after a preposition (ساعتين). */
export type GramCase = 'nom' | 'obl'

export interface FormatPrefs {
  digits: Digits
  clock: ClockStyle
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const numberFormats = new Map<string, Intl.NumberFormat>()

/** English always uses Western digits; the ٠١٢ / 012 choice is for Arabic. */
function digitsFor(digits: Digits): Digits {
  return lang === 'en' ? 'latn' : digits
}

/** The Intl locale of the interface language. */
function localeBase(): string {
  return lang === 'en' ? 'en-US' : 'ar-SA'
}

function numberFormat(digits: Digits, opts: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const d = digitsFor(digits)
  const key = `${lang}|${d}|${JSON.stringify(opts)}`
  let nf = numberFormats.get(key)
  if (!nf) {
    nf = new Intl.NumberFormat(`${localeBase()}-u-nu-${d}`, { useGrouping: false, ...opts })
    numberFormats.set(key, nf)
  }
  return nf
}

/** Formats a number with Arabic-Indic (٠١٢) or Latin (012) digits. */
export function fmtNum(n: number, digits: Digits, opts?: Intl.NumberFormatOptions): string {
  return numberFormat(digits, opts).format(n)
}

/** Two-digit zero-padded integer (05 / ٠٥). */
export function fmt2(n: number, digits: Digits): string {
  return numberFormat(digits, { minimumIntegerDigits: 2, useGrouping: false }).format(n)
}

export function fmtPercent(ratio: number, digits: Digits): string {
  return numberFormat(digits, { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
}

/** Replaces ASCII digits in an arbitrary string with the chosen digit set. */
export function localizeDigits(s: string, digits: Digits): string {
  if (digitsFor(digits) === 'latn') return s
  return s.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)))
}

// ---------------------------------------------------------------------------
// Plurals
// ---------------------------------------------------------------------------

const pluralRules = { ar: new Intl.PluralRules('ar'), en: new Intl.PluralRules('en') }

interface UnitForms {
  one: string
  two: string
  twoOblique: string
  few: string
  many: string
  other?: string
}

/**
 * Count phrase. Arabic: دقيقة / دقيقتان / ٣ دقائق / ١١ دقيقة / ١٠٠ دقيقة.
 * English: 1 minute / 2 minutes.
 */
export function countPhrase(
  n: number,
  forms: UnitForms,
  digits: Digits,
  gramCase: GramCase = 'nom'
): string {
  if (lang === 'en') {
    return `${fmtNum(n, digits)} ${pluralRules.en.select(n) === 'one' ? forms.one : forms.many}`
  }
  const cat = pluralRules.ar.select(n)
  switch (cat) {
    case 'one':
      return forms.one
    case 'two':
      return gramCase === 'obl' ? forms.twoOblique : forms.two
    case 'few':
      return `${fmtNum(n, digits)} ${forms.few}`
    case 'many':
      return `${fmtNum(n, digits)} ${forms.many}`
    default:
      return `${fmtNum(n, digits)} ${forms.other ?? forms.many}`
  }
}

export const minutesPhrase = (n: number, digits: Digits, c: GramCase = 'nom'): string =>
  countPhrase(n, units.minute, digits, c)
export const hoursPhrase = (n: number, digits: Digits, c: GramCase = 'nom'): string =>
  countPhrase(n, units.hour, digits, c)
export const daysPhrase = (n: number, digits: Digits, c: GramCase = 'nom'): string =>
  countPhrase(n, units.day, digits, c)
export const sessionsPhrase = (n: number, digits: Digits, c: GramCase = 'nom'): string =>
  countPhrase(n, units.session, digits, c)
export const timesPhrase = (n: number, digits: Digits, c: GramCase = 'nom'): string =>
  countPhrase(n, units.time, digits, c)

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

export interface DurationOptions {
  gramCase?: GramCase
  /** How to turn milliseconds into whole minutes. Default `floor` (usage totals). */
  round?: 'floor' | 'ceil' | 'round'
}

/**
 * Natural Arabic duration: "أقل من دقيقة", "٥ دقائق", "ساعة", "ساعتان و١٥ دقيقة".
 */
export function fmtDuration(ms: number, digits: Digits, opts: DurationOptions = {}): string {
  const { gramCase = 'nom', round = 'floor' } = opts
  const safe = Math.max(0, ms)
  const totalMin = Math[round](safe / MINUTE)
  if (totalMin === 0) {
    return safe > 0 ? units.lessThanMinute : `${fmtNum(0, digits)} ${units.minute.many}`
  }
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const parts: string[] = []
  if (h > 0) parts.push(hoursPhrase(h, digits, gramCase))
  if (m > 0) parts.push(minutesPhrase(m, digits, gramCase))
  return parts.join(units.and)
}

/** Compact duration for chart ticks and dense tables: "٢ س ١٥ د", "٤٥ د". */
export function fmtDurationShort(ms: number, digits: Digits): string {
  const totalMin = Math.floor(Math.max(0, ms) / MINUTE)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${fmtNum(m, digits)} ${units.minuteShort}`
  if (m === 0) return `${fmtNum(h, digits)} ${units.hourShort}`
  return `${fmtNum(h, digits)} ${units.hourShort} ${fmtNum(m, digits)} ${units.minuteShort}`
}

/** Hours as a decimal for chart axes: "٢٫٥ س". */
export function fmtHoursAxis(ms: number, digits: Digits): string {
  const h = ms / HOUR
  return `${fmtNum(h, digits, { maximumFractionDigits: h < 10 ? 1 : 0 })} ${units.hourShort}`
}

/** "By" a duration: Arabic attaches ب ("بساعتين", "بـ٣ ساعات"), English says "by 2 hours". */
export function withBi(phrase: string): string {
  if (lang === 'en') return `by ${phrase}`
  return /^[0-9٠-٩]/.test(phrase) ? `بـ${phrase}` : `ب${phrase}`
}

/**
 * Countdown for the odometer: "٤:٢٦", "٢٣:٠٥" or "١:٠٢:٠٥". The leading unit
 * has no padding zero; rounds up to the next second.
 */
export function fmtCountdown(ms: number, digits: Digits): string {
  const total = Math.max(0, Math.ceil(ms / SECOND))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${fmtNum(h, digits)}:${fmt2(m, digits)}:${fmt2(s, digits)}`
  return `${fmtNum(m, digits)}:${fmt2(s, digits)}`
}

// ---------------------------------------------------------------------------
// Clock and dates
// ---------------------------------------------------------------------------

/** "٣:٤٥ م" (12h, default) or "١٥:٤٥" (24h), local time. */
export function fmtClock(at: number, prefs: FormatPrefs): string {
  const d = new Date(at)
  const h = d.getHours()
  const m = d.getMinutes()
  if (prefs.clock === '24h') return `${fmt2(h, prefs.digits)}:${fmt2(m, prefs.digits)}`
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${fmtNum(h12, prefs.digits)}:${fmt2(m, prefs.digits)} ${h < 12 ? units.am : units.pm}`
}

/** Hour label for axes and the timeline strip: "٣ م" / "١٥". */
export function fmtHourLabel(hour: number, prefs: FormatPrefs): string {
  const h = ((hour % 24) + 24) % 24
  if (prefs.clock === '24h') return fmt2(h, prefs.digits)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${fmtNum(h12, prefs.digits)} ${h < 12 ? units.am : units.pm}`
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()

/** A date locale in the interface language: calendar plus digits. */
function dateLocale(calendar: 'islamic-umalqura' | 'gregory', digits: Digits): string {
  return `${localeBase()}-u-ca-${calendar}-nu-${digitsFor(digits)}`
}

function dateFormat(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`
  let df = dateFormats.get(key)
  if (!df) {
    df = new Intl.DateTimeFormat(locale, opts)
    dateFormats.set(key, df)
  }
  return df
}

/** Umm al-Qura Hijri date: "١٦ ربيع الآخر ١٤٤٨ هـ" / "Rabiʻ II 16, 1448 AH". */
export function fmtHijri(at: number, digits: Digits): string {
  return dateFormat(dateLocale('islamic-umalqura', digits), {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(at)
}

export interface HijriParts {
  year: number
  month: number
  day: number
}

/** Numeric Umm al-Qura date parts (month 9 = Ramadan). */
export function hijriParts(at: number): HijriParts {
  const parts = dateFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).formatToParts(at)
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? NaN)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** Gregorian date with weekday: "الأحد، ٢٧ سبتمبر ٢٠٢٦" / "Sunday, September 27, 2026". */
export function fmtGregorian(at: number, digits: Digits): string {
  return dateFormat(dateLocale('gregory', digits), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(at)
}

/** "٢٧ سبتمبر" / "September 27" */
export function fmtDayMonth(at: number, digits: Digits): string {
  return dateFormat(dateLocale('gregory', digits), { day: 'numeric', month: 'long' }).format(at)
}

/** "الأحد" / "Sunday" */
export function fmtWeekday(at: number): string {
  return dateFormat(dateLocale('gregory', 'latn'), { weekday: 'long' }).format(at)
}

/** Short day label for chart axes: weekday for ≤ 7 days, day/month otherwise. */
export function fmtDayAxis(key: DayKey, digits: Digits, long: boolean): string {
  const d = dayStart(key)
  if (!long) return fmtWeekday(d.getTime())
  return `${fmtNum(d.getDate(), digits)}/${fmtNum(d.getMonth() + 1, digits)}`
}

/**
 * A day range label: "٢١ – ٢٧ سبتمبر" / "September 21 – 27", or
 * "٢٨ أغسطس – ٢٧ سبتمبر" / "August 28 – September 27".
 */
export function fmtDayRange(from: DayKey, to: DayKey, digits: Digits): string {
  const a = dayStart(from)
  const b = dayStart(to)
  if (from === to) return fmtDayMonth(a.getTime(), digits)
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    if (lang === 'en') return `${fmtDayMonth(a.getTime(), digits)} – ${fmtNum(b.getDate(), digits)}`
    return `${fmtNum(a.getDate(), digits)} – ${fmtDayMonth(b.getTime(), digits)}`
  }
  return `${fmtDayMonth(a.getTime(), digits)} – ${fmtDayMonth(b.getTime(), digits)}`
}

// ---------------------------------------------------------------------------
// Period comparison
// ---------------------------------------------------------------------------

/**
 * "أقل من الأسبوع الماضي بساعتين" / "أكثر من أمس بـ٣٠ دقيقة" / "قريب من الشهر الماضي".
 * Differences under five minutes read as "about the same".
 */
export function fmtCompare(
  currentMs: number,
  previousMs: number,
  prevLabel: string,
  digits: Digits
): string {
  if (previousMs <= 0) return compareStrings.noPrev(prevLabel)
  const delta = currentMs - previousMs
  if (Math.abs(delta) < 5 * MINUTE) return compareStrings.same(prevLabel)
  const by = withBi(fmtDuration(Math.abs(delta), digits, { gramCase: 'obl' }))
  return delta < 0 ? compareStrings.less(prevLabel, by) : compareStrings.more(prevLabel, by)
}
