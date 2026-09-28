import fs from 'node:fs'
import os from 'node:os'
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

/**
 * Diagnostics for the performance audit (scripts/perf.mjs): when
 * WAQTI_PERF_LOG names a file, append one JSON line of process metrics every
 * 5 s. CPU is reported both per core (Electron's figure) and as a share of the
 * whole machine (what Task Manager shows).
 */
function startPerfLog(): void {
  const file = process.env['WAQTI_PERF_LOG']
  if (!file) return
  const cores = os.cpus().length || 1
  app.getAppMetrics()
  setInterval(() => {
    let cpu = 0
    let ws = 0
    let priv = 0
    const metrics = app.getAppMetrics()
    for (const m of metrics) {
      cpu += m.cpu.percentCPUUsage
      ws += m.memory.workingSetSize
      priv += m.memory.privateBytes ?? 0
    }
    const line = {
      t: Math.round(performance.now()),
      cpuPerCore: Math.round(cpu * 100) / 100,
      cpuMachine: Math.round((cpu / cores) * 100) / 100,
      workingSetMB: Math.round(ws / 1024),
      privateMB: Math.round(priv / 1024),
      processes: metrics
        .map((m) => `${m.type}:${Math.round(m.memory.privateBytes ?? 0) >> 10}`)
        .join(' '),
      startupMs: core?.startupMs ?? null
    }
    fs.appendFileSync(file, JSON.stringify(line) + '\n')
  }, 5000).unref()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Windows takes the taskbar icon from the Start Menu shortcut registered for
  // this ID. Unpackaged runs (npm run dev, E2E) use their own ID so a shortcut
  // left behind for node_modules' electron.exe never stands in for the installed app.
  app.setAppUserModelId(app.isPackaged ? APP_ID : `${APP_ID}.dev`)
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
      startPerfLog()
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
