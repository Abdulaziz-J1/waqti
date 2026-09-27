import type { PlannedPrayer, PrayerRef } from '../machine/types'
import { lockPlanFor, reminderMinutesFor } from '../settings/plan'
import type { Settings } from '../settings/schema'
import { MINUTE } from '../time'
import { type DaySchedule, flattenSchedules, isPrayerId } from './schedule'

export type DueEvent =
  | { kind: 'pre'; fireAt: number; ref: PrayerRef; minutesBefore: number }
  | { kind: 'prayer'; fireAt: number; ref: PrayerRef }

function prayerRefs(schedules: DaySchedule[]): PrayerRef[] {
  const out: PrayerRef[] = []
  for (const e of flattenSchedules(schedules)) {
    if (isPrayerId(e.slot)) out.push({ prayer: e.slot, day: e.day, at: e.at, isJumuah: e.isJumuah })
  }
  return out
}

/**
 * Reminders and prayer times that fall in the half-open window (from, to].
 * The scheduler calls this every tick with the previous and current time, so
 * each event fires exactly once even if a tick is late.
 */
export function dueBetween(
  schedules: DaySchedule[],
  settings: Settings,
  from: number,
  to: number
): DueEvent[] {
  const out: DueEvent[] = []
  if (to <= from) return out
  for (const ref of prayerRefs(schedules)) {
    const rem = reminderMinutesFor(settings, ref.isJumuah)
    if (rem > 0) {
      const preAt = ref.at - rem * MINUTE
      if (preAt > from && preAt <= to)
        out.push({ kind: 'pre', fireAt: preAt, ref, minutesBefore: rem })
    }
    if (ref.at > from && ref.at <= to) out.push({ kind: 'prayer', fireAt: ref.at, ref })
  }
  return out.sort((a, b) => a.fireAt - b.fireAt)
}

/** Prayers whose time passed while the machine was asleep (from, to]. */
export function prayersBetween(
  schedules: DaySchedule[],
  settings: Settings,
  from: number,
  to: number
): PlannedPrayer[] {
  return prayerRefs(schedules)
    .filter((r) => r.at > from && r.at <= to)
    .map((ref) => ({ ref, plan: lockPlanFor(settings, ref.prayer, ref.isJumuah) }))
}

/** The latest prayer in [now − windowMs, now], if any (for the startup offer). */
export function recentPrayer(
  schedules: DaySchedule[],
  settings: Settings,
  now: number,
  windowMs: number
): PlannedPrayer | null {
  const refs = prayerRefs(schedules).filter((r) => r.at <= now && now - r.at <= windowMs)
  const ref = refs.at(-1)
  return ref ? { ref, plan: lockPlanFor(settings, ref.prayer, ref.isJumuah) } : null
}

/** The ref for a prayer today (used by the debug panel to simulate a prayer "now"). */
export function refForToday(
  schedule: DaySchedule,
  prayer: PrayerRef['prayer'],
  at: number
): PrayerRef {
  return { prayer, day: schedule.day, at, isJumuah: prayer === 'dhuhr' && schedule.isFriday }
}
