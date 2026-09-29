import { describe, expect, it } from 'vitest'
import { SETTINGS_VERSION, applyPatch, defaultSettings, settingsSchema } from './schema'
import { migrateSettings } from './migrate'
import {
  adjustmentsOf,
  coordsOf,
  forcedLockPlan,
  locationLabel,
  lockDelayMinutesFor,
  lockPlanFor,
  machineConfigOf,
  reminderMinutesFor
} from './plan'
import { MINUTE } from '../time'

describe('settings schema', () => {
  it('produces complete defaults', () => {
    const s = defaultSettings()
    expect(s.version).toBe(SETTINGS_VERSION)
    expect(s.onboarded).toBe(false)
    expect(s.location).toEqual({ kind: 'city', cityId: 'riyadh' })
    expect(s.prayers.maghrib.lockMinutes).toBe(10)
    expect(s.prayers.asr).toEqual({ lock: true, lockMinutes: 15, lockDelayMinutes: 20, adjust: 0 })
    expect(s.prayers.fajr.lockDelayMinutes).toBe(25)
    expect(s.prayers.maghrib.lockDelayMinutes).toBe(10)
    expect(s.ramadanLockDelay).toEqual({ fajr: 20, maghrib: 15 })
    expect(s.adhanNotice).toBe(true)
    expect(s.pauseMedia).toBe(true)
    expect(s.reminderMinutes).toBe(10)
    expect(s.friday).toEqual({ lock: true, reminderMinutes: 45, lockMinutes: 40 })
    expect(s.minUnlockMinutes).toBe(5)
    expect(s.distractions.sites).toContain('youtube')
    expect(s.general).toMatchObject({ digits: 'arab', clock: '12h', closeToTray: true })
    expect(s.appearance).toEqual({ theme: 'sky', reduceMotion: false })
    expect(s.tracking).toMatchObject({ idleMinutes: 3, storeTitles: true, retentionDays: 365 })
  })

  it('replaces invalid fields with defaults instead of failing', () => {
    const s = settingsSchema.parse({
      reminderMinutes: 999,
      minUnlockMinutes: -3,
      prayers: { fajr: { adjust: 40, lock: 'yes' } },
      general: { digits: 'roman' },
      location: { kind: 'custom', lat: 200, lng: 0 },
      tracking: { retentionDays: 7 }
    })
    expect(s.reminderMinutes).toBe(10)
    expect(s.minUnlockMinutes).toBe(5)
    expect(s.prayers.fajr).toEqual({ lock: true, lockMinutes: 15, lockDelayMinutes: 25, adjust: 0 })
    expect(s.general.digits).toBe('arab')
    expect(s.location).toEqual({ kind: 'city', cityId: 'riyadh' })
    expect(s.tracking.retentionDays).toBe(365)
  })

  it('deep-merges patches (arrays and location replace)', () => {
    const base = defaultSettings()
    const s = applyPatch(base, {
      prayers: { asr: { lockMinutes: 20 } },
      distractions: { apps: ['steam.exe'] },
      location: { kind: 'custom', lat: 21.5, lng: 39.2 }
    })
    expect(s.prayers.asr).toEqual({ lock: true, lockMinutes: 20, lockDelayMinutes: 20, adjust: 0 })
    expect(s.prayers.fajr).toEqual(base.prayers.fajr)
    expect(s.distractions.apps).toEqual(['steam.exe'])
    expect(s.distractions.sites).toEqual(base.distractions.sites)
    expect(s.location).toEqual({ kind: 'custom', lat: 21.5, lng: 39.2 })
    expect(applyPatch(base, { general: { clock: undefined } }).general.clock).toBe('12h')
  })
})

