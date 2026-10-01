import { DEFAULT_MACHINE_CONFIG } from '../machine/machine'
import type { LockPlan, MachineConfig } from '../machine/types'
import { CITIES, DEFAULT_CITY_ID, cityName, findCity } from '../prayer/cities'
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
    isha: s.prayers.isha.adjust,
    jumuah: s.prayers.jumuah.adjust
  }
}

/** The settings a prayer uses: Friday's Dhuhr has its own (Jumu'ah). */
function prayerSettingsOf(s: Settings, prayer: PrayerId, isJumuah: boolean) {
  return isJumuah ? s.prayers.jumuah : s.prayers[prayer]
}

/** How a prayer locks, or null when its lock is off. */
export function lockPlanFor(s: Settings, prayer: PrayerId, isJumuah: boolean): LockPlan | null {
  const p = prayerSettingsOf(s, prayer, isJumuah)
  if (!p.lock) return null
  return {
    lockMs: p.lockMinutes * MINUTE,
    minUnlockMs: s.minUnlockMinutes * MINUTE,
    chime: s.chime,
    snooze: s.snooze.enabled
  }
}

/**
 * Minutes from the adhan to the lock (the iqama). Ramadan has its own values
 * for Fajr and Maghrib; Jumu'ah has its own (with the adhan by default, as the
 * khutbah starts then).
 */
export function lockDelayMinutesFor(
  s: Settings,
  prayer: PrayerId,
  isJumuah: boolean,
  isRamadan: boolean
): number {
  if (isJumuah) return s.prayers.jumuah.lockDelayMinutes
  if (isRamadan && prayer === 'fajr') return s.ramadanLockDelay.fajr
  if (isRamadan && prayer === 'maghrib') return s.ramadanLockDelay.maghrib
  return s.prayers[prayer].lockDelayMinutes
}

/** Plan used by the debug "simulate prayer" action: the configured one, or a 15-minute default. */
export function forcedLockPlan(s: Settings, prayer: PrayerId, isJumuah: boolean): LockPlan {
  return (
    lockPlanFor(s, prayer, isJumuah) ?? {
      lockMs: 15 * MINUTE,
      minUnlockMs: s.minUnlockMinutes * MINUTE,
      chime: s.chime,
      snooze: s.snooze.enabled
    }
  )
}

/** Snooze lengths the lock screen offers: the common ones plus the configured default. */
export function snoozeChoices(defaultMinutes: number): number[] {
  return [...new Set([1, 2, 3, 5, 10, 15, defaultMinutes])].sort((a, b) => a - b)
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
  const city = findCity(s.location.cityId)
  return city ? cityName(city) : customLabel
}
