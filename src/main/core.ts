import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { type BrowserWindow, app, powerMonitor } from 'electron'
import type { DB } from './services/db/database'
import { dailyBackup } from './services/db/database'
import type { Repo } from './services/db/repo'
import { Analytics } from './services/analytics'
import { AppsService } from './services/apps'
import { Clock } from './services/clock'
import { Exporter } from './services/exporter'
import { ForegroundService } from './services/foreground'
import { IdleService } from './services/idle'
import { log } from './services/logger'
import { LockAudio, VirtualOutput } from './services/lock-audio'
import { MediaService } from './services/media'
import { MeetingConfigStore } from './services/meeting-config'
import { getNative, type Native } from './services/native'
import { Notifier } from './services/notifications'
import { OverlayManager } from './services/overlays'
import { Scheduler } from './services/scheduler'
import type { SettingsStore } from './services/settings-store'
import { Tracker } from './services/tracker'
import { type TrayState, TrayService } from './services/tray'
import { createMainWindow, loadPage, preloadPath, secureWindow } from './services/windows'
import { paths } from './paths'
import type {
  AppSnapshot,
  DebugReadout,
  EventMap,
  EventName,
  OverlayKind,
  OverlayState,
  Page
} from '../shared/ipc'
import {
  DEFAULT_MACHINE_CONFIG,
  INITIAL_STATE,
  describeState,
  focusProgress,
  focusRemaining,
  reduce
} from '../shared/machine/machine'
import { renderToast } from '../shared/machine/toasts'
import { prayerLabel } from '../shared/machine/toasts'
import type {
  Effect,
  LockPlan,
  MachineEvent,
  MachineState,
  PrayerRef,
  TickContext
} from '../shared/machine/types'
import { refForToday } from '../shared/prayer/due'
import { type PrayerId, nextEvent } from '../shared/prayer/schedule'
import {
  forcedLockPlan,
  lockDelayMinutesFor,
  lockPlanFor,
  machineConfigOf,
  reminderMinutesFor
} from '../shared/settings/plan'
import type { Settings } from '../shared/settings/schema'
import { PALETTES, skyAt, tintOf } from '../shared/sky'
import { fmtDuration } from '../shared/format'
import { prayerNames, toasts, tray as trayStrings } from '../shared/strings'
import { MINUTE, addDays, dayKey, dayStartMs } from '../shared/time'
import { isInMeeting, matchDistraction } from '../shared/tracking/detect'
import { generateDemo } from '../shared/demo/generate'
import { coordsOf } from '../shared/settings/plan'

export interface CoreOptions {
  db: DB
  repo: Repo
  settings: SettingsStore
  startHidden: boolean
  notice: AppSnapshot['notice']
}

const LOCK_MARKER = 'lock_active'
/** Whether the output was muted before the current lock muted it ('1' / '0'). */
const AUDIO_MARKER = 'audio_before_lock'
/** The lock's chime (renderer lib/chime.ts) rings for about 4 s before the sound is muted. */
const CHIME_MS = 4000
const RELEASE_HIDDEN_WINDOW_MS = 60_000

/**
 * Wires the services together: the 1 Hz tick (tracking, scheduling, focus
 * guard), the orchestrator state machine and the effects it produces.
 */
export class WaqtiCore {
  readonly clock = new Clock()
  readonly native: Native = getNative()
  readonly foreground = new ForegroundService(this.native)
  readonly idle = new IdleService()
  readonly meeting = new MeetingConfigStore(paths.meetingConfig)
  readonly notifier = new Notifier(paths.resources)
  readonly media = new MediaService()
  readonly repo: Repo
  readonly db: DB
  readonly settings: SettingsStore
  readonly tracker: Tracker
  readonly scheduler: Scheduler
  readonly analytics: Analytics
  readonly apps: AppsService
  readonly exporter: Exporter
  readonly overlays: OverlayManager
  readonly tray: TrayService
  readonly lockAudio: LockAudio
  /** The sound output in isolated test profiles, which never touch the machine's sound. */
  readonly testOutput: VirtualOutput | null

