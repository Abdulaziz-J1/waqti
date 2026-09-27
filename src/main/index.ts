import { app, dialog } from 'electron'
import { configureUserData, paths } from './paths'
import { log } from './services/logger'
import { openWithRecovery } from './services/db/database'
import { Repo } from './services/db/repo'
import { SettingsStore } from './services/settings-store'
import { WaqtiCore } from './core'
import { registerIpc } from './ipc'
import { toasts } from '../shared/strings'

const APP_ID = 'com.waqti.desktop'

configureUserData()
log.init(paths.logs)

process.on('uncaughtException', (err) => log.error('uncaughtException', err))
process.on('unhandledRejection', (reason) => log.error('unhandledRejection', reason))

let core: WaqtiCore | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId(APP_ID)
  app.on('second-instance', () => core?.showWindow())

  void app.whenReady().then(() => {
    try {
      const settings = new SettingsStore(paths.settings)
      const status = settings.load()
      if (status !== 'ok') log.info(`settings ${status}`)

      const opened = openWithRecovery(paths.db, paths.backups)
      if (opened.status !== 'ok') {
        log.warn(`database ${opened.status}`, { quarantined: opened.quarantined })
      }
      const repo = new Repo(opened.db)

      const startHidden = process.argv.includes('--hidden')
      core = new WaqtiCore({
        db: opened.db,
        repo,
        settings,
        startHidden,
        notice:
          opened.status === 'restored' ? 'dbRestored' : opened.status === 'reset' ? 'dbReset' : null
      })
      registerIpc(core)
      core.start()
      if (opened.status !== 'ok') {
        core.notifier.show(
          opened.status === 'restored'
            ? { title: toasts.dbRestoredTitle, body: toasts.dbRestoredBody }
            : { title: toasts.dbResetTitle, body: toasts.dbResetBody }
        )
      }
      log.info(`started v${app.getVersion()}${startHidden ? ' (hidden)' : ''}`)
    } catch (err) {
      log.error('fatal startup error', err)
      dialog.showErrorBox('وقتي', 'ما قدر وقتي يشتغل. أعد تشغيل الجهاز وجرّب مرة ثانية.')
      app.exit(1)
    }
  })

  // The app lives in the tray: closing every window does not quit it.
  app.on('window-all-closed', () => {
    if (core?.quitting) app.quit()
  })

  app.on('before-quit', () => {
    if (core && !core.quitting) {
      core.quitting = true
      core.shutdown()
    }
  })
}
