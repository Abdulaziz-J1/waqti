import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { BrowserWindow, app, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type { WaqtiCore } from './core'
import { paths } from './paths'
import { log } from './services/logger'
import { isAppUrl } from './services/windows'
import { type Channel, type RequestOf, type ResponseMap, requestSchemas } from '../shared/ipc'
import { CHANNELS } from '../shared/ipc-channels'
import { buildDaySchedule } from '../shared/prayer/schedule'
import { coordsOf } from '../shared/settings/plan'
import { defaultSettings } from '../shared/settings/schema'
import { MINUTE, dayEndMs, dayKey, dayStartMs } from '../shared/time'
import { BUILTIN_CATEGORIES, allCategories } from '../shared/tracking/categorize'

type Handler<C extends Channel> = (
  req: RequestOf<C>,
  e: IpcMainInvokeEvent
) => ResponseMap[C] | Promise<ResponseMap[C]>

type Handlers = { [C in Channel]: Handler<C> }

function readLicenses(): string {
  const candidates = [
    path.join(paths.resources, 'THIRD_PARTY_LICENSES.txt'),
    path.join(app.getAppPath(), 'THIRD_PARTY_LICENSES')
  ]
  for (const f of candidates) {
    try {
      if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8')
    } catch {
      // try the next one
    }
  }
  return ''
}

export function registerIpc(core: WaqtiCore): void {
  const winOf = (e: IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(e.sender)
  const requireOverlay = (e: IpcMainInvokeEvent, kind: 'lock' | 'guard'): void => {
    if (core.overlays.kindOf(winOf(e))?.kind !== kind)
      throw new Error(`${kind} action from a non-${kind} window`)
  }
  const changed = (): void => core.send('data:changed', null)

  const handlers: Handlers = {
    'app:snapshot': () => core.snapshot(),
    'app:info': () => ({
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      userDataPath: paths.userData,
      logPath: paths.logs,
      licenses: readLicenses()
    }),
    'app:ready': () => {
      if (core.startupMs === null) {
        core.startupMs = Math.round(performance.now())
        log.info(`interactive after ${core.startupMs} ms`)
      }
      if (core.pendingSummary) core.send('focus:summary', core.pendingSummary)
      return null
    },
    'app:openFolder': async ({ which }) => {
      await shell.openPath(which === 'logs' ? paths.logs : paths.userData)
      return null
    },
    'app:dismissNotice': () => {
      core.notice = null
      core.markDirty()
      return null
    },
    'settings:update': (patch) => core.settings.update(patch),
    'onboarding:complete': ({ launchAtStartup }) => {
      core.settings.update({ onboarded: true, general: { launchAtStartup } })
      return null
    },
    'prayer:preview': ({ location }) => {
      try {
        const s = { ...defaultSettings(), location }
        const schedule = buildDaySchedule(dayKey(core.clock.now()), coordsOf(s))
        return { schedule, error: null }
      } catch (err) {
        return { schedule: null, error: String(err) }
      }
    },
    'prayer:history': ({ from, to }) => core.repo.prayersBetween(from, to),
    'today:get': async () => {
      const data = core.analytics.today(core.clock.now())
      await core.apps.prefetch(data.top.map((a) => a.exePath))
      data.top = data.top.map((a) => ({ ...a, icon: core.apps.icon(a.exePath) }))
      return data
    },
    'reports:get': async ({ kind, anchor }) => {
      const data = core.analytics.report(kind, anchor, core.clock.now())
      await core.apps.prefetch(data.activities.map((a) => a.exePath))
      data.activities = data.activities.map((a) => ({ ...a, icon: core.apps.icon(a.exePath) }))
      return data
    },
    'focus:start': ({ minutes }) => {
      core.startFocus(minutes)
      return null
    },
    'focus:stop': () => {
      core.dispatch({ type: 'FOCUS_STOP', now: core.clock.now() })
      return null
    },
    'focus:sessions': ({ from, to }) => core.repo.sessionsBetween(dayStartMs(from), dayEndMs(to)),
    'lock:action': ({ action }, e) => {
      requireOverlay(e, 'lock')
      const now = core.clock.now()
      if (action === 'prayed') core.dispatch({ type: 'PRAYED', now })
      else if (action === 'snooze') core.dispatch({ type: 'SNOOZE', now })
      else core.dispatch({ type: 'EMERGENCY_EXIT', now })
      return null
    },
    'guard:action': ({ action }, e) => {
      requireOverlay(e, 'guard')
      const now = core.clock.now()
      core.dispatch({ type: action === 'back' ? 'GUARD_BACK' : 'GUARD_SNOOZE', now })
      return null
    },
    'overlay:state': (_req, e) => {
      const k = core.overlays.kindOf(winOf(e))
      if (!k) throw new Error('overlay:state from a non-overlay window')
      return core.overlayState(k.kind, k.primary)
    },
    'tracking:setPaused': ({ paused }) => {
      core.settings.update({ tracking: { paused } })
      return null
    },
    'categories:get': () => ({
      categories: allCategories(core.repo.customCategories()),
      rules: core.repo.rules()
    }),
    'categories:create': ({ name, color }) => {
      const id = `c-${randomUUID().slice(0, 8)}`
      core.repo.createCategory(id, name, color)
      changed()
      return { id, name, color, builtin: false }
    },
    'categories:update': ({ id, name, color }) => {
      if (BUILTIN_CATEGORIES.some((c) => c.id === id))
        throw new Error('built-in categories are fixed')
      core.repo.updateCategory(id, name, color)
      changed()
      return null
    },
    'categories:delete': ({ id }) => {
      if (BUILTIN_CATEGORIES.some((c) => c.id === id))
        throw new Error('built-in categories are fixed')
      core.repo.deleteCategory(id)
      changed()
      return null
    },
    'rules:set': ({ kind, pattern, categoryId }) => {
      const known = allCategories(core.repo.customCategories()).some((c) => c.id === categoryId)
      if (!known) throw new Error('unknown category')
      core.repo.setRule(kind, kind === 'site' ? pattern : pattern.toLowerCase(), categoryId)
      changed()
      return null
    },
    'rules:delete': ({ kind, pattern }) => {
      core.repo.deleteRule(kind, pattern)
      changed()
      return null
    },
    'apps:running': () => core.apps.running(process.pid),
    'apps:recent': () => core.apps.recent(core.clock.now()),
    'data:export': async ({ format }, e) => ({
      path: await core.exporter.export(winOf(e), format, core.clock.now())
    }),
    'data:import': async (_req, e) => {
      const r = await core.exporter.import(winOf(e))
      if (r.imported) changed()
      return r
    },
    'data:deleteAll': () => {
      core.tracker.stop(core.clock.now())
      core.exporter.deleteAll(paths.backups)
      core.tracker.reset()
      changed()
      return null
    },
    'data:counts': () => core.repo.counts(),
    'debug:simulatePrayer': ({ prayer }) => {
      core.simulatePrayer(prayer)
      return null
    },
    'debug:simulatePre': ({ prayer }) => {
      core.simulatePreReminder(prayer)
      return null
    },
    'debug:setIdle': ({ on }) => {
      core.idle.simulateIdle = on
      core.markDirty()
      return null
    },
    'debug:setMeeting': ({ on }) => {
      core.meetingOverride = on
      core.markDirty()
      return null
    },
    'debug:setOffset': ({ minutes }) => {
      core.setOffset(minutes * MINUTE)
      return null
    },
    'debug:jumpBefore': ({ prayer, minutes }) => {
      core.jumpBefore(prayer, minutes)
      return null
    },
    'debug:seed': ({ range }) => core.seedDemo(range),
    'debug:clearDemo': () => {
      core.clearDemo()
      return null
    },
    'debug:readout': () => core.readout(),
    'debug:startupOffer': () => {
      core.simulateStartup()
      return null
    },
    'debug:simulateDistraction': ({ label }) => {
      core.simulateDistraction(label)
      return null
    }
  }

  for (const channel of CHANNELS) {
    const schema = requestSchemas[channel]
    const handler = handlers[channel] as Handler<Channel>
    ipcMain.handle(channel, async (e, payload: unknown) => {
      const url = e.senderFrame?.url ?? ''
      if (!isAppUrl(url)) throw new Error('IPC from an unknown origin')
      const parsed = schema.safeParse(payload)
      if (!parsed.success) {
        log.warn(`invalid payload on ${channel}`)
        throw new Error(`Invalid payload for ${channel}`)
      }
      try {
        return await handler(parsed.data as RequestOf<Channel>, e)
      } catch (err) {
        log.error(`IPC ${channel} failed`, err)
        throw err
      }
    })
  }
}
