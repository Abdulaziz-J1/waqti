import type { PlannedPrayer, PrayerRef } from '../machine/types'
import { lockDelayMinutesFor, lockPlanFor, reminderMinutesFor } from '../settings/plan'
import type { Settings } from '../settings/schema'
import { MINUTE } from '../time'
import { type DaySchedule, flattenSchedules, isPrayerId } from './schedule'

export type DueEvent =
  | { kind: 'pre'; fireAt: number; ref: PrayerRef; minutesBefore: number }
  | { kind: 'adhan'; fireAt: number; ref: PrayerRef }
  | { kind: 'prayer'; fireAt: number; ref: PrayerRef }
  | { kind: 'sunrise'; fireAt: number; sunriseAt: number }

/**
 * Every prayer in the schedules. `at` is when it locks: the adhan plus the
 * configured delay (the iqama), or the adhan itself when the prayer does not lock.
 */
function prayerRefs(schedules: DaySchedule[], settings: Settings): PrayerRef[] {
  const ramadan = new Map(schedules.map((s) => [s.day, s.isRamadan]))
  const out: PrayerRef[] = []
  for (const e of flattenSchedules(schedules)) {
    if (!isPrayerId(e.slot)) continue
    const locks = lockPlanFor(settings, e.slot, e.isJumuah) !== null
    const delay = locks
      ? lockDelayMinutesFor(settings, e.slot, e.isJumuah, ramadan.get(e.day) ?? false)
      : 0
    out.push({
      prayer: e.slot,
      day: e.day,
      at: e.at + delay * MINUTE,
      adhanAt: e.at,
      isJumuah: e.isJumuah
    })
  }
  return out.sort((a, b) => a.at - b.at)
}

/**
 * Reminders, adhans and locks that fall in the half-open window (from, to].
 * The scheduler calls this every tick with the previous and current time, so
 * each event fires exactly once even if a tick is late. The adhan notice is
 * left out when the lock itself comes with the adhan.
 */
export function dueBetween(
  schedules: DaySchedule[],
  settings: Settings,
  from: number,
  to: number
): DueEvent[] {
  const out: DueEvent[] = []
  if (to <= from) return out
  const inWindow = (t: number): boolean => t > from && t <= to
  for (const ref of prayerRefs(schedules, settings)) {
    const rem = reminderMinutesFor(settings, ref.isJumuah)
    if (rem > 0) {
      const preAt = ref.adhanAt - rem * MINUTE
      if (inWindow(preAt)) out.push({ kind: 'pre', fireAt: preAt, ref, minutesBefore: rem })
    }
    const lockWithAdhan =
      ref.at === ref.adhanAt && lockPlanFor(settings, ref.prayer, ref.isJumuah) !== null
    if (settings.adhanNotice && !lockWithAdhan && inWindow(ref.adhanAt)) {
      out.push({ kind: 'adhan', fireAt: ref.adhanAt, ref })
    }
    if (inWindow(ref.at)) out.push({ kind: 'prayer', fireAt: ref.at, ref })
  }
  if (settings.sunrise.notice) {
    for (const day of schedules) {
      const fireAt = day.times.sunrise - settings.sunrise.minutesBefore * MINUTE
      if (inWindow(fireAt)) out.push({ kind: 'sunrise', fireAt, sunriseAt: day.times.sunrise })
    }
  }
  return out.sort((a, b) => a.fireAt - b.fireAt)
}

/** Prayers whose lock time passed while the machine was asleep (from, to]. */
export function prayersBetween(
  schedules: DaySchedule[],
  settings: Settings,
  from: number,
  to: number
): PlannedPrayer[] {
  return prayerRefs(schedules, settings)
    .filter((r) => r.at > from && r.at <= to)
    .map((ref) => ({ ref, plan: lockPlanFor(settings, ref.prayer, ref.isJumuah) }))
}

/**
 * The first prayer that locks in (from, to]: a focus session running then
 * pauses for it and carries on after the prayer.
 */
export function lockDuring(
  schedules: DaySchedule[],
  settings: Settings,
  from: number,
  to: number
): PrayerRef | null {
  return (
    prayerRefs(schedules, settings).find(
      (r) => r.at > from && r.at <= to && lockPlanFor(settings, r.prayer, r.isJumuah) !== null
    ) ?? null
  )
}

/** The latest prayer whose lock time is in [now − windowMs, now], if any (for the startup offer). */
export function recentPrayer(
  schedules: DaySchedule[],
  settings: Settings,
  now: number,
  windowMs: number
): PlannedPrayer | null {
  const refs = prayerRefs(schedules, settings).filter((r) => r.at <= now && now - r.at <= windowMs)
  const ref = refs.at(-1)
  return ref ? { ref, plan: lockPlanFor(settings, ref.prayer, ref.isJumuah) } : null
}

/**
 * A ref for a prayer today whose adhan and lock are both at `at` (the debug
 * panel uses it to simulate a prayer "now").
 */
export function refForToday(
  schedule: DaySchedule,
  prayer: PrayerRef['prayer'],
  at: number
): PrayerRef {
  return {
    prayer,
    day: schedule.day,
    at,
    adhanAt: at,
    isJumuah: prayer === 'dhuhr' && schedule.isFriday
  }
}
