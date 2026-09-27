import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { log } from './logger'
import { migrateSettings, type MigrationStatus } from '../../shared/settings/migrate'
import { type Settings, applyPatch, defaultSettings } from '../../shared/settings/schema'

/** Loads, migrates and atomically saves `settings.json`. Emits `change` (next, prev). */
export class SettingsStore extends EventEmitter {
  private current: Settings = defaultSettings()

  constructor(private readonly file: string) {
    super()
  }

  load(): MigrationStatus {
    let raw: unknown = null
    let existed = false
    try {
      if (fs.existsSync(this.file)) {
        existed = true
        raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
      }
    } catch (err) {
      log.warn('settings.json unreadable, keeping a copy and using defaults', err)
      try {
        fs.copyFileSync(this.file, `${this.file}.broken`)
      } catch {
        // ignore
      }
    }
    const result = migrateSettings(existed ? raw : {})
    this.current = result.settings
    if (result.status !== 'ok' || !existed) this.save()
    return existed ? result.status : 'ok'
  }

  get(): Settings {
    return this.current
  }

  update(patch: unknown): Settings {
    const prev = this.current
    this.current = applyPatch(prev, patch)
    this.save()
    this.emit('change', this.current, prev)
    return this.current
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.current, null, 2), 'utf8')
      fs.renameSync(tmp, this.file)
    } catch (err) {
      log.error('Could not save settings', err)
    }
  }
}
