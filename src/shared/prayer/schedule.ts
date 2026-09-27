import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan'
import { hijriParts } from '../format'
import { MINUTE, type DayKey, addDays, dayKey, dayStart, isFriday } from '../time'

/** The five prayers that can lock the screen. */
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type PrayerId = (typeof PRAYERS)[number]

/** Every time shown in the schedule. Sunrise is display only and never locks. */
export const SLOTS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const
export type SlotId = (typeof SLOTS)[number]

export interface LatLng {
  lat: number
  lng: number
}

/** Manual per-prayer adjustment in minutes, clamped to −15…+15. */
export type Adjustments = Record<PrayerId, number>

export const ZERO_ADJUSTMENTS: Adjustments = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }

/** Umm al-Qura: add 30 minutes to Isha during Ramadan (adhan documentation). */
export const RAMADAN_ISHA_OFFSET_MIN = 30
export const MAX_ADJUSTMENT_MIN = 15

export interface DaySchedule {
  day: DayKey
  /** Epoch ms for each slot. */
  times: Record<SlotId, number>
  /** Sunset (= Maghrib before adjustment) for the sky arc. */
  sunset: number
  isFriday: boolean
  isRamadan: boolean
}

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduleError'
  }
}

export function clampAdjustment(min: number): number {
  if (!Number.isFinite(min)) return 0
  return Math.max(-MAX_ADJUSTMENT_MIN, Math.min(MAX_ADJUSTMENT_MIN, Math.round(min)))
}

/** True when the local day falls in Ramadan on the Umm al-Qura calendar. */
export function isRamadanDay(day: DayKey): boolean {
  // Midday avoids any ambiguity around midnight.
  const noon = dayStart(day).getTime() + 12 * 60 * MINUTE
  return hijriParts(noon).month === 9
}

/**
 * Builds one local day's prayer schedule with Umm al-Qura parameters,
 * standard (Shafi) Asr, the Ramadan Isha offset and manual adjustments.
 */
export function buildDaySchedule(
  day: DayKey,
  coords: LatLng,
  adjustments: Adjustments = ZERO_ADJUSTMENTS
): DaySchedule {
  const params = CalculationMethod.UmmAlQura()
  params.madhab = Madhab.Shafi
  const ramadan = isRamadanDay(day)
  params.adjustments = {
    fajr: clampAdjustment(adjustments.fajr),
    sunrise: 0,
    dhuhr: clampAdjustment(adjustments.dhuhr),
    asr: clampAdjustment(adjustments.asr),
    maghrib: clampAdjustment(adjustments.maghrib),
    isha: clampAdjustment(adjustments.isha) + (ramadan ? RAMADAN_ISHA_OFFSET_MIN : 0)
  }
  // adhan reads the local calendar date from this Date.
  const date = dayStart(day)
  const pt = new PrayerTimes(new Coordinates(coords.lat, coords.lng), date, params)
  const times: Record<SlotId, number> = {
    fajr: pt.fajr.getTime(),
    sunrise: pt.sunrise.getTime(),
    dhuhr: pt.dhuhr.getTime(),
    asr: pt.asr.getTime(),
    maghrib: pt.maghrib.getTime(),
    isha: pt.isha.getTime()
  }
  for (const slot of SLOTS) {
    if (!Number.isFinite(times[slot])) {
      throw new ScheduleError(`Could not compute ${slot} for ${day} at ${coords.lat},${coords.lng}`)
    }
  }
  return {
    day,
    times,
    sunset: pt.sunset.getTime(),
    isFriday: isFriday(day),
    isRamadan: ramadan
  }
}

export interface ScheduledEvent {
  slot: SlotId
  day: DayKey
  at: number
  /** Dhuhr on Friday. */
  isJumuah: boolean
}

/** Chronological list of slots for a set of day schedules. */
export function flattenSchedules(schedules: DaySchedule[]): ScheduledEvent[] {
  const out: ScheduledEvent[] = []
  for (const s of schedules) {
    for (const slot of SLOTS) {
      out.push({ slot, day: s.day, at: s.times[slot], isJumuah: slot === 'dhuhr' && s.isFriday })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

/** The next slot strictly after `now` (optionally only lockable prayers). */
export function nextEvent(
  schedules: DaySchedule[],
  now: number,
  prayersOnly = false
): ScheduledEvent | null {
  for (const e of flattenSchedules(schedules)) {
    if (e.at > now && (!prayersOnly || e.slot !== 'sunrise')) return e
  }
  return null
}

/** The most recent slot at or before `now`. */
export function previousEvent(
  schedules: DaySchedule[],
  now: number,
  prayersOnly = false
): ScheduledEvent | null {
  let found: ScheduledEvent | null = null
  for (const e of flattenSchedules(schedules)) {
    if (e.at <= now && (!prayersOnly || e.slot !== 'sunrise')) found = e
  }
  return found
}

/** Schedules for yesterday, today and tomorrow around `now`. */
export function schedulesAround(
  now: number,
  coords: LatLng,
  adjustments: Adjustments = ZERO_ADJUSTMENTS
): DaySchedule[] {
  const today = dayKey(now)
  return [addDays(today, -1), today, addDays(today, 1)].map((d) =>
    buildDaySchedule(d, coords, adjustments)
  )
}

export function isPrayerId(slot: SlotId): slot is PrayerId {
  return slot !== 'sunrise'
}
