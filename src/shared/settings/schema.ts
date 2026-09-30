import { z } from 'zod'
import { DEFAULT_FOCUS_SECONDS, MAX_FOCUS_SECONDS, MIN_FOCUS_SECONDS } from '../focus'
import { DEFAULT_CITY_ID } from '../prayer/cities'
import { PRESET_DISTRACTION_SITES } from '../tracking/detect'

export const SETTINGS_VERSION = 1

const int = (min: number, max: number, fallback: number) =>
  z.number().int().min(min).max(max).catch(fallback)
const bool = (fallback: boolean) => z.boolean().catch(fallback)

/** An object whose missing or malformed value becomes `{}`, so every field takes its default. */
const section = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess(
    (v) => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v : {}),
    z.object(shape)
  )

const prayerSettings = (lockMinutes: number, lockDelayMinutes: number) =>
  section({
    lock: bool(true),
    lockMinutes: int(5, 60, lockMinutes),
    /** Minutes from the adhan to the lock (the iqama); 0 locks with the adhan. */
    lockDelayMinutes: int(0, 30, lockDelayMinutes),
    adjust: int(-15, 15, 0)
  })

const locationSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('city'), cityId: z.string().min(1) }),
    z.object({
      kind: z.literal('custom'),
      lat: z.number().min(-65).max(65),
      lng: z.number().min(-180).max(180),
      label: z.string().max(40).optional()
    })
  ])
  .catch({ kind: 'city', cityId: DEFAULT_CITY_ID })

export const settingsSchema = section({
  version: z.number().int().catch(SETTINGS_VERSION),
  onboarded: bool(false),
  location: locationSchema,
  // Lock delays follow the usual gap between adhan and iqama in Saudi mosques.
  prayers: section({
    fajr: prayerSettings(15, 25),
    dhuhr: prayerSettings(15, 20),
    asr: prayerSettings(15, 20),
    maghrib: prayerSettings(10, 10),
    isha: prayerSettings(15, 20)
  }),
  /** In Ramadan the iqama moves for Fajr (earlier) and Maghrib (later). */
  ramadanLockDelay: section({
    fajr: int(0, 30, 20),
    maghrib: int(0, 30, 15)
  }),
  /** Minutes before each prayer's adhan for the toast; 0 disables. */
  reminderMinutes: int(0, 60, 10),
  /** A 10-second notice when the adhan time comes (the lock follows at the iqama). */
  adhanNotice: bool(true),
  friday: section({
    lock: bool(true),
    reminderMinutes: int(0, 120, 45),
    lockMinutes: int(5, 60, 40)
  }),
  chime: bool(true),
  /** Pause whatever is playing (video, audio) when a lock starts. */
  pauseMedia: bool(true),
  /** Minutes before "صلّيت" becomes available. */
  minUnlockMinutes: int(0, 15, 5),
  /** Seconds to hold «خروج طارئ»; longer than 10 s would stop being an emergency exit. */
  emergencyHoldSeconds: int(3, 10, 3),
  /** Once per prayer; `minutes` is the default the lock screen offers first. */
  snooze: section({
    enabled: bool(true),
    minutes: int(1, 15, 5)
  }),
  /** Mute the sound while locked and put it back as it was afterwards. */
  muteDuringLock: bool(true),
  smart: section({
    skipWhenAway: bool(true),
    deferInMeetings: bool(true)
  }),
  distractions: section({
    apps: z.array(z.string().min(1).max(200)).max(200).catch([]),
    sites: z
      .array(z.string().min(1).max(100))
      .max(100)
      .catch([...PRESET_DISTRACTION_SITES]),
    keywords: z.array(z.string().min(1).max(60)).max(100).catch([]),
    /** Sites Waqti does not know, matched by name in browser titles (like keywords). */
    customSites: z.array(z.string().min(1).max(60)).max(100).catch([]),
    /**
     * Added apps, sites and keywords stay on the list as chips while switched
     * off; the lists above hold the ones that are on.
     */
    listedApps: z.array(z.string().min(1).max(200)).max(200).catch([]),
    listedSites: z.array(z.string().min(1).max(100)).max(100).catch([]),
    listedCustomSites: z.array(z.string().min(1).max(60)).max(100).catch([]),
    listedKeywords: z.array(z.string().min(1).max(60)).max(100).catch([]),
    /** Preset sites (YouTube, X…) taken off the list; the site picker offers them again. */
    hiddenPresets: z.array(z.string().min(1).max(100)).max(50).catch([])
  }),
  focus: section({
    /** The length on the dial: the last one started, 30 minutes at first. */
    lastSeconds: int(MIN_FOCUS_SECONDS, MAX_FOCUS_SECONDS, DEFAULT_FOCUS_SECONDS),
    breakReminder: bool(true),
    breakMinutes: int(1, 60, 5)
  }),
  tracking: section({
    paused: bool(false),
    idleMinutes: int(1, 30, 3),
    storeTitles: bool(true),
    excludedApps: z.array(z.string().min(1).max(200)).max(200).catch([]),
    /** 0 = keep forever. */
    retentionDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.literal(0)]).catch(365)
  }),
  general: section({
    /** Interface language; English also turns the layout left to right. */
    language: z.enum(['ar', 'en']).catch('ar'),
    launchAtStartup: bool(true),
    closeToTray: bool(true),
    closeHintShown: bool(false),
    digits: z.enum(['arab', 'latn']).catch('arab'),
    clock: z.enum(['12h', '24h']).catch('12h')
  }),
  appearance: section({
    theme: z.enum(['sky', 'light', 'dark']).catch('sky'),
    reduceMotion: bool(false),
    /** The sidebar shows only the icons, the logo and the tracking switch. */
    sidebarCollapsed: bool(false)
  })
})

export type Settings = z.infer<typeof settingsSchema>
export type ThemeSetting = Settings['appearance']['theme']
export type LocationSetting = Settings['location']

export function defaultSettings(): Settings {
  return settingsSchema.parse({ version: SETTINGS_VERSION })
}

/** Deep partial used for settings updates over IPC. */
export type SettingsPatch = {
  [K in keyof Settings]?: Settings[K] extends unknown[]
    ? Settings[K]
    : Settings[K] extends object
      ? {
          [P in keyof Settings[K]]?: Settings[K][P] extends object
            ? Partial<Settings[K][P]>
            : Settings[K][P]
        }
      : Settings[K]
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Deep-merges a patch (arrays replace) and re-validates. Invalid fields fall back to defaults. */
export function applyPatch(current: Settings, patch: unknown): Settings {
  const merge = (a: unknown, b: unknown): unknown => {
    if (!isPlainObject(a) || !isPlainObject(b)) return b === undefined ? a : b
    const out: Record<string, unknown> = { ...a }
    for (const [k, v] of Object.entries(b)) {
      // The location union is replaced as a whole.
      out[k] = k === 'location' ? v : merge(a[k], v)
    }
    return out
  }
  return settingsSchema.parse({ ...(merge(current, patch) as object), version: SETTINGS_VERSION })
}
