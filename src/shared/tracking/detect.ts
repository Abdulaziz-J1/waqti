import type { ForegroundInfo } from './apps'
import { KNOWN_SITES, deriveSite, isBrowser } from './sites'

// ---------------------------------------------------------------------------
// Meetings and presentations (the smart rules)
// ---------------------------------------------------------------------------

export interface MeetingConfig {
  version: 1
  /** Executables that count as "in a meeting" whenever they are in the foreground. */
  apps: string[]
  /** Browser title fragments that mean a web meeting (case-insensitive). */
  browserTitles: string[]
  slideshow: {
    apps: string[]
    /** Win32 window classes of a running slideshow. */
    windowClasses: string[]
    /** Title fragments of a running slideshow (case-insensitive). */
    titles: string[]
  }
}

/** Shipped default. Copied to `meeting-apps.json` in the user data folder, where it can be edited. */
export const DEFAULT_MEETING_CONFIG: MeetingConfig = {
  version: 1,
  apps: [
    'ms-teams.exe',
    'teams.exe',
    'zoom.exe',
    'cpthost.exe',
    'webex.exe',
    'webexmta.exe',
    'ciscocollabhost.exe',
    'atmgr.exe'
  ],
  browserTitles: ['Google Meet', 'Meet - ', 'Meet – ', 'Microsoft Teams', 'Zoom Meeting', 'Webex'],
  slideshow: {
    apps: ['powerpnt.exe'],
    windowClasses: ['screenClass'],
    titles: ['PowerPoint Slide Show', 'عرض شرائح PowerPoint', 'عرض الشرائح']
  }
}

const lc = (s: string): string => s.toLowerCase()

/** True when the foreground window is a meeting app, a web meeting or a slideshow. */
export function isInMeeting(fg: ForegroundInfo | null, cfg: MeetingConfig): boolean {
  if (!fg) return false
  const proc = lc(fg.process)
  const title = lc(fg.title ?? '')
  if (cfg.apps.some((a) => lc(a) === proc)) return true
  if (isBrowser(proc) && cfg.browserTitles.some((t) => title.includes(lc(t)))) return true
  if (cfg.slideshow.apps.some((a) => lc(a) === proc)) {
    if (fg.className && cfg.slideshow.windowClasses.some((c) => c === fg.className)) return true
    if (cfg.slideshow.titles.some((t) => title.includes(lc(t)))) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Distractions (focus sessions)
// ---------------------------------------------------------------------------

export interface DistractionList {
  /** Lowercase process keys. */
  apps: string[]
  /** Known site ids (youtube, tiktok, …). */
  sites: string[]
  /** Extra keywords matched against browser titles (case-insensitive). */
  keywords: string[]
}

/** The preset site keywords offered in onboarding and the Focus screen. */
export const PRESET_DISTRACTION_SITES = [
  'youtube',
  'tiktok',
  'netflix',
  'snapchat',
  'x',
  'instagram',
  'twitch'
] as const

export interface DistractionMatch {
  kind: 'app' | 'site' | 'keyword'
  /** What matched: the app name, site label or keyword. */
  label: string
  process: string
  site: string | null
}

/**
 * Returns what makes the foreground window a distraction, or null. Site and
 * keyword matches only apply to browsers so a file called "youtube.ts" in an
 * editor never triggers the guard.
 */
export function matchDistraction(
  fg: ForegroundInfo | null,
  list: DistractionList
): DistractionMatch | null {
  if (!fg) return null
  const proc = lc(fg.process)
  if (list.apps.some((a) => lc(a) === proc)) {
    return { kind: 'app', label: fg.appName, process: fg.process, site: null }
  }
  if (!isBrowser(proc)) return null
  const site = deriveSite(proc, fg.title)
  if (site && list.sites.includes(site)) {
    const label = KNOWN_SITES.find((s) => s.id === site)?.label ?? site
    return { kind: 'site', label, process: fg.process, site }
  }
  const title = lc(fg.title ?? '')
  const kw = list.keywords.find((k) => k.trim() && title.includes(lc(k.trim())))
  if (kw) return { kind: 'keyword', label: kw.trim(), process: fg.process, site }
  return null
}
