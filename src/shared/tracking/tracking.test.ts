import { describe, expect, it } from 'vitest'
import { deriveSite, isBrowser, pageTitle, siteById, siteLabel } from './sites'
import { friendlyAppName, normalizeForeground, processNameOf } from './apps'
import {
  DEFAULT_MERGE,
  type TrackSample,
  mergeStep,
  splitByDay,
  trimInterval,
  sameActivity
} from './merge'
import {
  BUILTIN_CATEGORIES,
  DEFAULT_RULES,
  type Rule,
  allCategories,
  categorize,
  makeCategorizer
} from './categorize'
import {
  DEFAULT_MEETING_CONFIG,
  PRESET_DISTRACTION_SITES,
  isInMeeting,
  matchDistraction,
  meetingConfigSchema
} from './detect'
import type { ForegroundInfo } from './apps'

describe('site derivation', () => {
  it('recognises browsers', () => {
    expect(isBrowser('CHROME.EXE')).toBe(true)
    expect(isBrowser('code.exe')).toBe(false)
  })

  it('derives known sites from Chrome, Edge, Firefox, Brave and Opera titles', () => {
    expect(deriveSite('chrome.exe', 'Lofi mix - YouTube - Google Chrome')).toBe('youtube')
    expect(
      deriveSite('msedge.exe', 'Netflix and 3 more pages - Personal - Microsoft\u200b Edge')
    ).toBe('netflix')
    expect(deriveSite('firefox.exe', 'Home / X — Mozilla Firefox')).toBe('x')
    expect(deriveSite('brave.exe', 'Netflix - Brave')).toBe('netflix')
    expect(deriveSite('opera.exe', 'TikTok - Make Your Day - Opera')).toBe('tiktok')
    expect(
      deriveSite('chrome.exe', 'Ahmed (@ahmed) • Instagram photos and videos - Google Chrome')
    ).toBe('instagram')
    expect(deriveSite('chrome.exe', 'Meet - abc-defg-hij - Google Chrome')).toBe('google-meet')
    expect(deriveSite('chrome.exe', 'python - How to sort - Stack Overflow - Google Chrome')).toBe(
      'stackoverflow'
    )
  })

  it('falls back to a short trailing brand segment', () => {
    expect(deriveSite('chrome.exe', 'Inbox (3) - Hotmail Plus - Google Chrome')).toBe(
      'Hotmail Plus'
    )
    expect(deriveSite('chrome.exe', 'Order #1234 | Noon - Google Chrome')).toBe('Noon')
  })

  it('returns null when nothing reliable is found', () => {
    expect(deriveSite('chrome.exe', 'New Tab - Google Chrome')).toBeNull()
    expect(deriveSite('chrome.exe', null)).toBeNull()
    expect(deriveSite('code.exe', 'YouTube - Visual Studio Code')).toBeNull()
    expect(
      deriveSite(
        'chrome.exe',
        'Chapter - this segment is clearly far too long to be a site name - Google Chrome'
      )
    ).toBeNull()
    expect(deriveSite('chrome.exe', 'Build 12 - 2026 - Google Chrome')).toBeNull()
    expect(deriveSite('chrome.exe', 'Google Chrome')).toBeNull()
  })

  it('strips browser suffixes and Edge profiles', () => {
    expect(pageTitle('chrome.exe', 'Docs - Google Chrome')).toBe('Docs')
    expect(pageTitle('msedge.exe', 'Page - Work - Microsoft Edge')).toBe('Page')
    expect(pageTitle('firefox.exe', 'Page — Mozilla Firefox Private Browsing')).toBe('Page')
  })

  it('labels sites', () => {
    expect(siteLabel('youtube')).toBe('YouTube')
    expect(siteLabel('Noon')).toBe('Noon')
    expect(siteById('x')?.label).toBe('X')
  })
})

