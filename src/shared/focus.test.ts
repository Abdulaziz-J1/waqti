import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FOCUS_SECONDS,
  FOCUS_PRESETS,
  MAX_FOCUS_SECONDS,
  clampFocus,
  dialPosition,
  dialTurns,
  fmtHms,
  joinSeconds,
  lengthUntil,
  snapToMinute,
  splitSeconds,
  stepFocus,
  turnDelta
} from './focus'

describe('focus length', () => {
  it('shows a clock face in either digit set', () => {
    expect(fmtHms(DEFAULT_FOCUS_SECONDS, 'latn')).toBe('00:30:00')
    expect(fmtHms(3 * 3600 + 5 * 60 + 9, 'latn')).toBe('03:05:09')
    expect(fmtHms(90 * 60, 'arab')).toBe('٠١:٣٠:٠٠')
    expect(fmtHms(-5, 'latn')).toBe('00:00:00')
  })

  it('splits and joins hours, minutes and seconds', () => {
    expect(splitSeconds(3725)).toEqual({ h: 1, m: 2, s: 5 })
    expect(joinSeconds({ h: 1, m: 2, s: 5 })).toBe(3725)
    expect(joinSeconds(splitSeconds(MAX_FOCUS_SECONDS))).toBe(MAX_FOCUS_SECONDS)
  })

  it('steps by five minutes, snapping to the next mark', () => {
    expect(stepFocus(30 * 60, 1)).toBe(35 * 60)
    expect(stepFocus(30 * 60, -1)).toBe(25 * 60)
    expect(stepFocus(32 * 60 + 10, 1)).toBe(35 * 60)
    expect(stepFocus(32 * 60 + 10, -1)).toBe(30 * 60)
    expect(stepFocus(5 * 60, -1)).toBe(60)
    expect(stepFocus(60, 1)).toBe(5 * 60)
    expect(stepFocus(MAX_FOCUS_SECONDS, 1)).toBe(MAX_FOCUS_SECONDS)
  })

  it('keeps lengths between one minute and 23:59:59', () => {
    expect(clampFocus(10)).toBe(60)
    expect(clampFocus(10 ** 9)).toBe(MAX_FOCUS_SECONDS)
    expect(clampFocus(Number.NaN)).toBe(DEFAULT_FOCUS_SECONDS)
    expect(clampFocus(1500.4)).toBe(1500)
  })

  it('winds the dial like a kitchen timer, an hour a turn', () => {
    expect(dialTurns(30 * 60)).toEqual({ laps: 0, fraction: 0.5 })
    expect(dialTurns(3600)).toEqual({ laps: 0, fraction: 1 })
    expect(dialTurns(90 * 60)).toEqual({ laps: 1, fraction: 0.5 })
    expect(dialTurns(2 * 3600)).toEqual({ laps: 1, fraction: 1 })
    expect(dialTurns(0)).toEqual({ laps: 0, fraction: 0 })
    expect(dialTurns(-1)).toEqual({ laps: 0, fraction: 0 })
    expect(FOCUS_PRESETS).toEqual([1500, 1800, 2700, 3600, 5400, 7200])
  })

  it('reads a drag around the dial, winding on past twelve', () => {
    expect(dialPosition(0, -10)).toBe(0)
    expect(dialPosition(10, 0)).toBeCloseTo(0.25)
    expect(dialPosition(0, 10)).toBeCloseTo(0.5)
    expect(dialPosition(-10, 0)).toBeCloseTo(0.75)
    expect(turnDelta(0.95, 0.05)).toBeCloseTo(0.1)
    expect(turnDelta(0.05, 0.95)).toBeCloseTo(-0.1)
    expect(turnDelta(0.2, 0.3)).toBeCloseTo(0.1)
    expect(snapToMinute(25 * 60 + 29)).toBe(25 * 60)
    expect(snapToMinute(25 * 60 + 31)).toBe(26 * 60)
    expect(snapToMinute(5)).toBe(60)
  })

  it('fits a session before a time in whole minutes', () => {
    const now = 1_000_000
    expect(lengthUntil(now, now + 42 * 60_000 + 30_000)).toBe(42 * 60)
    expect(lengthUntil(now, now + 59_000)).toBeNull()
    expect(lengthUntil(now, now - 60_000)).toBeNull()
    expect(lengthUntil(now, now + 30 * 3600_000)).toBe(24 * 3600 - 1)
  })
})
