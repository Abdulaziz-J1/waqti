import { DEFAULT_MACHINE_CONFIG } from '../machine/machine'
import type { LockPlan, MachineConfig } from '../machine/types'
import { CITIES, DEFAULT_CITY_ID, findCity } from '../prayer/cities'
import type { Adjustments, LatLng, PrayerId } from '../prayer/schedule'
import { MINUTE } from '../time'
import type { Settings } from './schema'

export function coordsOf(s: Settings): LatLng {
  if (s.location.kind === 'custom') return { lat: s.location.lat, lng: s.location.lng }
  const city = findCity(s.location.cityId) ?? findCity(DEFAULT_CITY_ID) ?? CITIES[0]!
  return { lat: city.lat, lng: city.lng }
}

export function adjustmentsOf(s: Settings): Adjustments {
  return {
    fajr: s.prayers.fajr.adjust,
    dhuhr: s.prayers.dhuhr.adjust,
    asr: s.prayers.asr.adjust,
    maghrib: s.prayers.maghrib.adjust,
    isha: s.prayers.isha.adjust
  }
}

/** How a prayer locks, or null when its lock is off. Friday Dhuhr uses the Friday settings. */
export function lockPlanFor(s: Settings, prayer: PrayerId, isJumuah: boolean): LockPlan | null {
  const minUnlockMs = s.minUnlockMinutes * MINUTE
  if (isJumuah) {
    if (!s.friday.lock) return null
    return { lockMs: s.friday.lockMinutes * MINUTE, minUnlockMs, chime: s.chime }
  }
  const p = s.prayers[prayer]
  if (!p.lock) return null
  return { lockMs: p.lockMinutes * MINUTE, minUnlockMs, chime: s.chime }
}

/** Plan used by the debug "simulate prayer" action: the configured one, or a 15-minute default. */
export function forcedLockPlan(s: Settings, prayer: PrayerId, isJumuah: boolean): LockPlan {
  return (
    lockPlanFor(s, prayer, isJumuah) ?? {
      lockMs: 15 * MINUTE,
      minUnlockMs: s.minUnlockMinutes * MINUTE,
      chime: s.chime
    }
  )
}

/** Minutes before the prayer for the reminder toast; 0 = no reminder. */
export function reminderMinutesFor(s: Settings, isJumuah: boolean): number {
  return isJumuah ? s.friday.reminderMinutes : s.reminderMinutes
}

export function machineConfigOf(s: Settings): MachineConfig {
  return {
    ...DEFAULT_MACHINE_CONFIG,
    skipWhenAway: s.smart.skipWhenAway,
    deferInMeetings: s.smart.deferInMeetings
  }
}

/** Arabic label of the configured location. */
export function locationLabel(s: Settings, customLabel: string): string {
  if (s.location.kind === 'custom') return s.location.label || customLabel
  return findCity(s.location.cityId)?.name ?? customLabel
}
