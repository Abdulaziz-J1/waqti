import type { Digits } from './format'

/** Longest focus session: a full day. */
export const MAX_FOCUS_MINUTES = 24 * 60

export type DurationUnit = 'minutes' | 'hours'

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function toLatin(text: string): string {
  return [...text]
    .map((ch) => {
      const a = ARABIC_DIGITS.indexOf(ch)
      if (a >= 0) return String(a)
      const p = PERSIAN_DIGITS.indexOf(ch)
      if (p >= 0) return String(p)
      return ch === '٫' || ch === ',' ? '.' : ch
    })
    .join('')
}

/**
 * Minutes from a typed focus duration: "120", "١٢٠", or "1.5" / "١٫٥" hours.
 * Null when it is not a plain number or falls outside 1 minute … 24 hours.
 */
export function parseDuration(text: string, unit: DurationUnit): number | null {
  const s = toLatin(text.trim())
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const minutes = Math.round(unit === 'hours' ? Number(s) * 60 : Number(s))
  return minutes >= 1 && minutes <= MAX_FOCUS_MINUTES ? minutes : null
}

/** What the field shows for `minutes` in `unit`: 90 → "90" or "1.5" (in the chosen digits). */
export function durationText(minutes: number, unit: DurationUnit, digits: Digits): string {
  const value = unit === 'minutes' ? minutes : Math.round((minutes / 60) * 100) / 100
  const latin = String(value)
  if (digits === 'latn') return latin
  return [...latin].map((ch) => (ch === '.' ? '٫' : (ARABIC_DIGITS[Number(ch)] ?? ch))).join('')
}