describe('apps', () => {
  it('normalises process names and friendly names', () => {
    expect(processNameOf('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')).toBe(
      'chrome.exe'
    )
    expect(friendlyAppName('code.exe', 'Visual Studio Code')).toBe('Visual Studio Code')
    expect(friendlyAppName('code.exe', '')).toBe('Visual Studio Code')
    expect(friendlyAppName('someapp.exe', null)).toBe('Someapp')
    expect(friendlyAppName('explorer.exe', 'Windows Explorer')).toBe('File Explorer')
  })

  it('identifies Store apps by window title', () => {
    const fg = normalizeForeground({
      exePath: 'C:\\Windows\\System32\\ApplicationFrameHost.exe',
      title: 'Netflix',
      pid: 1,
      hwnd: 5,
      bounds: null,
      description: 'Application Frame Host'
    })
    expect(fg.process).toBe('uwp:netflix')
    expect(fg.appName).toBe('Netflix')
    const normal = normalizeForeground({
      exePath: 'C:\\x\\Code.exe',
      title: 't',
      pid: 2,
      hwnd: null,
      bounds: null
    })
    expect(normal.process).toBe('code.exe')
    expect(normal.appName).toBe('Visual Studio Code')
  })
})

const sample = (at: number, process = 'code.exe', site: string | null = null): TrackSample => ({
  at,
  process,
  appName: process,
  exePath: `C:\\${process}`,
  site,
  title: `${process} title`
})

describe('interval merging', () => {
  it('extends the open interval with consecutive samples of the same app', () => {
    let r = mergeStep(null, sample(0))
    for (let t = 1000; t <= 5000; t += 1000) r = mergeStep(r.open, sample(t))
    expect(r.closed).toEqual([])
    expect(r.open?.start).toBe(0)
    expect(r.open?.end).toBe(6000)
  })

  it('closes the interval when the app or site changes, without overlap', () => {
    let r = mergeStep(null, sample(0))
    r = mergeStep(r.open, sample(1000))
    r = mergeStep(r.open, sample(2000, 'chrome.exe', 'youtube'))
    expect(r.closed).toHaveLength(1)
    expect(r.closed[0]).toMatchObject({ process: 'code.exe', start: 0, end: 2000 })
    expect(r.open).toMatchObject({ process: 'chrome.exe', site: 'youtube', start: 2000 })
    r = mergeStep(r.open, sample(3000, 'chrome.exe', 'github'))
    expect(r.closed[0]).toMatchObject({ site: 'youtube', end: 3000 })
  })

  it('starts a new interval after a gap', () => {
    let r = mergeStep(null, sample(0))
    r = mergeStep(r.open, sample(1000))
    r = mergeStep(r.open, sample(60_000))
    expect(r.closed[0]).toMatchObject({ start: 0, end: 2000 })
    expect(r.open?.start).toBe(60_000)
  })

  it('closes on a null sample and drops tiny intervals', () => {
    let r = mergeStep(null, sample(0))
    r = mergeStep(r.open, null)
    expect(r.open).toBeNull()
    expect(r.closed).toHaveLength(1)
    const tiny = mergeStep({ ...sample(0), start: 0, end: 500 }, sample(500, 'x.exe'))
    expect(tiny.closed).toEqual([])
    expect(mergeStep(null, null)).toEqual({ open: null, closed: [] })
  })

  it('handles the clock moving backwards', () => {
    let r = mergeStep(null, sample(10_000))
    r = mergeStep(r.open, sample(5000))
    expect(r.closed[0]).toMatchObject({ start: 10_000, end: 11_000 })
    expect(r.open?.start).toBe(5000)
  })

  it('keeps the previous title when a sample has none', () => {
    const r1 = mergeStep(null, sample(0))
    const r2 = mergeStep(r1.open, { ...sample(1000), title: null })
    expect(r2.open?.title).toBe('code.exe title')
    expect(DEFAULT_MERGE.pollMs).toBe(1000)
    expect(sameActivity({ process: 'a', site: null }, { process: 'a', site: 'x' })).toBe(false)
  })

  it('trims to the last input time when idle', () => {
    const open = { ...sample(0), start: 0, end: 300_000 }
    expect(trimInterval(open, 120_000)?.end).toBe(120_000)
    expect(trimInterval(open, 500)).toBeNull()
    expect(trimInterval(null, 1)).toBeNull()
  })

  it('splits intervals at local midnight', () => {
    const start = new Date('2026-09-27T23:50:00+03:00').getTime()
    const end = new Date('2026-09-28T00:20:00+03:00').getTime()
    const parts = splitByDay({ ...sample(0), start, end })
    expect(parts.map((p) => p.day)).toEqual(['2026-09-27', '2026-09-28'])
    expect(parts[0]!.end).toBe(new Date('2026-09-28T00:00:00+03:00').getTime())
    expect(parts[1]!.start).toBe(parts[0]!.end)
    expect(parts[1]!.end).toBe(end)
  })
})

