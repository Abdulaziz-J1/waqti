import type { DaySchedule } from './prayer/schedule'
import { MINUTE } from './time'

export const PERIODS = ['night', 'dawn', 'morning', 'day', 'asr', 'dusk'] as const
export type PeriodId = (typeof PERIODS)[number]
export type Tone = 'light' | 'dark'

export interface SkyPalette {
  top: string
  mid: string
  horizon: string
  tone: Tone
}

/** Sky gradients per prayer period. */
export const PALETTES: Record<PeriodId, SkyPalette> = {
  night: { top: '#0A1128', mid: '#101A33', horizon: '#1E2B52', tone: 'dark' },
  dawn: { top: '#1C2350', mid: '#3E4A89', horizon: '#C98A86', tone: 'dark' },
  morning: { top: '#6FA8D6', mid: '#B9D7EE', horizon: '#EAF2F8', tone: 'light' },
  day: { top: '#5B9FD3', mid: '#A7CDEA', horizon: '#EAF2F8', tone: 'light' },
  asr: { top: '#8DB3D1', mid: '#EFD2A2', horizon: '#E9B872', tone: 'light' },
  dusk: { top: '#2B2D5C', mid: '#7A3F66', horizon: '#B5485D', tone: 'dark' }
}

/** Half-width of the cross-fade window around each period boundary. */
export const BLEND_HALF_WINDOW = 20 * MINUTE

interface Boundary {
  at: number
  from: PeriodId
  to: PeriodId
}

function boundaries(s: DaySchedule): Boundary[] {
  const t = s.times
  return [
    { at: t.fajr, from: 'night', to: 'dawn' },
    { at: t.sunrise, from: 'dawn', to: 'morning' },
    { at: t.dhuhr, from: 'morning', to: 'day' },
    { at: t.asr, from: 'day', to: 'asr' },
    { at: t.maghrib, from: 'asr', to: 'dusk' },
    { at: t.isha, from: 'dusk', to: 'night' }
  ]
}

/** The prayer period at `now` for the day schedule that contains it. */
export function periodAt(s: DaySchedule, now: number): PeriodId {
  let period: PeriodId = 'night'
  for (const b of boundaries(s)) {
    if (now >= b.at) period = b.to
  }
  return period
}

export interface SkyState {
  period: PeriodId
  /** Palette blended across the nearest boundary. */
  colors: SkyPalette
  /** The period the palette is blending from/to (for debugging and tests). */
  blend: { from: PeriodId; to: PeriodId; t: number } | null
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const h = (v: number): string => Math.round(v).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const k = Math.max(0, Math.min(1, t))
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k
  ])
}

/** Smoothstep easing so the cross-fade starts and ends gently. */
function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Sky colours at `now`: the current period's palette, cross-faded over a
 * 40-minute window centred on each boundary. The UI tone flips at the
 * boundary itself (t = 0.5) so text never sits on a grey midpoint.
 */
export function skyAt(s: DaySchedule, now: number): SkyState {
  const period = periodAt(s, now)
  for (const b of boundaries(s)) {
    const start = b.at - BLEND_HALF_WINDOW
    const end = b.at + BLEND_HALF_WINDOW
    if (now >= start && now < end) {
      const t = ease((now - start) / (end - start))
      const pa = PALETTES[b.from]
      const pb = PALETTES[b.to]
      return {
        period,
        colors: {
          top: mixHex(pa.top, pb.top, t),
          mid: mixHex(pa.mid, pb.mid, t),
          horizon: mixHex(pa.horizon, pb.horizon, t),
          tone: now < b.at ? pa.tone : pb.tone
        },
        blend: { from: b.from, to: b.to, t }
      }
    }
  }
  return { period, colors: { ...PALETTES[period] }, blend: null }
}

/** True for periods where stars may twinkle (lock screen). */
export function isNightLike(period: PeriodId): boolean {
  return period === 'night' || period === 'dawn'
}