  machine: MachineState = INITIAL_STATE
  mainWindow: BrowserWindow | null = null
  quitting = false
  meetingOverride = false
  startupMs: number | null = null
  notice: AppSnapshot['notice']
  pendingSummary: EventMap['focus:summary'] | null = null

  private lastFg: ReturnType<ForegroundService['read']> = null
  private inMeeting = false
  private tickTimer: NodeJS.Timeout | null = null
  private tickCount = 0
  /** Last taskbar progress applied (see updateTaskbarProgress). */
  private lastProgress: string | null = null
  private suspendedAt: number | null = null
  private dirtyTimer: NodeJS.Timeout | null = null
  private releaseTimer: NodeJS.Timeout | null = null
  private breakTimer: NodeJS.Timeout | null = null
  private lastTone: string | null = null
  private lastMaintenanceDay: string | null = null

  constructor(private readonly opts: CoreOptions) {
    this.db = opts.db
    this.repo = opts.repo
    this.settings = opts.settings
    this.notice = opts.notice
    // Isolated test profiles may start at a pinned clock so a run that happens
    // to launch just after an adhan does not begin with that prayer's offer.
    const testOffset = Number(process.env['WAQTI_CLOCK_OFFSET_MS'])
    if (process.env['WAQTI_USER_DATA'] && Number.isFinite(testOffset)) {
      this.clock.setOffset(testOffset)
    }
    this.tracker = new Tracker(this.repo)
    this.scheduler = new Scheduler(() => this.settings.get(), this.clock.now())
    this.apps = new AppsService(this.native, this.repo)
    this.analytics = new Analytics(this.repo, (p) => this.apps.icon(p))
    this.exporter = new Exporter(this.repo)
    this.meeting.load()
    this.overlays = new OverlayManager({
      preload: preloadPath(),
      load: (win, query) => loadPage(win, 'overlay', query),
      stateFor: (kind, primary) => this.overlayState(kind, primary),
      now: () => this.clock.now(),
      onSafety: () => this.dispatch({ type: 'FORCE_UNLOCK', now: this.clock.now() }),
      secure: secureWindow
    })
    this.tray = new TrayService(paths.resources, {
      open: () => this.showWindow(),
      startFocus: () => this.startFocus(this.s.focus.lastSeconds),
      stopFocus: () => this.dispatch({ type: 'FOCUS_STOP', now: this.clock.now() }),
      setTrackingPaused: (paused) => this.settings.update({ tracking: { paused } }),
      quit: () => this.quit()
    })
    this.testOutput = process.env['WAQTI_USER_DATA'] ? new VirtualOutput() : null
    this.lockAudio = new LockAudio(
      this.testOutput ?? {
        mute: () => this.media.muteOutput(),
        set: (muted) => this.media.setOutputMuted(muted)
      },
      {
        read: () => {
          const v = this.repo.getMeta(AUDIO_MARKER)
          return v === null ? null : v === '1'
        },
        write: (before) =>
          before === null
            ? this.repo.deleteMeta(AUDIO_MARKER)
            : this.repo.setMeta(AUDIO_MARKER, before ? '1' : '0')
      },
      (err) => log.warn('lock audio failed', err)
    )
    this.settings.on('change', (next: Settings, prev: Settings) =>
      this.onSettingsChange(next, prev)
    )
  }

  get s(): Settings {
    return this.settings.get()
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    this.recoverInterruptedLock()
    // Sound muted by a lock the app never got to finish comes back now.
    void this.lockAudio.lockHidden()
    if (!this.opts.startHidden) this.showWindow()
    this.tray.create(this.trayState())
    this.applyLoginItem()

    powerMonitor.on('suspend', () => this.onSuspend())
    powerMonitor.on('resume', () => this.onResume())
    powerMonitor.on('shutdown', () => this.tracker.stop(this.clock.now()))

    const now = this.clock.now()
    this.dispatch({
      type: 'APP_STARTED',
      now,
      recent: this.scheduler.recent(now, DEFAULT_MACHINE_CONFIG.startupOfferMs)
    })
    this.tickTimer = setInterval(() => this.safeTick(), 1000)
    setTimeout(() => void this.maintenance(), 30_000).unref()
  }

