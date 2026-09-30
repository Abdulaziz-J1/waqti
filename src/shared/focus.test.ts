import { describe, expect, it } from 'vitest'
import { MAX_FOCUS_MINUTES, durationText, parseDuration } from './focus'

describe('typed focus duration', () => {
  it('reads minutes and hours in Latin, Arabic-Indic or Persian digits', () => {
    expect(parseDuration('120', 'minutes')).toBe(120)
    expect(parseDuration(' ١٢٠ ', 'minutes')).toBe(120)
    expect(parseDuration('۴۵', 'minutes')).toBe(45)
    expect(parseDuration('2', 'hours')).toBe(120)
    expect(parseDuration('1.5', 'hours')).toBe(90)
    expect(parseDuration('١٫٥', 'hours')).toBe(90)
    expect(parseDuration('0,25', 'hours')).toBe(15)
    expect(parseDuration('1000', 'minutes')).toBe(1000)
  })

  it('rejects text, zero and anything past a day', () => {
    expect(parseDuration('', 'minutes')).toBeNull()
    expect(parseDuration('abc', 'minutes')).toBeNull()
    expect(parseDuration('-5', 'minutes')).toBeNull()
    expect(parseDuration('0', 'minutes')).toBeNull()
    expect(parseDuration('1e3', 'minutes')).toBeNull()
    expect(parseDuration(String(MAX_FOCUS_MINUTES), 'minutes')).toBe(MAX_FOCUS_MINUTES)
    expect(parseDuration(String(MAX_FOCUS_MINUTES + 1), 'minutes')).toBeNull()
    expect(parseDuration('25', 'hours')).toBeNull()
  })

  it('shows a duration back in the chosen unit and digits', () => {
    expect(durationText(90, 'minutes', 'latn')).toBe('90')
    expect(durationText(90, 'hours', 'latn')).toBe('1.5')
    expect(durationText(120, 'hours', 'arab')).toBe('٢')
    expect(durationText(90, 'hours', 'arab')).toBe('١٫٥')
    expect(durationText(100, 'hours', 'latn')).toBe('1.67')
  })
})
