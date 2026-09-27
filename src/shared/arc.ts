import type { DaySchedule, SlotId } from './prayer/schedule'

/**
 * Geometry of the Sky Arc (Today hero). The day is the upper half of an
 * ellipse from sunrise (right) over the top to sunset (left); the night is a
 * flatter lower arc from sunset back to the next sunrise. Time therefore moves
 * right-to-left across the sky, matching the RTL layout.
 */
export interface ArcGeometry {
  width: number
  cx: number
  cy: number
  rx: number
  ryDay: number
  ryNight: number
}

export const ARC: ArcGeometry = { width: 1000, cx: 500, cy: 232, rx: 410, ryDay: 196, ryNight: 58 }

export interface ArcPoint {
  x: number
  y: number
  phase: 'day' | 'night'
  /** 0…1 along the phase's arc. */
  t: number
}

export function pointOnArc(phase: 'day' | 'night', t: number, g: ArcGeometry = ARC): ArcPoint {
  const k = Math.min(1, Math.max(0, t))
  const a = Math.PI * k
  if (phase === 'day') {
    return { phase, t: k, x: g.cx + g.rx * Math.cos(a), y: g.cy - g.ryDay * Math.sin(a) }
  }
  return { phase, t: k, x: g.cx - g.rx * Math.cos(a), y: g.cy + g.ryNight * Math.sin(a) }
}

export interface ArcDays {
  yesterday: DaySchedule
  today: DaySchedule
  tomorrow: DaySchedule
}

/** Where an instant sits on the arc. */
export function arcPointAt(d: ArcDays, at: number, g: ArcGeometry = ARC): ArcPoint {
  const { yesterday, today, tomorrow } = d
  if (at >= today.times.sunrise && at <= today.sunset) {
    return pointOnArc('day', (at - today.times.sunrise) / (today.sunset - today.times.sunrise), g)
  }
  if (at < today.times.sunrise) {
    return pointOnArc(
      'night',
      (at - yesterday.sunset) / (today.times.sunrise - yesterday.sunset),
      g
    )
  }
  return pointOnArc('night', (at - today.sunset) / (tomorrow.times.sunrise - today.sunset), g)
}

export interface ArcMarker extends ArcPoint {
  slot: SlotId
  at: number
}

/** Today's six times placed on the arc. */
export function arcMarkers(d: ArcDays, g: ArcGeometry = ARC): ArcMarker[] {
  const slots: SlotId[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
  return slots.map((slot) => {
    const at = d.today.times[slot]
    return { slot, at, ...arcPointAt(d, at, g) }
  })
}

/** SVG path for the day arc (right to left over the top). */
export function dayPath(g: ArcGeometry = ARC): string {
  return `M ${g.cx + g.rx} ${g.cy} A ${g.rx} ${g.ryDay} 0 0 0 ${g.cx - g.rx} ${g.cy}`
}

/** SVG path for the night arc (left to right under the horizon). */
export function nightPath(g: ArcGeometry = ARC): string {
  return `M ${g.cx - g.rx} ${g.cy} A ${g.rx} ${g.ryNight} 0 0 0 ${g.cx + g.rx} ${g.cy}`
}