  /** App quit during a lock: record it, and never bring a stale overlay back. */
  private recoverInterruptedLock(): void {
    const raw = this.repo.getMeta(LOCK_MARKER)
    if (!raw) return
    try {
      // Markers written before refs carried `adhanAt` only have `at`.
      const ref = JSON.parse(raw) as Omit<PrayerRef, 'adhanAt'> & { adhanAt?: number }
      this.repo.logPrayer({
        prayer: ref.prayer,
        day: ref.day,
        scheduledAt: ref.adhanAt ?? ref.at,
        outcome: 'ended',
        reason: 'interrupted',
        snoozed: false,
        at: Date.now()
      })
    } catch (err) {
      log.warn('bad lock marker', err)
    }
    this.repo.deleteMeta(LOCK_MARKER)
  }

  quit(): void {
    if (this.quitting) return
    this.quitting = true
    // Give the sound back first if a lock muted it (at most 3 s).
    const wait = new Promise((resolve) => setTimeout(resolve, 3000))
    void Promise.race([this.lockAudio.lockHidden(), wait]).finally(() => {
      this.shutdown()
      app.quit()
    })
  }

  /** Flushes everything; safe to call more than once. */
  shutdown(): void {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
    try {
      this.tracker.stop(this.clock.now())
    } catch (err) {
      log.error('final flush failed', err)
    }
    this.overlays.destroyAll()
    this.tray.destroy()
  }

