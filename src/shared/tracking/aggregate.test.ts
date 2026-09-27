import { describe, expect, it } from 'vitest'
import {
  type TimelineRow,
  type UsageRow,
  activityKey,
  activityLabel,
  focusStats,
  reportWindow,
  stackByDay,
  sumMs,
  timelineSegments,
  topActivities,
  totalsByCategory
} from './aggregate'
import { BUILTIN_CATEGORIES, makeCategorizer } from './categorize'
import { HOUR, MINUTE, dayStartMs } from '../time'

const cat = makeCategorizer([], BUILTIN_CATEGORIES)

const row = (day: string, process: string, site: string | null, minutes: number): UsageRow => ({
  day,
  process,
  appName: process === 'chrome.exe' ? 'Google Chrome' : process,
  exePath: `C:\\${process}`,
  site,
  ms: minutes * MINUTE
})

const rows: UsageRow[] = [
  row('2026-09-26', 'code.exe', null, 120),
  row('2026-09-27', 'code.exe', null, 60),
  row('2026-09-27', 'chrome.exe', 'youtube', 45),
  row('2026-09-27', 'chrome.exe', null, 10),
  row('2026-09-27', 'whatsapp.exe', null, 20)
]

describe('aggregation', () => {
  it('keys and labels activities', () => {
    expect(activityKey({ process: 'chrome.exe', site: 'youtube' })).toBe('site:youtube')
    expect(activityKey({ process: 'code.exe', site: null })).toBe('app:code.exe')
    expect(activityLabel({ appName: 'Google Chrome', site: 'youtube' })).toBe('YouTube')
    expect(sumMs(rows)).toBe(255 * MINUTE)
  })

  it('totals by category in category order, including zeros', () => {
    const t = totalsByCategory(rows, cat, BUILTIN_CATEGORIES)
    expect(t.map((x) => [x.categoryId, x.ms / MINUTE])).toEqual([
      ['work', 180],
      ['social', 20],
      ['fun', 45],
      ['other', 10]
    ])
  })

  it('ranks top activities with sites as their own entries', () => {
    const top = topActivities(rows, cat, 3)
    expect(top.map((a) => [a.label, a.ms / MINUTE, a.categoryId])).toEqual([
      ['code.exe', 180, 'work'],
      ['YouTube', 45, 'fun'],
      ['whatsapp.exe', 20, 'social']
    ])
  })

  it('stacks per day with zero days present', () => {
    const s = stackByDay(rows, ['2026-09-25', '2026-09-26', '2026-09-27'], cat)
    expect(s[0]).toEqual({ day: '2026-09-25', total: 0, byCategory: {} })
    expect(s[1]!.byCategory['work']).toBe(120 * MINUTE)
    expect(s[2]!.total).toBe(135 * MINUTE)
    expect(stackByDay([row('2020-01-01', 'a', null, 1)], ['2026-09-27'], cat)[0]!.total).toBe(0)
  })

  it('builds timeline segments, joining short gaps of the same activity', () => {
    const day = '2026-09-27'
    const base = dayStartMs(day)
    const tl = (
      startMin: number,
      endMin: number,
      process: string,
      site: string | null = null
    ): TimelineRow => ({
      start: base + startMin * MINUTE,
      end: base + endMin * MINUTE,
      process,
      appName: process,
      exePath: '',
      site
    })
    const segs = timelineSegments(
      [
        tl(600, 630, 'code.exe'),
        tl(631, 650, 'code.exe'),
        tl(650, 660, 'chrome.exe', 'youtube'),
        tl(700, 720, 'code.exe'),
        tl(-30, 10, 'late.exe'),
        tl(1430, 1500, 'night.exe'),
        tl(800, 800, 'zero.exe')
      ],
      cat,
      day
    )
    expect(segs.map((s) => [s.label, s.startMin, s.endMin])).toEqual([
      ['late.exe', 0, 10],
      ['code.exe', 600, 650],
      ['YouTube', 650, 660],
      ['code.exe', 700, 720],
      ['night.exe', 1430, 1440]
    ])
    expect(segs[1]!.ms).toBe(49 * MINUTE)
    expect(segs[2]!.categoryId).toBe('fun')
  })
})

describe('report windows', () => {
  const now = new Date('2026-09-27T15:00:00+03:00').getTime()

  it('clips today and compares with yesterday at the same time', () => {
    const w = reportWindow('day', '2026-09-27', now)
    expect(w.days).toEqual(['2026-09-27'])
    expect(w.end).toBe(now)
    expect(w.prevStart).toBe(dayStartMs('2026-09-26'))
    expect(w.prevEnd - w.prevStart).toBe(15 * HOUR)
  })

  it('uses rolling 7 and 30 day windows', () => {
    const wk = reportWindow('week', '2026-09-27', now)
    expect(wk.from).toBe('2026-09-21')
    expect(wk.days).toHaveLength(7)
    expect(wk.prevStart).toBe(dayStartMs('2026-09-14'))
    const mo = reportWindow('month', '2026-09-27', now)
    expect(mo.days).toHaveLength(30)
    expect(mo.from).toBe('2026-08-29')
  })

  it('uses full days for past anchors', () => {
    const w = reportWindow('day', '2026-09-20', now)
    expect(w.end - w.start).toBe(24 * HOUR)
    expect(w.prevEnd - w.prevStart).toBe(24 * HOUR)
  })
})

describe('focus stats', () => {
  it('summarises sessions', () => {
    const s = focusStats([
      {
        id: 'a',
        startedAt: 0,
        endedAt: 1,
        plannedMs: 25 * MINUTE,
        focusedMs: 25 * MINUTE,
        blocked: 2,
        snoozed: 1,
        completed: true
      },
      {
        id: 'b',
        startedAt: 0,
        endedAt: 1,
        plannedMs: 50 * MINUTE,
        focusedMs: 20 * MINUTE,
        blocked: 1,
        snoozed: 0,
        completed: false
      }
    ])
    expect(s).toEqual({
      sessions: 2,
      completed: 1,
      focusedMs: 45 * MINUTE,
      blocked: 3,
      snoozed: 1,
      completionRate: 0.5,
      longestMs: 25 * MINUTE
    })
    expect(focusStats([]).completionRate).toBe(0)
  })
})
