import fs from 'node:fs'
import {
  DEFAULT_MEETING_CONFIG,
  type MeetingConfig,
  meetingConfigSchema
} from '../../shared/tracking/detect'
import { log } from './logger'

/**
 * The meeting-app list lives in `meeting-apps.json` in the data folder so it
 * can be edited without a new release. It is created from the shipped default
 * on first run; an invalid file falls back to the default (and is logged).
 */
export class MeetingConfigStore {
  private config: MeetingConfig = DEFAULT_MEETING_CONFIG
  private mtime = 0

  constructor(private readonly file: string) {}

  load(): MeetingConfig {
    try {
      if (!fs.existsSync(this.file)) {
        fs.writeFileSync(this.file, JSON.stringify(DEFAULT_MEETING_CONFIG, null, 2), 'utf8')
      }
      const stat = fs.statSync(this.file)
      if (stat.mtimeMs === this.mtime) return this.config
      this.mtime = stat.mtimeMs
      const parsed = meetingConfigSchema.safeParse(JSON.parse(fs.readFileSync(this.file, 'utf8')))
      if (parsed.success) {
        this.config = parsed.data
      } else {
        log.warn('meeting-apps.json is invalid, using the default list')
        this.config = DEFAULT_MEETING_CONFIG
      }
    } catch (err) {
      log.warn('meeting-apps.json unreadable, using the default list', err)
      this.config = DEFAULT_MEETING_CONFIG
    }
    return this.config
  }

  get(): MeetingConfig {
    return this.config
  }
}
