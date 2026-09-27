import fs from 'node:fs'
import { app } from 'electron'
import type { RunningApp } from '../../shared/ipc'
import { friendlyAppName, processNameOf } from '../../shared/tracking/apps'
import { dayKey, addDays } from '../../shared/time'
import type { Repo } from './db/repo'
import type { Native } from './native'

/** Windows shell processes that are never "apps" the user would pick. */
const SHELL_PROCESSES = new Set([
  'applicationframehost.exe',
  'textinputhost.exe',
  'shellexperiencehost.exe',
  'searchhost.exe',
  'searchapp.exe',
  'startmenuexperiencehost.exe',
  'lockapp.exe',
  'systemsettings.exe',
  'explorer.exe'
])

/** App icons (cached data URLs) and the list of running apps. */
export class AppsService {
  private icons = new Map<string, string | null>()
  private generic: Promise<string | null> | null = null

  constructor(
    private readonly native: Native,
    private readonly repo: Repo
  ) {}

  /** Cached icon or null (call `prefetch` first to fill the cache). */
  icon(exePath: string): string | null {
    return this.icons.get(exePath) ?? null
  }

  /**
   * Windows' default "application" icon. Some apps (Office click-to-run) return
   * it instead of their real icon; those get the lettered disc instead.
   */
  private genericIcon(): Promise<string | null> {
    if (!this.generic) {
      this.generic = app
        .getFileIcon('C:/waqti-no-such-app.exe', { size: 'normal' })
        .then((img) => (img.isEmpty() ? null : img.toDataURL()))
        .catch(() => null)
    }
    return this.generic
  }

  async prefetch(paths: Iterable<string>): Promise<void> {
    const todo = [...new Set(paths)].filter((p) => p && /\.exe$/i.test(p) && !this.icons.has(p))
    if (!todo.length) return
    const generic = await this.genericIcon()
    await Promise.all(
      todo.map(async (p) => {
        // A missing file would give Windows' generic document icon; use the lettered disc instead.
        if (!fs.existsSync(p)) {
          this.icons.set(p, null)
          return
        }
        try {
          const img = await app.getFileIcon(p, { size: 'normal' })
          const url = img.isEmpty() ? null : img.toDataURL()
          this.icons.set(p, url === generic ? null : url)
        } catch {
          this.icons.set(p, null)
        }
      })
    )
  }

  /** Apps with a visible window right now, one entry per executable. */
  async running(ownPid: number): Promise<RunningApp[]> {
    const seen = new Map<string, RunningApp>()
    for (const w of this.native.listWindows()) {
      if (w.pid === ownPid) continue
      const process = processNameOf(w.exePath)
      if (SHELL_PROCESSES.has(process) || seen.has(process)) continue
      seen.set(process, {
        process,
        appName: friendlyAppName(process, this.native.fileDescription(w.exePath)),
        exePath: w.exePath,
        icon: null
      })
    }
    const list = [...seen.values()]
    await this.prefetch(list.map((a) => a.exePath))
    return list
      .map((a) => ({ ...a, icon: this.icon(a.exePath) }))
      .sort((a, b) => a.appName.localeCompare(b.appName))
  }

  /** Most used apps over the last 30 days (for pickers). */
  async recent(now: number): Promise<RunningApp[]> {
    const rows = this.repo.recentApps(addDays(dayKey(now), -30), 40)
    await this.prefetch(rows.map((r) => r.exePath))
    return rows
      .filter((r) => r.process !== 'waqti.exe' && !r.process.startsWith('uwp:'))
      .map((r) => ({
        process: r.process,
        appName: r.name,
        exePath: r.exePath,
        icon: this.icon(r.exePath)
      }))
  }
}
