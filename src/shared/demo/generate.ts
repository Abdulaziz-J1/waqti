import type { PrayerLogEntry, PrayerOutcome, PrayerReason } from '../machine/types'
import { type LatLng, PRAYERS, buildDaySchedule } from '../prayer/schedule'
import { type DayKey, MINUTE, addDays, dayStartMs, daysBetween, weekday } from '../time'
import type { FocusSessionRecord } from '../tracking/aggregate'
import type { Interval } from '../tracking/merge'

/** Deterministic PRNG (mulberry32) so demo data is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Cat = 'work' | 'social' | 'fun' | 'other'

interface DemoApp {
  process: string
  appName: string
  exePath: string
  site: string | null
  titles: string[]
  /** Typical session length in minutes [min, max]. */
  len: [number, number]
}

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = (
  site: string,
  label: string,
  titles: string[],
  len: [number, number]
): DemoApp => ({
  process: 'chrome.exe',
  appName: 'Google Chrome',
  exePath: CHROME,
  site,
  titles: titles.map((t) => `${t} - ${label} - Google Chrome`),
  len
})
const desktop = (
  process: string,
  appName: string,
  exePath: string,
  titles: string[],
  len: [number, number]
): DemoApp => ({ process, appName, exePath, site: null, titles, len })

export const DEMO_APPS: Record<Cat, DemoApp[]> = {
  work: [
    desktop(
      'code.exe',
      'Visual Studio Code',
      'C:\\Users\\Public\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
      [
        'main.ts - graduation-project - Visual Studio Code',
        'App.tsx - portfolio - Visual Studio Code'
      ],
      [10, 45]
    ),
    desktop(
      'winword.exe',
      'Microsoft Word',
      'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
      ['تقرير المشروع.docx - Word', 'Research Paper.docx - Word'],
      [8, 35]
    ),
    desktop(
      'excel.exe',
      'Microsoft Excel',
      'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE',
      ['الميزانية.xlsx - Excel', 'Sales Q3.xlsx - Excel'],
      [5, 30]
    ),
    desktop(
      'powerpnt.exe',
      'PowerPoint',
      'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
      ['عرض التخرج.pptx - PowerPoint'],
      [5, 25]
    ),
    desktop(
      'ms-teams.exe',
      'Microsoft Teams',
      'C:\\Program Files\\WindowsApps\\MSTeams\\ms-teams.exe',
      ['Chat | Microsoft Teams'],
      [3, 20]
    ),
    browser('google-docs', 'Google Docs', ['ملخص المحاضرة'], [5, 25]),
    browser('github', 'GitHub', ['waqti/pull/42'], [3, 15]),
    browser('stackoverflow', 'Stack Overflow', ['How to merge intervals'], [2, 10]),
    browser('blackboard', 'Blackboard', ['المقررات الدراسية'], [3, 15])
  ],
  social: [
    desktop(
      'whatsapp.root.exe',
      'WhatsApp',
      'C:\\Program Files\\WindowsApps\\WhatsApp\\WhatsApp.Root.exe',
      ['WhatsApp'],
      [1, 8]
    ),
    desktop(
      'telegram.exe',
      'Telegram',
      'C:\\Users\\Public\\AppData\\Roaming\\Telegram Desktop\\Telegram.exe',
      ['Telegram'],
      [1, 6]
    ),
    desktop(
      'discord.exe',
      'Discord',
      'C:\\Users\\Public\\AppData\\Local\\Discord\\app-1.0\\Discord.exe',
      ['#general | Study Group - Discord'],
      [2, 15]
    ),
    browser('x', 'X', ['Home'], [2, 12]),
    browser('instagram', 'Instagram', ['Instagram'], [2, 10])
  ],
  fun: [
    browser(
      'youtube',
      'YouTube',
      ['شرح الخوارزميات', 'Lo-fi study mix', 'Match highlights'],
      [5, 40]
    ),
    browser('netflix', 'Netflix', ['Netflix'], [20, 50]),
    browser('tiktok', 'TikTok', ['For You'], [3, 20]),
    desktop('steam.exe', 'Steam', 'C:\\Program Files (x86)\\Steam\\steam.exe', ['Steam'], [2, 8]),
    desktop(
      'rocketleague.exe',
      'Rocket League',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\rocketleague\\Binaries\\Win64\\RocketLeague.exe',
      ['Rocket League'],
      [15, 50]
    )
  ],
  other: [
    desktop('explorer.exe', 'File Explorer', 'C:\\Windows\\explorer.exe', ['Downloads'], [1, 4]),
    desktop(
      'notepad.exe',
      'Notepad',
      'C:\\Windows\\System32\\notepad.exe',
      ['ملاحظات.txt - Notepad'],
      [1, 5]
    )
  ]
}

export interface DemoInterval extends Interval {
  day: DayKey
}

export interface DemoDistraction {
  sessionId: string
  at: number
  label: string
  process: string
  site: string | null
  action: 'back' | 'snooze'
}

export interface DemoData {
  intervals: DemoInterval[]
  sessions: FocusSessionRecord[]
  distractions: DemoDistraction[]
  prayerLog: PrayerLogEntry[]
}

export interface DemoOptions {
  /** Last day to generate (usually today). */
  endDay: DayKey
  days: number
  /** Nothing is generated after this instant. */
  now: number
  coords: LatLng
  seed?: number
  /** Multiplies app switches per hour (1 = typical, 3 = heavy user). */
  density?: number
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)]!
}

