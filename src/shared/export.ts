import { z } from 'zod'
import { csvHeaders } from './strings'

const prayerId = z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])

/** Shape of `waqti-export-*.json`, validated before import. */
export const exportBundleSchema = z.object({
  format: z.literal('waqti-export'),
  version: z.literal(1),
  exportedAt: z.number(),
  apps: z.array(z.object({ process: z.string().min(1), name: z.string(), exePath: z.string() })),
  intervals: z.array(
    z.object({
      process: z.string().min(1),
      site: z.string().nullable(),
      title: z.string().nullable(),
      start: z.number(),
      end: z.number(),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    })
  ),
  focusSessions: z.array(
    z.object({
      id: z.string().min(1),
      startedAt: z.number(),
      endedAt: z.number(),
      plannedMs: z.number(),
      focusedMs: z.number(),
      blocked: z.number().int(),
      snoozed: z.number().int(),
      completed: z.boolean()
    })
  ),
  distractions: z.array(
    z.object({
      sessionId: z.string(),
      at: z.number(),
      label: z.string(),
      process: z.string(),
      site: z.string().nullable(),
      action: z.enum(['back', 'snooze'])
    })
  ),
  prayerLog: z.array(
    z.object({
      prayer: prayerId,
      day: z.string(),
      scheduledAt: z.number(),
      outcome: z.enum(['prayed', 'ended', 'emergency', 'skipped']),
      reason: z
        .enum([
          'duration',
          'safety',
          'away',
          'meeting',
          'asleep',
          'late-start',
          'interrupted',
          'superseded'
        ])
        .nullable(),
      snoozed: z.boolean(),
      at: z.number()
    })
  ),
  categories: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      color: z.string(),
      builtin: z.boolean()
    })
  ),
  rules: z.array(
    z.object({
      kind: z.enum(['app', 'site', 'path']),
      pattern: z.string().min(1),
      categoryId: z.string().min(1)
    })
  )
})

export type ExportBundle = z.infer<typeof exportBundleSchema>

export interface CsvRow {
  day: string
  start: number
  end: number
  appName: string
  process: string
  site: string | null
  category: string
  title: string | null
}

export function csvEscape(v: string | number | null): string {
  if (v === null) return ''
  const s = String(v)
  // Guard against spreadsheet formula injection from window titles.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Local "YYYY-MM-DD HH:MM:SS" (Latin digits, spreadsheet friendly). */
export function localStamp(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const BOM = String.fromCharCode(0xfeff)

/** CSV with a UTF-8 BOM so Excel shows Arabic correctly. */
export function toCsv(rows: readonly CsvRow[]): string {
  const lines = [csvHeaders.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.day,
        localStamp(r.start),
        localStamp(r.end),
        Math.round(((r.end - r.start) / 60000) * 100) / 100,
        r.appName,
        r.process,
        r.site,
        r.category,
        r.title
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}