  private async maintenance(): Promise<void> {
    const now = this.clock.now()
    const today = dayKey(now)
    if (this.lastMaintenanceDay === today) return
    this.lastMaintenanceDay = today
    try {
      const keep = this.s.tracking.retentionDays
      if (keep > 0) {
        const before = addDays(today, -keep)
        const removed = this.repo.deleteBefore(before, dayStartMs(before))
        if (removed) log.info(`retention removed ${removed} intervals`)
      }
      const file = await dailyBackup(this.db, paths.backups, today)
      if (file) log.info('daily backup written')
    } catch (err) {
      log.error('maintenance failed', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Tick
  // ---------------------------------------------------------------------------

  private safeTick(): void {
    try {
      this.tick()
    } catch (err) {
      log.error('tick failed', err)
    }
  }

  ctx(): TickContext {
    return {
      idleSeconds: this.idle.idleSeconds(),
      screenLocked: this.idle.screenLocked(),
      inMeeting: this.inMeeting,
      // Looked up only when it matters, in prayerDue().
      mediaPlaying: false
    }
  }

  /**
   * Dispatches PRAYER_DUE. When no input for a while would skip the lock as
   * "away", Windows is asked first whether media is playing: someone watching
   * a video without touching the keyboard is still there.
   */
  private prayerDue(ref: PrayerRef, plan: LockPlan | null, ctx: TickContext): void {
    const cfg = machineConfigOf(this.s)
    const idleOnly =
      plan !== null &&
      cfg.skipWhenAway &&
      !ctx.screenLocked &&
      ctx.idleSeconds >= cfg.awayThresholdSec
    if (!idleOnly) {
      this.dispatch({ type: 'PRAYER_DUE', now: this.clock.now(), ref, plan, ctx })
      return
    }
    void this.media.anyPlaying().then((mediaPlaying) => {
      if (mediaPlaying) log.info(`idle ${ctx.idleSeconds} s but media is playing: locking`)
      this.dispatch({
        type: 'PRAYER_DUE',
        now: this.clock.now(),
        ref,
        plan,
        ctx: { ...ctx, mediaPlaying }
      })
    })
  }

  private tick(): void {
    this.tickCount++
    const now = this.clock.now()
    const s = this.s

    const jump = this.clock.takeJump()
    if (jump !== 0) {
      log.info(`system clock changed by ${Math.round(jump / 1000)} s`)
      this.scheduler.reset(now)
      this.markDirty()
    }
    if (this.tickCount % 60 === 0) {
      if (this.clock.timezoneChanged()) {
        log.info('timezone changed')
        this.scheduler.reset(now)
        this.markDirty()
      }
      this.meeting.load()
    }

    const fg = this.foreground.read(process.pid)
    this.lastFg = fg
    const ctxBase = this.ctx()
    this.inMeeting =
      this.meetingOverride || (fg !== null && !fg.self && isInMeeting(fg.info, this.meeting.get()))
    const ctx: TickContext = { ...ctxBase, inMeeting: this.inMeeting }

    const prevStatus = this.tracker.tick({
      now,
      fg: fg?.info ?? null,
      idleSeconds: ctx.idleSeconds,
      idleThresholdSec: s.tracking.idleMinutes * 60,
      screenLocked: ctx.screenLocked,
      overlayVisible: this.overlays.lockVisible || this.overlays.guardVisible,
      paused: s.tracking.paused,
      excluded: new Set(s.tracking.excludedApps),
      storeTitles: s.tracking.storeTitles
    })
    const st = this.tracker.status
    if (
      prevStatus.reason !== st.reason ||
      prevStatus.current?.appName !== st.current?.appName ||
      prevStatus.current?.site !== st.current?.site
    ) {
      this.markDirty()
    }

    const due = this.scheduler.tick(now)
    if (due.kind === 'gap') {
      this.dispatch({ type: 'RESUME', now, missed: due.missed })
    } else {
      for (const e of due.events) {
        if (e.kind === 'pre') {
          this.dispatch({
            type: 'PRE_REMINDER_DUE',
            now,
            ref: e.ref,
            minutesBefore: e.minutesBefore
          })
        } else if (e.kind === 'adhan') {
          this.dispatch({
            type: 'ADHAN_DUE',
            now,
            ref: e.ref,
            locks: lockPlanFor(s, e.ref.prayer, e.ref.isJumuah) !== null,
            chime: s.chime
          })
        } else {
          this.prayerDue(e.ref, lockPlanFor(s, e.ref.prayer, e.ref.isJumuah), ctx)
        }
      }
    }
    this.dispatch({ type: 'TICK', now, ctx })

    const f = this.machine.focus
    if ((f.kind === 'focus' || f.kind === 'guard') && fg && !fg.self) {
      const m = matchDistraction(fg.info, s.distractions)
      if (m) {
        this.dispatch({
          type: 'DISTRACTION',
          now,
          target: { ...m, hwnd: fg.info.hwnd, bounds: fg.info.bounds }
        })
      } else if (f.kind === 'guard' && f.target.process !== 'debug') {
        // A simulated distraction (debug panel) stays until the user answers the guard.
        this.dispatch({ type: 'DISTRACTION_CLEARED', now })
      }
    }

    this.updateTaskbarProgress(now)
    if (this.tickCount % 5 === 0) {
      this.tray.update(this.trayState())
      this.updateTitleBar()
    }
    if (this.lastMaintenanceDay && this.lastMaintenanceDay !== dayKey(now)) void this.maintenance()
  }

  // ---------------------------------------------------------------------------
  // State machine
  // ---------------------------------------------------------------------------

  dispatch(event: MachineEvent): void {
    const { state, effects } = reduce(this.machine, event, machineConfigOf(this.s))
    const changed = state !== this.machine
    this.machine = state
    for (const e of effects) {
      try {
        this.runEffect(e)
      } catch (err) {
        log.error(`effect ${e.type} failed`, err)
      }
    }
    if (changed) {
      this.markDirty()
      if (this.overlays.guardVisible || this.overlays.lockVisible) this.overlays.push()
    }
  }

  private runEffect(e: Effect): void {
    switch (e.type) {
      case 'toast': {
        const t = renderToast(e.toast, this.s.general.digits)
        this.notifier.show(t, () => {
          if (t.action === 'acceptOffer')
            this.dispatch({ type: 'OFFER_ACCEPTED', now: this.clock.now() })
          else this.showWindow(t.action === 'openFocus' ? 'focus' : undefined)
        })
        return
      }
      case 'showLock':
        this.tracker.flush(this.clock.now())
        this.overlays.showLock(e.lock)
        // Every time the lock goes up (also after a snooze): only what plays gets paused.
        if (this.s.pauseMedia) this.media.pausePlaying()
        if (this.s.muteDuringLock) void this.lockAudio.lockShown(e.lock.chime ? CHIME_MS : 0)
        this.repo.setMeta(LOCK_MARKER, JSON.stringify(e.lock.ref))
        return
      case 'hideLock':
        this.overlays.hideLock()
        // Whatever ended the lock (prayed, emergency exit, snooze, time up), the sound comes back.
        void this.lockAudio.lockHidden()
        this.repo.deleteMeta(LOCK_MARKER)
        return
      case 'showAdhan':
        this.overlays.showAdhan(e.adhan)
        return
      case 'showGuard':
        this.overlays.showGuard(e.guard)
        return
      case 'hideGuard':
        this.overlays.hideGuard()
        return
      case 'minimize':
        if (e.hwnd) this.native.minimize(e.hwnd)
        return
      case 'logPrayer':
        this.repo.logPrayer(e.entry)
        this.send('data:changed', null)
        return
      case 'saveFocus':
        this.repo.saveSession(e.record)
        this.send('data:changed', null)
        return
      case 'focusSummary':
        this.pendingSummary = e.record
        this.send('focus:summary', e.record)
        return
      case 'logDistraction':
        this.repo.logDistraction(e)
        return
      case 'breakReminder': {
        if (this.breakTimer) clearTimeout(this.breakTimer)
        const delay = Math.max(0, e.at - this.clock.now())
        this.breakTimer = setTimeout(() => {
          if (this.s.focus.breakReminder && this.machine.focus.kind === 'off') {
            this.notifier.show({ title: toasts.breakOverTitle, body: toasts.breakOverBody }, () =>
              this.showWindow('focus')
            )
          }
        }, delay)
        return
      }
    }
  }

  startFocus(seconds: number): void {
    const s = this.s
    this.dispatch({
      type: 'FOCUS_START',
      now: this.clock.now(),
      id: randomUUID(),
      seconds,
      breakMinutes: s.focus.breakReminder ? s.focus.breakMinutes : null
    })
    if (s.focus.lastSeconds !== seconds) this.settings.update({ focus: { lastSeconds: seconds } })
  }

  // ---------------------------------------------------------------------------
  // Power events
  // ---------------------------------------------------------------------------

  private onSuspend(): void {
    const now = this.clock.now()
    this.suspendedAt = now
    this.tracker.stop(now)
    this.dispatch({ type: 'SUSPEND', now })
    log.info('suspend')
  }

  private onResume(): void {
    const now = this.clock.now()
    this.clock.resync()
    const missed = this.scheduler.resume(this.suspendedAt ?? now, now)
    this.suspendedAt = null
    this.dispatch({ type: 'RESUME', now, missed })
    this.markDirty()
    log.info('resume')
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  private onSettingsChange(next: Settings, prev: Settings): void {
    const now = this.clock.now()
    if (
      JSON.stringify(next.location) !== JSON.stringify(prev.location) ||
      JSON.stringify(next.prayers) !== JSON.stringify(prev.prayers)
    ) {
      this.scheduler.reset(now)
    }
    if (next.tracking.paused && !prev.tracking.paused) this.tracker.stop(now)
    if (
      next.general.launchAtStartup !== prev.general.launchAtStartup ||
      next.onboarded !== prev.onboarded
    ) {
      this.applyLoginItem()
    }
    if (next.appearance.theme !== prev.appearance.theme) this.updateTitleBar(true)
    this.tray.update(this.trayState())
    this.markDirty()
    if (this.overlays.lockVisible || this.overlays.guardVisible) this.overlays.push()
  }

  /**
   * Registers or removes the login item. Only packaged builds touch the
   * registry, only after onboarding (where the user chose explicitly), and
   * never for an isolated test profile (WAQTI_USER_DATA).
   */
  applyLoginItem(): void {
    if (!app.isPackaged || process.platform !== 'win32' || !this.s.onboarded) return
    if (process.env['WAQTI_USER_DATA']) return
    try {
      app.setLoginItemSettings({ openAtLogin: this.s.general.launchAtStartup, args: ['--hidden'] })
    } catch (err) {
      log.warn('could not set login item', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Windows
  // ---------------------------------------------------------------------------

  private windowColors(): { background: string; symbol: string; tone: string } {
    const theme = this.s.appearance.theme
    if (theme === 'light') return { background: '#EAF2F8', symbol: '#1B2A41', tone: 'light' }
    if (theme === 'dark') return { background: '#101A33', symbol: '#EEF2F8', tone: 'dark' }
    const b = this.scheduler.bundle()
    const sky = b ? skyAt(b.today, this.clock.now()).colors : PALETTES.day
    return {
      background: sky.mid,
      symbol: sky.tone === 'dark' ? '#EEF2F8' : '#1B2A41',
      tone: sky.tone
    }
  }

  /**
   * The taskbar button fills as a focus session runs (amber while it waits
   * for a prayer), so a minimised Waqti still shows how far along it is.
   */
  private updateTaskbarProgress(now: number): void {
    const w = this.mainWindow
    if (!w || w.isDestroyed()) {
      this.lastProgress = null
      return
    }
    const p = focusProgress(this.machine.focus, now)
    const key = p ? `${Math.round(p.fraction * 500)}:${p.paused}` : 'off'
    if (key === this.lastProgress) return
    this.lastProgress = key
    try {
      if (p) w.setProgressBar(p.fraction, { mode: p.paused ? 'paused' : 'normal' })
      else w.setProgressBar(-1)
    } catch {
      // not supported on this platform
    }
  }

  private updateTitleBar(force = false): void {
    const w = this.mainWindow
    if (!w || w.isDestroyed()) return
    const c = this.windowColors()
    if (!force && c.tone === this.lastTone) return
    this.lastTone = c.tone
    try {
      w.setTitleBarOverlay({ color: '#00000000', symbolColor: c.symbol, height: 44 })
      w.setBackgroundColor(c.background)
    } catch {
      // not supported on this platform
    }
  }

  showWindow(page?: Page): void {
    let w = this.mainWindow
    if (!w || w.isDestroyed()) {
      const c = this.windowColors()
      this.lastTone = c.tone
      w = createMainWindow({
        show: true,
        background: c.background,
        symbolColor: c.symbol,
        icon: path.join(paths.resources, 'icon.png')
      })
      this.attachMainWindow(w)
      this.mainWindow = w
    } else {
      if (w.isMinimized()) w.restore()
      w.show()
      w.focus()
    }
    if (page) {
      const target = w
      const go = (): void => target.webContents.send('nav:go', { page })
      if (target.webContents.isLoading()) target.webContents.once('did-finish-load', go)
      else go()
    }
  }

  /**
   * A window hidden in the tray for a minute is destroyed to give its memory
   * back (the app then idles at ~140 MB). Opening it again recreates it in
   * about half a second.
   */
  private scheduleRelease(w: BrowserWindow): void {
    if (this.releaseTimer) clearTimeout(this.releaseTimer)
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null
      if (!w.isDestroyed() && !w.isVisible() && this.mainWindow === w) {
        log.info('releasing the hidden window')
        this.mainWindow = null
        w.destroy()
      }
    }, RELEASE_HIDDEN_WINDOW_MS)
    this.releaseTimer.unref()
  }

  private cancelRelease(): void {
    if (this.releaseTimer) clearTimeout(this.releaseTimer)
    this.releaseTimer = null
  }

  private attachMainWindow(w: BrowserWindow): void {
    const vis = (visible: boolean) => () => this.send('window:visibility', { visible })
    w.on('show', () => {
      this.cancelRelease()
      vis(true)()
    })
    w.on('restore', vis(true))
    w.on('hide', () => {
      vis(false)()
      this.scheduleRelease(w)
    })
    w.on('minimize', vis(false))
    w.on('close', (e) => {
      if (this.quitting) return
      if (this.s.general.closeToTray) {
        e.preventDefault()
        w.hide()
        if (!this.s.general.closeHintShown) {
          this.notifier.show({ title: toasts.closeToTrayTitle, body: toasts.closeToTrayBody }, () =>
            this.showWindow()
          )
          this.settings.update({ general: { closeHintShown: true } })
        }
      } else {
        this.quit()
      }
    })
    w.webContents.on('render-process-gone', (_e, details) => {
      log.error('main window renderer gone, reloading', details)
      if (!w.isDestroyed()) w.webContents.reload()
    })
    w.on('closed', () => {
      if (this.mainWindow === w) this.mainWindow = null
    })
  }

  send<E extends EventName>(event: E, payload: EventMap[E]): void {
    const w = this.mainWindow
    if (w && !w.isDestroyed() && !w.webContents.isLoading()) w.webContents.send(event, payload)
  }

  markDirty(): void {
    if (this.dirtyTimer) return
    this.dirtyTimer = setTimeout(() => {
      this.dirtyTimer = null
      this.send('app:snapshot', this.snapshot())
    }, 50)
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  snapshot(): AppSnapshot {
    return {
      version: app.getVersion(),
      settings: this.s,
      machine: this.machine,
      clockOffsetMs: this.clock.offsetMs,
      schedule: this.scheduler.bundle(),
      scheduleError: this.scheduler.error,
      tracking: this.tracker.status,
      debug: {
        offsetMs: this.clock.offsetMs,
        idleOverride: this.idle.simulateIdle,
        meetingOverride: this.meetingOverride
      },
      notice: this.notice
    }
  }

  overlayState(kind: OverlayKind, primary: boolean): OverlayState {
    const b = this.scheduler.bundle()
    const now = this.clock.now()
    const sky = b ? skyAt(b.today, now) : { period: 'day' as const, colors: PALETTES.day }
    const lock = this.overlays.lockView
    const guard = this.overlays.guardView
    const adhan = this.overlays.adhanView
    const shown = { lock, guard, adhan }[kind]
    return {
      kind: shown ? kind : 'none',
      lock,
      guard,
      adhan,
      sky: { ...sky.colors, period: sky.period },
      tint: tintOf(this.s.appearance.theme, sky.period),
      clockOffsetMs: this.clock.offsetMs,
      digits: this.s.general.digits,
      clock: this.s.general.clock,
      reduceMotion: this.s.appearance.reduceMotion,
      emergencyHoldMs: this.s.emergencyHoldSeconds * 1000,
      snoozeMinutes: this.s.snooze.minutes,
      primary
    }
  }

  private trayState(): TrayState {
    const s = this.s
    let tooltip: string = trayStrings.tooltipFallback
    const next = nextEvent(this.scheduler.list(), this.clock.now(), true)
    if (next) {
      const name =
        next.slot === 'sunrise'
          ? prayerNames.sunrise
          : prayerLabel({ prayer: next.slot, isJumuah: next.isJumuah })
      const inText = fmtDuration(next.at - this.clock.now(), s.general.digits, {
        gramCase: 'obl',
        round: 'ceil'
      })
      tooltip = trayStrings.tooltipNext(name, inText)
    }
    const left = focusRemaining(this.machine.focus, this.clock.now())
    if (left !== null) {
      const leftText = fmtDuration(left, s.general.digits, { round: 'ceil' })
      tooltip = `${trayStrings.tooltipFocus(leftText)}\n${tooltip}`
    }
    if (s.tracking.paused) tooltip = `${tooltip}\n${trayStrings.tooltipPaused}`
    return {
      tooltip,
      focusRunning: this.machine.focus.kind !== 'off',
      focusLabel: trayStrings.focusStart(
        fmtDuration(s.focus.lastSeconds * 1000, s.general.digits, { round: 'round' })
      ),
      trackingPaused: s.tracking.paused
    }
  }

  // ---------------------------------------------------------------------------
  // Debug panel
  // ---------------------------------------------------------------------------

  simulatePrayer(prayer: PrayerId): void {
    const b = this.scheduler.bundle()
    if (!b) return
    const ref = refForToday(b.today, prayer, this.clock.now())
    this.prayerDue(ref, forcedLockPlan(this.s, prayer, ref.isJumuah), this.ctx())
  }

  /** Shows the adhan notice now, with the lock time this prayer would get. */
  simulateAdhan(prayer: PrayerId): void {
    const b = this.scheduler.bundle()
    if (!b) return
    const now = this.clock.now()
    const s = this.s
    const isJumuah = prayer === 'dhuhr' && b.today.isFriday
    const locks = lockPlanFor(s, prayer, isJumuah) !== null
    const delay = locks ? lockDelayMinutesFor(s, prayer, isJumuah, b.today.isRamadan) : 0
    const ref = { ...refForToday(b.today, prayer, now), at: now + delay * MINUTE }
    this.dispatch({ type: 'ADHAN_DUE', now, ref, locks, chime: s.chime })
  }

  simulatePreReminder(prayer: PrayerId): void {
    const b = this.scheduler.bundle()
    if (!b) return
    const now = this.clock.now()
    const isJumuah = prayer === 'dhuhr' && b.today.isFriday
    const minutes = reminderMinutesFor(this.s, isJumuah) || 10
    const ref = refForToday(b.today, prayer, now + minutes * MINUTE)
    this.dispatch({ type: 'PRE_REMINDER_DUE', now, ref, minutesBefore: minutes })
  }

  setOffset(ms: number): void {
    this.clock.setOffset(ms)
    this.scheduler.reset(this.clock.now())
    this.markDirty()
  }

  /**
   * Moves the scheduler clock to `minutes` before the prayer's next adhan or,
   * when negative, that many minutes after today's lock time (the iqama), which
   * is where the startup offer applies.
   */
  jumpBefore(prayer: PrayerId, minutes: number): void {
    const b = this.scheduler.bundle()
    if (!b) return
    const now = this.clock.now()
    if (minutes < 0) {
      const s = this.s
      const isJumuah = prayer === 'dhuhr' && b.today.isFriday
      const delay =
        lockPlanFor(s, prayer, isJumuah) !== null
          ? lockDelayMinutesFor(s, prayer, isJumuah, b.today.isRamadan)
          : 0
      const target = b.today.times[prayer] + (delay - minutes) * MINUTE
      this.setOffset(target - Date.now())
      return
    }
    let at = b.today.times[prayer]
    if (at - minutes * MINUTE <= now) at = b.tomorrow.times[prayer]
    this.setOffset(at - minutes * MINUTE - Date.now())
  }

  simulateStartup(): void {
    const now = this.clock.now()
    this.dispatch({
      type: 'APP_STARTED',
      now,
      recent: this.scheduler.recent(now, DEFAULT_MACHINE_CONFIG.startupOfferMs)
    })
  }

  /** Shows the Focus Guard as if `label` had come to the foreground (focus session required). */
  simulateDistraction(label: string): void {
    this.dispatch({
      type: 'DISTRACTION',
      now: this.clock.now(),
      target: { kind: 'site', label, process: 'debug', site: null, hwnd: null, bounds: null }
    })
  }

  seedDemo(range: 'day' | 'week' | 'year'): { inserted: number; ms: number } {
    const t0 = performance.now()
    const now = this.clock.now()
    const days = range === 'day' ? 1 : range === 'week' ? 7 : 365
    const data = generateDemo({
      endDay: dayKey(now),
      days,
      now,
      coords: coordsOf(this.s),
      seed: Math.floor(now / 1000)
    })
    const inserted = this.repo.insertDemo(data)
    this.send('data:changed', null)
    return { inserted, ms: Math.round(performance.now() - t0) }
  }

  clearDemo(): void {
    this.repo.clearDemo()
    this.send('data:changed', null)
  }

  readout(): DebugReadout {
    let cpu = 0
    let memKB = 0
    for (const m of app.getAppMetrics()) {
      cpu += m.cpu.percentCPUUsage
      memKB += m.memory.workingSetSize
    }
    const fg = this.lastFg
    return {
      state: describeState(this.machine),
      foreground: fg
        ? {
            appName: fg.info.appName,
            process: fg.info.process,
            title: fg.info.title.slice(0, 80),
            site: this.tracker.status.current?.site ?? null
          }
        : null,
      provider: this.foreground.provider,
      cpuPercent: Math.round(cpu * 10) / 10,
      memoryMB: Math.round(memKB / 1024),
      inMeeting: this.inMeeting,
      idleSeconds: this.idle.idleSeconds(),
      startupMs: this.startupMs,
      intervals: this.repo.intervalCount(),
      soundMutedByLock: this.repo.getMeta(AUDIO_MARKER) !== null,
      testOutputMuted: this.testOutput?.muted ?? null
    }
  }
}