describe('categorisation', () => {
  const ids = new Set(BUILTIN_CATEGORIES.map((c) => c.id))

  it('applies the default rule set', () => {
    expect(categorize({ process: 'code.exe', site: null }, [], ids)).toBe('work')
    expect(categorize({ process: 'winword.exe', site: null }, [], ids)).toBe('work')
    expect(categorize({ process: 'ms-teams.exe', site: null }, [], ids)).toBe('work')
    expect(categorize({ process: 'whatsapp.root.exe', site: null }, [], ids)).toBe('social')
    expect(categorize({ process: 'telegram.exe', site: null }, [], ids)).toBe('social')
    expect(categorize({ process: 'discord.exe', site: null }, [], ids)).toBe('social')
    expect(categorize({ process: 'chrome.exe', site: 'youtube' }, [], ids)).toBe('fun')
    expect(categorize({ process: 'chrome.exe', site: 'netflix' }, [], ids)).toBe('fun')
    expect(categorize({ process: 'steam.exe', site: null }, [], ids)).toBe('fun')
    expect(
      categorize(
        {
          process: 'game.exe',
          exePath: 'D:\\SteamLibrary\\steamapps\\common\\Game\\game.exe',
          site: null
        },
        [],
        ids
      )
    ).toBe('fun')
    expect(categorize({ process: 'chrome.exe', site: null }, [], ids)).toBe('other')
    expect(categorize({ process: 'unknown.exe', site: null }, [], ids)).toBe('other')
  })

  it('lets user rules override defaults (retroactively, at query time)', () => {
    const user: Rule[] = [
      { kind: 'site', pattern: 'youtube', categoryId: 'work' },
      { kind: 'app', pattern: 'chrome.exe', categoryId: 'work' },
      { kind: 'path', pattern: 'd:\\games\\', categoryId: 'fun' }
    ]
    expect(categorize({ process: 'chrome.exe', site: 'youtube' }, user, ids)).toBe('work')
    expect(categorize({ process: 'chrome.exe', site: null }, user, ids)).toBe('work')
    expect(
      categorize({ process: 'x.exe', exePath: 'D:\\Games\\x.exe', site: null }, user, ids)
    ).toBe('fun')
    // Site rules beat app rules.
    expect(
      categorize(
        { process: 'chrome.exe', site: 'netflix' },
        [{ kind: 'app', pattern: 'chrome.exe', categoryId: 'work' }],
        ids
      )
    ).toBe('fun')
  })

  it('falls back to أخرى when a rule points at a deleted category', () => {
    const user: Rule[] = [{ kind: 'app', pattern: 'code.exe', categoryId: 'gone' }]
    expect(categorize({ process: 'code.exe', site: null }, user, ids)).toBe('other')
  })

  it('memoises categorisation per activity and supports custom categories', () => {
    const custom = { id: 'quran', name: 'قرآن', color: '#5E9E4A', builtin: false }
    const cats = allCategories([custom, { ...BUILTIN_CATEGORIES[0]!, builtin: true }])
    expect(cats.map((c) => c.id)).toEqual(['work', 'social', 'fun', 'other', 'quran'])
    const cat = makeCategorizer([{ kind: 'site', pattern: 'Quran.com', categoryId: 'quran' }], cats)
    expect(cat({ process: 'chrome.exe', site: 'quran.com' })).toBe('quran')
    expect(cat({ process: 'chrome.exe', site: 'quran.com' })).toBe('quran')
    expect(DEFAULT_RULES.length).toBeGreaterThan(40)
  })
})