function weightsFor(hour: number, weekend: boolean): Record<Cat, number> {
  if (weekend) {
    if (hour < 12) return { work: 0.15, social: 0.3, fun: 0.4, other: 0.15 }
    return { work: 0.1, social: 0.3, fun: 0.55, other: 0.05 }
  }
  if (hour < 12) return { work: 0.68, social: 0.14, fun: 0.08, other: 0.1 }
  if (hour < 14) return { work: 0.3, social: 0.3, fun: 0.3, other: 0.1 }
  if (hour < 18) return { work: 0.6, social: 0.15, fun: 0.15, other: 0.1 }
  return { work: 0.18, social: 0.3, fun: 0.47, other: 0.05 }
}

function pickCat(r: () => number, w: Record<Cat, number>): Cat {
  let x = r()
  for (const c of ['work', 'social', 'fun', 'other'] as Cat[]) {
    x -= w[c]
    if (x <= 0) return c
  }
  return 'other'
}

/**
 * Generates realistic, deterministic demo usage: weekday study/work mornings,
 * social bursts, entertainment evenings and heavier weekends (Fri/Sat), plus
 * focus sessions and prayer lock history.
 */
export function generateDemo(opts: DemoOptions): DemoData {
  const r = rng(opts.seed ?? 1447)
  const density = Math.max(0.2, opts.density ?? 1)
  const from = addDays(opts.endDay, -(opts.days - 1))
  const out: DemoData = { intervals: [], sessions: [], distractions: [], prayerLog: [] }

  for (const day of daysBetween(from, opts.endDay)) {
    const start = dayStartMs(day)
    const wd = weekday(day)
    const weekend = wd === 5 || wd === 6
    let t = start + (weekend ? 10 : 8) * 60 * MINUTE + Math.floor(r() * 60) * MINUTE
    const end = start + 23 * 60 * MINUTE + Math.floor(r() * 60) * MINUTE

    while (t < end && t < opts.now) {
      const hour = new Date(t).getHours()
      // Offline stretches: meals, classes, outings.
      if (r() < 0.12 / density) {
        t += (10 + Math.floor(r() * 80)) * MINUTE
        continue
      }
      const cat = pickCat(r, weightsFor(hour, weekend))
      const a = pick(r, DEMO_APPS[cat])
      const lenMin = (a.len[0] + r() * (a.len[1] - a.len[0])) / density
      const iStart = t
      const iEnd = Math.min(
        t + Math.max(0.5, lenMin) * MINUTE,
        end,
        opts.now,
        start + 24 * 60 * MINUTE
      )
      if (iEnd - iStart >= 30_000) {
        out.intervals.push({
          process: a.process,
          appName: a.appName,
          exePath: a.exePath,
          site: a.site,
          title: pick(r, a.titles),
          start: iStart,
          end: iEnd,
          day
        })
      }
      t = iEnd + Math.floor((r() * 90) / density) * 1000
    }

    // Focus sessions on weekdays (and some weekends).
    const sessionCount = weekend ? (r() < 0.3 ? 1 : 0) : 1 + Math.floor(r() * 3)
    for (let i = 0; i < sessionCount; i++) {
      const planned = pick(r, [25, 25, 50, 90]) * MINUTE
      const sStart = start + (9 + i * 3 + Math.floor(r() * 2)) * 60 * MINUTE
      if (sStart + planned > opts.now) continue
      const completed = r() < 0.8
      const focusedMs = completed ? planned : Math.floor(planned * (0.3 + r() * 0.5))
      const blocked = Math.floor(r() * 4)
      const snoozed = r() < 0.25 ? 1 : 0
      const id = `demo-${day}-${i}`
      out.sessions.push({
        id,
        startedAt: sStart,
        endedAt: sStart + focusedMs,
        plannedMs: planned,
        focusedMs,
        blocked,
        snoozed,
        completed
      })
      for (let b = 0; b < blocked + snoozed; b++) {
        const d = pick(r, DEMO_APPS.fun)
        out.distractions.push({
          sessionId: id,
          at: sStart + Math.floor(r() * focusedMs),
          label: d.site ? d.titles[0]!.split(' - ')[1]! : d.appName,
          process: d.process,
          site: d.site,
          action: b < blocked ? 'back' : 'snooze'
        })
      }
    }

    // Prayer lock history.
    const sched = buildDaySchedule(day, opts.coords)
    for (const prayer of PRAYERS) {
      const at = sched.times[prayer]
      if (at > opts.now) continue
      const x = r()
      let outcome: PrayerOutcome = 'prayed'
      let reason: PrayerReason | null = null
      if (x > 0.72 && x <= 0.8) {
        outcome = 'ended'
        reason = 'duration'
      } else if (x > 0.8 && x <= 0.9) {
        outcome = 'skipped'
        reason = 'away'
      } else if (x > 0.9 && x <= 0.95) {
        outcome = 'skipped'
        reason = 'meeting'
      } else if (x > 0.95) {
        outcome = 'emergency'
      }
      const snoozed = outcome === 'prayed' && r() < 0.15
      out.prayerLog.push({
        prayer,
        day,
        scheduledAt: at,
        outcome,
        reason,
        snoozed,
        at: at + (outcome === 'skipped' ? 0 : (6 + Math.floor(r() * 10)) * MINUTE)
      })
    }
  }
  return out
}
