import { type DayKey, dayEndMs, dayKey } from '../time'

/** One foreground reading, already filtered for idle / lock / pause / exclusions. */
export interface TrackSample {
  at: number
  process: string
  appName: string
  exePath: string
  site: string | null
  title: string | null
}

export interface Interval {
  process: string
  appName: string
  exePath: string
  site: string | null
  title: string | null
  start: number
  end: number
}

export interface DayInterval extends Interval {
  day: DayKey
}

export interface MergeOptions {
  /** Poll period; each sample stands for [at, at + pollMs). */
  pollMs: number
  /** Largest gap between samples that still continues the same interval. */
  maxGapMs: number
}

export const DEFAULT_MERGE: MergeOptions = { pollMs: 1000, maxGapMs: 3000 }

/** Minimum length for an interval to be worth storing. */
export const MIN_INTERVAL_MS = 1000

export function sameActivity(
  a: Pick<Interval, 'process' | 'site'>,
  b: Pick<Interval, 'process' | 'site'>
): boolean {
  return a.process === b.process && a.site === b.site
}

export interface StepResult {
  open: Interval | null
  closed: Interval[]
}

/**
 * Feeds one sample into the merger. Consecutive samples of the same app (and
 * site) extend the open interval; anything else closes it and starts a new one.
 * A `null` sample means "not counting right now" and closes the open interval.
 */
export function mergeStep(
  open: Interval | null,
  sample: TrackSample | null,
  opts: MergeOptions = DEFAULT_MERGE
): StepResult {
  if (!sample) return { open: null, closed: open ? [open] : [] }

  if (
    open &&
    sameActivity(open, sample) &&
    sample.at >= open.start &&
    sample.at - open.end <= opts.maxGapMs
  ) {
    return {
      open: {
        ...open,
        end: Math.max(open.end, sample.at + opts.pollMs),
        title: sample.title ?? open.title
      },
      closed: []
    }
  }

  const closed: Interval[] = []
  if (open) {
    // Never let the closed interval overlap the new one.
    const end = sample.at >= open.start ? Math.min(open.end, sample.at) : open.end
    if (end - open.start >= MIN_INTERVAL_MS) closed.push({ ...open, end })
  }
  return {
    open: {
      process: sample.process,
      appName: sample.appName,
      exePath: sample.exePath,
      site: sample.site,
      title: sample.title,
      start: sample.at,
      end: sample.at + opts.pollMs
    },
    closed
  }
}

/**
 * Cuts the open interval back to `until` (for example the last input time when
 * idle is detected). Returns null when nothing meaningful remains.
 */
export function trimInterval(open: Interval | null, until: number): Interval | null {
  if (!open) return null
  const end = Math.min(open.end, until)
  if (end - open.start < MIN_INTERVAL_MS) return null
  return { ...open, end }
}

/** Splits an interval at local midnights so every piece belongs to one day. */
export function splitByDay(iv: Interval): DayInterval[] {
  const out: DayInterval[] = []
  let start = iv.start
  let guard = 0
  while (start < iv.end && guard < 400) {
    const day = dayKey(start)
    const boundary = dayEndMs(day)
    const end = Math.min(iv.end, boundary)
    out.push({ ...iv, start, end, day })
    start = end
    guard++
  }
  return out
}
