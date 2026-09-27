import fs from 'node:fs'
import path from 'node:path'
import { type BrowserWindow, dialog } from 'electron'
import { type CsvRow, exportBundleSchema, toCsv } from '../../shared/export'
import { dialogs } from '../../shared/strings'
import { dayKey } from '../../shared/time'
import { allCategories, makeCategorizer } from '../../shared/tracking/categorize'
import type { Repo } from './db/repo'
import { log } from './logger'

/** Export (JSON / CSV), import (JSON) and delete-all for the Data settings. */
export class Exporter {
  constructor(private readonly repo: Repo) {}

  async export(
    win: BrowserWindow | null,
    format: 'json' | 'csv',
    now: number
  ): Promise<string | null> {
    const name = `waqti-export-${dayKey(now)}.${format}`
    const opts = {
      title: dialogs.exportTitle,
      defaultPath: name,
      filters: [
        format === 'json'
          ? { name: 'JSON', extensions: ['json'] }
          : { name: 'CSV', extensions: ['csv'] }
      ]
    }
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return null
    const bundle = this.repo.exportBundle(now)
    let content: string
    if (format === 'json') {
      content = JSON.stringify(bundle, null, 1)
    } else {
      const categories = allCategories(bundle.categories)
      const names = new Map(categories.map((c) => [c.id, c.name]))
      const categorize = makeCategorizer(bundle.rules, categories)
      const appNames = new Map(bundle.apps.map((a) => [a.process, a]))
      const rows: CsvRow[] = bundle.intervals.map((iv) => {
        const app = appNames.get(iv.process)
        const cat = categorize({ process: iv.process, exePath: app?.exePath ?? '', site: iv.site })
        return {
          day: iv.day,
          start: iv.start,
          end: iv.end,
          appName: app?.name ?? iv.process,
          process: iv.process,
          site: iv.site,
          category: names.get(cat) ?? cat,
          title: iv.title
        }
      })
      content = toCsv(rows)
    }
    fs.writeFileSync(res.filePath, content, 'utf8')
    log.info(`exported ${format} (${bundle.intervals.length} intervals)`)
    return res.filePath
  }

  async import(
    win: BrowserWindow | null
  ): Promise<{ imported: ReturnType<Repo['importBundle']> | null; error: string | null }> {
    const opts = {
      title: dialogs.importTitle,
      properties: ['openFile' as const],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    const file = res.filePaths[0]
    if (res.canceled || !file) return { imported: null, error: null }
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
      const parsed = exportBundleSchema.safeParse(raw)
      if (!parsed.success) return { imported: null, error: 'invalid' }
      const imported = this.repo.importBundle(parsed.data)
      log.info(`imported ${path.basename(file)}`, imported)
      return { imported, error: null }
    } catch (err) {
      log.warn('import failed', err)
      return { imported: null, error: 'unreadable' }
    }
  }

  /** Deletes all tracked data and the backups that contain it. */
  deleteAll(backupDir: string): void {
    this.repo.deleteAll()
    try {
      for (const f of fs.readdirSync(backupDir)) fs.rmSync(path.join(backupDir, f), { force: true })
    } catch {
      // no backups yet
    }
    log.info('all data deleted by the user')
  }
}
