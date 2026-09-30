import { describe, expect, it } from 'vitest'
import { BLEND_HALF_WINDOW, PALETTES, isNightLike, mixHex, periodAt, skyAt, tintOf } from './sky'
import { buildDaySchedule } from './prayer/schedule'
import { MINUTE } from './time'

const s = buildDaySchedule('2026-09-27', { lat: 24.7136, lng: 46.6753 })
const t = s.times

describe('periods', () => {
  it('follows the prayer periods through the day', () => {
    expect(periodAt(s, t.fajr - 60 * MINUTE)).toBe('night')
    expect(periodAt(s, t.fajr + MINUTE)).toBe('dawn')
    expect(periodAt(s, t.sunrise + MINUTE)).toBe('morning')
    expect(periodAt(s, t.dhuhr + MINUTE)).toBe('day')
    expect(periodAt(s, t.asr + MINUTE)).toBe('asr')
    expect(periodAt(s, t.maghrib + MINUTE)).toBe('dusk')
    expect(periodAt(s, t.isha + MINUTE)).toBe('night')
  })
})

describe('control tint', () => {
  it('follows the period in the sky theme and stays put in the static ones', () => {
    expect(tintOf('sky', 'dusk')).toBe('dusk')
    expect(tintOf('sky', 'asr')).toBe('asr')
    expect(tintOf('light', 'dusk')).toBe('day')
    expect(tintOf('dark', 'morning')).toBe('night')
  })
})

describe('sky blending', () => {
  it('uses the pure palette away from boundaries', () => {
    const mid = (t.dhuhr + t.asr) / 2
    const sky = skyAt(s, mid)
    expect(sky.blend).toBeNull()
    expect(sky.colors).toEqual(PALETTES.day)
  })

  it('cross-fades around a boundary and flips tone at the boundary', () => {
    const before = skyAt(s, t.maghrib - MINUTE)
    const after = skyAt(s, t.maghrib + MINUTE)
    expect(before.blend?.from).toBe('asr')
    expect(before.blend?.to).toBe('dusk')
    expect(before.colors.tone).toBe('light')
    expect(after.colors.tone).toBe('dark')
    const start = skyAt(s, t.maghrib - BLEND_HALF_WINDOW)
    expect(start.blend?.t).toBeCloseTo(0)
    expect(start.colors.top).toBe(PALETTES.asr.top.toUpperCase())
    const nearEnd = skyAt(s, t.maghrib + BLEND_HALF_WINDOW - 1)
    expect(nearEnd.blend?.t).toBeGreaterThan(0.99)
  })

  it('mixes hex colours', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080')
    expect(mixHex('#101A33', '#EAF2F8', 0)).toBe('#101A33')
    expect(mixHex('#101A33', '#EAF2F8', 2)).toBe('#EAF2F8')
  })

  it('marks night-like periods for stars', () => {
    expect(isNightLike('night')).toBe(true)
    expect(isNightLike('dawn')).toBe(true)
    expect(isNightLike('day')).toBe(false)
  })
})
