import path from 'node:path'
import { app } from 'electron'

/**
 * Uses an ASCII data folder (%APPDATA%\Waqti) instead of the Arabic product
 * name. WAQTI_USER_DATA overrides it (E2E tests use a temporary folder).
 * Must run before `app.whenReady()`.
 */
export function configureUserData(): void {
  const override = process.env['WAQTI_USER_DATA']
  const dir = override ? path.resolve(override) : path.join(app.getPath('appData'), 'Waqti')
  app.setPath('userData', dir)
  app.setPath('sessionData', path.join(dir, 'session'))
}

export const paths = {
  get userData(): string {
    return app.getPath('userData')
  },
  get db(): string {
    return path.join(app.getPath('userData'), 'waqti.db')
  },
  get backups(): string {
    return path.join(app.getPath('userData'), 'backups')
  },
  get settings(): string {
    return path.join(app.getPath('userData'), 'settings.json')
  },
  get meetingConfig(): string {
    return path.join(app.getPath('userData'), 'meeting-apps.json')
  },
  get logs(): string {
    return path.join(app.getPath('userData'), 'logs')
  },
  get resources(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'resources')
      : path.join(app.getAppPath(), 'resources')
  }
}
