import { describe, expect, it } from 'vitest'
import { ARC, arcMarkers, arcPointAt, dayPath, nightPath, pointOnArc } from './arc'
import { schedulesAround } from './prayer/schedule'
import { MINUTE } from './time'

const now = new Date('2026-09-27T13:00:00+03:00').getTime()
const [yesterday, today, tomorrow] = schedulesAround(now, { lat: 24.7136, lng: 46.6753 })
const days = { yesterday: yesterday!, today: today!, tomorrow: tomorrow! }

describe('sky arc geometry', () => {
  it('maps the day from the right (sunrise) over the top to the left (sunset)', () => {
    const start = pointOnArc('day', 0)
    const mid = pointOnArc('day', 0.5)
    const end = pointOnArc('day', 1)
    expect(start.x).toBeCloseTo(ARC.cx + ARC.rx)
    expect(mid.y).toBeCloseTo(ARC.cy - ARC.ryDay)
    expect(end.x).toBeCloseTo(ARC.cx - ARC.rx)
    expect(pointOnArc('day', 2).t).toBe(1)
  })

  it('maps the night from the left back to the right below the horizon', () => {
    expect(pointOnArc('night', 0).x).toBeCloseTo(ARC.cx - ARC.rx)
    expect(pointOnArc('night', 0.5).y).toBeCloseTo(ARC.cy + ARC.ryNight)
    expect(pointOnArc('night', 1).x).toBeCloseTo(ARC.cx + ARC.rx)
  })

  it('places instants in the right phase', () => {
    expect(arcPointAt(days, now).phase).toBe('day')
    expect(arcPointAt(days, today!.times.fajr).phase).toBe('night')
    expect(arcPointAt(days, today!.times.isha + MINUTE).phase).toBe('night')
    // Just after midnight the body is late on the previous night's arc.
    const early = arcPointAt(days, today!.times.fajr - 60 * MINUTE)
    expect(early.t).toBeGreaterThan(0.6)
  })

  it('puts the prayer markers in order around the cycle', () => {
    const m = Object.fromEntries(arcMarkers(days).map((x) => [x.slot, x]))
    expect(m['fajr']!.phase).toBe('night')
    expect(m['fajr']!.x).toBeGreaterThan(ARC.cx)
    expect(m['sunrise']!.x).toBeCloseTo(ARC.cx + ARC.rx)
    expect(Math.abs(m['dhuhr']!.x - ARC.cx)).toBeLessThan(40)
    expect(m['asr']!.x).toBeLessThan(m['dhuhr']!.x)
    expect(m['maghrib']!.x).toBeLessThan(m['asr']!.x)
    expect(m['isha']!.phase).toBe('night')
    expect(m['isha']!.x).toBeLessThan(ARC.cx)
  })

  it('builds the SVG paths', () => {
    expect(dayPath()).toMatch(/^M 910 232 A 410 196/)
    expect(nightPath()).toMatch(/^M 90 232 A 410 58/)
  })
})
