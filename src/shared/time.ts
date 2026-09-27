export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** A local calendar day as `YYYY-MM-DD`. */
export type DayKey = string

const pad = (n: number): string => String(n).padStart(2, '0')

/** Local calendar day of an instant. */
export function dayKey(at: number | Date): DayKey {
  const d = typeof at === 'number' ? new Date(at) : at
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local midnight (start) of a day key, as a Date. */
export function dayStart(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export function dayStartMs(key: DayKey): number {
  return dayStart(key).getTime()
}

/** Local midnight at the end of the day (= start of the next day). */
export function dayEndMs(key: DayKey): number {
  return dayStart(addDays(key, 1)).getTime()
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = dayStart(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Inclusive list of day keys from `from` to `to`. */
export function daysBetween(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = []
  let cur = from
  let guard = 0
  while (cur <= to && guard < 4000) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

/** Minutes elapsed since local midnight. */
export function minutesOfDay(at: number): number {
  const d = new Date(at)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

/** 0 = Sunday … 6 = Saturday, local. */
export function weekday(key: DayKey): number {
  return dayStart(key).getDay()
}

export function isFriday(key: DayKey): boolean {
  return weekday(key) === 5
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