const fg = (over: Partial<ForegroundInfo>): ForegroundInfo => ({
  process: 'code.exe',
  exePath: 'C:\\code.exe',
  appName: 'Code',
  title: '',
  pid: 1,
  hwnd: 1,
  bounds: null,
  ...over
})

describe('meeting detection', () => {
  const cfg = DEFAULT_MEETING_CONFIG

  it('detects meeting apps, web meetings and slideshows', () => {
    expect(isInMeeting(fg({ process: 'ms-teams.exe' }), cfg)).toBe(true)
    expect(isInMeeting(fg({ process: 'zoom.exe' }), cfg)).toBe(true)
    expect(
      isInMeeting(fg({ process: 'chrome.exe', title: 'Meet - abc - Google Chrome' }), cfg)
    ).toBe(true)
    expect(
      isInMeeting(fg({ process: 'msedge.exe', title: 'Google Meet - Microsoft Edge' }), cfg)
    ).toBe(true)
    expect(
      isInMeeting(fg({ process: 'powerpnt.exe', title: 'x', className: 'screenClass' }), cfg)
    ).toBe(true)
    expect(
      isInMeeting(fg({ process: 'powerpnt.exe', title: 'PowerPoint Slide Show - deck.pptx' }), cfg)
    ).toBe(true)
  })

  it('does not flag normal work', () => {
    expect(isInMeeting(fg({ process: 'powerpnt.exe', title: 'deck.pptx - PowerPoint' }), cfg)).toBe(
      false
    )
    expect(isInMeeting(fg({ process: 'code.exe', title: 'Google Meet notes' }), cfg)).toBe(false)
    expect(isInMeeting(null, cfg)).toBe(false)
  })

  it('validates the meeting config file shape', () => {
    expect(meetingConfigSchema.safeParse(cfg).success).toBe(true)
    expect(meetingConfigSchema.safeParse({ version: 1, apps: [] }).success).toBe(false)
  })
})

describe('distraction matching', () => {
  const list = { apps: ['steam.exe'], sites: [...PRESET_DISTRACTION_SITES], keywords: ['anime'] }

  it('matches apps, sites and keywords', () => {
    expect(matchDistraction(fg({ process: 'steam.exe', appName: 'Steam' }), list)).toMatchObject({
      kind: 'app',
      label: 'Steam'
    })
    expect(
      matchDistraction(fg({ process: 'chrome.exe', title: 'Clip - YouTube - Google Chrome' }), list)
    ).toMatchObject({ kind: 'site', label: 'YouTube', site: 'youtube' })
    expect(
      matchDistraction(
        fg({ process: 'chrome.exe', title: 'Best Anime 2026 - Google Chrome' }),
        list
      )
    ).toMatchObject({ kind: 'keyword', label: 'anime' })
  })

  it('ignores non-browsers for site keywords and non-matching pages', () => {
    expect(
      matchDistraction(fg({ process: 'code.exe', title: 'youtube.ts - anime' }), list)
    ).toBeNull()
    expect(
      matchDistraction(
        fg({ process: 'chrome.exe', title: 'Docs - Google Docs - Google Chrome' }),
        list
      )
    ).toBeNull()
    expect(matchDistraction(null, list)).toBeNull()
  })
})