describe('settings migrations', () => {
  it('resets unusable files', () => {
    expect(migrateSettings(null).status).toBe('reset')
    expect(migrateSettings('garbage').status).toBe('reset')
    expect(migrateSettings([1, 2]).settings.version).toBe(SETTINGS_VERSION)
  })

  it('accepts the current version as-is', () => {
    const r = migrateSettings({ ...defaultSettings(), onboarded: true })
    expect(r.status).toBe('ok')
    expect(r.settings.onboarded).toBe(true)
  })

  it('keeps what it understands from a newer version', () => {
    const r = migrateSettings({ version: 99, onboarded: true, futureField: 1 })
    expect(r.status).toBe('newer')
    expect(r.settings.onboarded).toBe(true)
    expect(r.settings.version).toBe(SETTINGS_VERSION)
  })

  it('runs every migration in order from the stored version', () => {
    const calls: number[] = []
    const migrations = {
      0: (raw: Record<string, unknown>) => {
        calls.push(0)
        return { ...raw, onboarded: raw['firstRunDone'] === true }
      },
      1: (raw: Record<string, unknown>) => {
        calls.push(1)
        return { ...raw, reminderMinutes: Number(raw['reminder']) }
      }
    }
    const r = migrateSettings({ firstRunDone: true, reminder: 15 }, migrations, 2)
    expect(calls).toEqual([0, 1])
    expect(r.status).toBe('migrated')
    expect(r.from).toBe(0)
    expect(r.settings.onboarded).toBe(true)
    expect(r.settings.reminderMinutes).toBe(15)
    expect(r.settings.version).toBe(2)
  })

  it('skips missing steps', () => {
    const r = migrateSettings({ version: 0, onboarded: true }, {}, 1)
    expect(r.status).toBe('migrated')
    expect(r.settings.onboarded).toBe(true)
  })
})

describe('plan resolution', () => {
  const s = defaultSettings()

  it('resolves coordinates for cities and custom locations', () => {
    expect(coordsOf(s)).toEqual({ lat: 24.7136, lng: 46.6753 })
    const custom = applyPatch(s, { location: { kind: 'custom', lat: 21, lng: 40 } })
    expect(coordsOf(custom)).toEqual({ lat: 21, lng: 40 })
    const unknown = { ...s, location: { kind: 'city' as const, cityId: 'atlantis' } }
    expect(coordsOf(unknown)).toEqual({ lat: 24.7136, lng: 46.6753 })
    expect(locationLabel(s, 'مخصص')).toBe('الرياض')
    expect(locationLabel(custom, 'مخصص')).toBe('مخصص')
    expect(locationLabel(unknown, 'مخصص')).toBe('مخصص')
  })

  it('resolves lock plans, including Friday and disabled prayers', () => {
    expect(lockPlanFor(s, 'asr', false)).toEqual({
      lockMs: 15 * MINUTE,
      minUnlockMs: 5 * MINUTE,
      chime: true
    })
    expect(lockPlanFor(s, 'dhuhr', true)?.lockMs).toBe(40 * MINUTE)
    const off = applyPatch(s, { prayers: { asr: { lock: false } }, friday: { lock: false } })
    expect(lockPlanFor(off, 'asr', false)).toBeNull()
    expect(lockPlanFor(off, 'dhuhr', true)).toBeNull()
    expect(forcedLockPlan(off, 'asr', false).lockMs).toBe(15 * MINUTE)
    expect(forcedLockPlan(s, 'maghrib', false).lockMs).toBe(10 * MINUTE)
  })

  it('resolves the lock delay after the adhan, with Ramadan and Friday rules', () => {
    expect(lockDelayMinutesFor(s, 'dhuhr', false, false)).toBe(20)
    expect(lockDelayMinutesFor(s, 'fajr', false, false)).toBe(25)
    expect(lockDelayMinutesFor(s, 'fajr', false, true)).toBe(20)
    expect(lockDelayMinutesFor(s, 'maghrib', false, true)).toBe(15)
    expect(lockDelayMinutesFor(s, 'isha', false, true)).toBe(20)
    expect(lockDelayMinutesFor(s, 'dhuhr', true, false)).toBe(0)
    const custom = applyPatch(s, {
      prayers: { asr: { lockDelayMinutes: 5 } },
      ramadanLockDelay: { fajr: 10 }
    })
    expect(lockDelayMinutesFor(custom, 'asr', false, false)).toBe(5)
    expect(lockDelayMinutesFor(custom, 'fajr', false, true)).toBe(10)
    // Out of range falls back to the default.
    expect(
      applyPatch(s, { prayers: { asr: { lockDelayMinutes: 90 } } }).prayers.asr.lockDelayMinutes
    ).toBe(20)
  })

  it('resolves reminders, adjustments and machine config', () => {
    expect(reminderMinutesFor(s, false)).toBe(10)
    expect(reminderMinutesFor(s, true)).toBe(45)
    expect(adjustmentsOf(applyPatch(s, { prayers: { isha: { adjust: -3 } } })).isha).toBe(-3)
    const cfg = machineConfigOf(applyPatch(s, { smart: { skipWhenAway: false } }))
    expect(cfg.skipWhenAway).toBe(false)
    expect(cfg.deferInMeetings).toBe(true)
  })
})
