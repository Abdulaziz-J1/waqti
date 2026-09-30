import { type Digits, fmtNum } from './format'

/** The focus length is set in seconds, from one minute to 23:59:59. */
export const MIN_FOCUS_SECONDS = 60
export const MAX_FOCUS_SECONDS = 24 * 3600 - 1
/** Offered before anything is chosen. */
export const DEFAULT_FOCUS_SECONDS = 30 * 60
/** The − and + beside the dial move by five minutes. */
export const FOCUS_STEP_SECONDS = 5 * 60
/** Shortcuts in the time picker: 25, 30 and 45 minutes, 1, 1½ and 2 hours. */
export const FOCUS_PRESETS = [25 * 60, 30 * 60, 45 * 60, 3600, 90 * 60, 2 * 3600] as const

export interface Hms {
  h: number
  m: number
  s: number
}

export function clampFocus(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_FOCUS_SECONDS
  return Math.min(MAX_FOCUS_SECONDS, Math.max(MIN_FOCUS_SECONDS, Math.round(seconds)))
}

export function splitSeconds(total: number): Hms {
  const t = Math.max(0, Math.round(total))
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 }
}

export function joinSeconds({ h, m, s }: Hms): number {
  return h * 3600 + m * 60 + s
}

/** A clock face: "00:30:00" (hours, minutes, seconds; two digits each). */
export function fmtHms(total: number, digits: Digits): string {
  const { h, m, s } = splitSeconds(total)
  const two = (n: number): string => fmtNum(n, digits, { minimumIntegerDigits: 2 })
  return `${two(h)}:${two(m)}:${two(s)}`
}

/**
 * One press of − or +: moves to the previous or next five-minute mark
 * (32:10 → 35:00 or 30:00), within one minute … 23:59:59.
 */
export function stepFocus(total: number, dir: 1 | -1): number {
  const step = FOCUS_STEP_SECONDS
  const next =
    dir > 0 ? Math.floor(total / step) * step + step : Math.ceil(total / step) * step - step
  return clampFocus(next)
}

/**
 * The dial is a kitchen timer: one turn is an hour. `fraction` is the arc of
 * the hour being wound (a whole hour shows a full ring), `laps` the full hours
 * beneath it. The same reading unwinds while a session runs, so starting one
 * never makes the ring jump.
 */
export function dialTurns(total: number): { laps: number; fraction: number } {
  const t = Math.max(0, total)
  if (t === 0) return { laps: 0, fraction: 0 }
  const laps = Math.ceil(t / 3600) - 1
  return { laps, fraction: (t - laps * 3600) / 3600 }
}

/** Where a point sits on the dial: 0…1 clockwise from twelve o'clock (dx right, dy down). */
export function dialPosition(dx: number, dy: number): number {
  const turn = Math.atan2(dx, -dy) / (2 * Math.PI)
  return turn < 0 ? turn + 1 : turn
}

/** The short way round from one dial position to the next, so dragging past twelve winds on. */
export function turnDelta(from: number, to: number): number {
  const d = to - from
  if (d > 0.5) return d - 1
  if (d < -0.5) return d + 1
  return d
}

/** A dragged length: whole minutes, within one minute … 23:59:59. */
export function snapToMinute(seconds: number): number {
  return clampFocus(Math.round(seconds / 60) * 60)
}

/**
 * A length that ends by `at` in whole minutes (to finish with an adhan), or
 * null when less than a minute is left.
 */
export function lengthUntil(now: number, at: number): number | null {
  const seconds = Math.floor((at - now) / 60_000) * 60
  return seconds >= MIN_FOCUS_SECONDS ? Math.min(MAX_FOCUS_SECONDS, seconds) : null
}
