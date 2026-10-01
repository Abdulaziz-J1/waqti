import { BrowserWindow, screen, type Display } from 'electron'
import type { OverlayKind, OverlayState } from '../../shared/ipc'
import type { AdhanView, GuardView, LockView } from '../../shared/machine/types'
import { app as appStrings } from '../../shared/strings'
import { log } from './logger'

export interface OverlayDeps {
  preload: string
  load: (win: BrowserWindow, query: Record<string, string>) => void
  /** Builds the state for one overlay window. */
  stateFor: (kind: OverlayKind, primary: boolean) => OverlayState
  /** Scheduler-clock now (includes the debug offset). */
  now: () => number
  /** Called when the independent 60-minute safety timer fires. */
  onSafety: () => void
  secure: (win: BrowserWindow) => void
}

/** Extra margin after the lock's hard maximum before the safety timer force-closes it. */
const SAFETY_MARGIN_MS = 2000

/** The adhan notice card (DIP), placed above the taskbar like a Windows notification. */
const ADHAN_SIZE = { width: 420, height: 104 }
const ADHAN_MARGIN = 16

/**
 * Lock overlays (one fullscreen window per display, screen-saver level), the
 * Focus Guard (one dimmed window on the distraction's display) and the short
 * adhan notice. Reacts to monitors being plugged or unplugged while visible.
 */
export class OverlayManager {
  private lockWins = new Map<number, BrowserWindow>()
  private guardWin: BrowserWindow | null = null
  private guardDisplay: number | null = null
  private adhanWin: BrowserWindow | null = null
  private lock: LockView | null = null
  private guard: GuardView | null = null
  private adhan: AdhanView | null = null
  private allowClose = new WeakSet<BrowserWindow>()
  private safetyTimer: NodeJS.Timeout | null = null
  private adhanTimer: NodeJS.Timeout | null = null

  constructor(private readonly deps: OverlayDeps) {
    const reconcile = (): void => {
      if (this.lock) this.reconcileLock()
      if (this.guard) this.placeGuard()
    }
    screen.on('display-added', reconcile)
    screen.on('display-removed', reconcile)
    screen.on('display-metrics-changed', reconcile)
  }

  get lockVisible(): boolean {
    return this.lock !== null
  }

  get guardVisible(): boolean {
    return this.guard !== null
  }

  get lockView(): LockView | null {
    return this.lock
  }

  get guardView(): GuardView | null {
    return this.guard
  }

  get adhanView(): AdhanView | null {
    return this.adhan
  }

  // -- lock ------------------------------------------------------------------

  showLock(view: LockView): void {
    this.hideAdhan()
    this.lock = view
    this.reconcileLock()
    this.push()
    if (this.safetyTimer) clearTimeout(this.safetyTimer)
    const delay = Math.max(0, view.hardUntil - this.deps.now()) + SAFETY_MARGIN_MS
    this.safetyTimer = setTimeout(() => {
      if (this.lock) {
        log.warn('lock safety maximum reached, forcing the overlay closed')
        this.deps.onSafety()
        if (this.lock) this.hideLock()
      }
    }, delay)
  }

  /** New times for the lock on screen (its countdown started); the windows stay. */
  updateLock(view: LockView): void {
    if (this.lock) this.lock = view
  }

  hideLock(): void {
    this.lock = null
    if (this.safetyTimer) clearTimeout(this.safetyTimer)
    this.safetyTimer = null
    for (const win of this.lockWins.values()) this.destroy(win)
    this.lockWins.clear()
  }

  private reconcileLock(): void {
    const displays = screen.getAllDisplays()
    const primaryId = screen.getPrimaryDisplay().id
    const ids = new Set(displays.map((d) => d.id))
    for (const [id, win] of this.lockWins) {
      if (!ids.has(id) || win.isDestroyed()) {
        this.destroy(win)
        this.lockWins.delete(id)
      }
    }
    for (const d of displays) {
      const existing = this.lockWins.get(d.id)
      if (existing && !existing.isDestroyed()) {
        existing.setBounds(d.bounds)
        continue
      }
      this.lockWins.set(d.id, this.createLockWindow(d, d.id === primaryId))
    }
  }

  private baseWindow(bounds: Electron.Rectangle, transparent: boolean): BrowserWindow {
    const win = new BrowserWindow({
      ...bounds,
      show: false,
      frame: false,
      transparent,
      backgroundColor: transparent ? '#00000000' : '#101A33',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      title: appStrings.name,
      webPreferences: {
        preload: this.deps.preload,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        spellcheck: false
      }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setMenu(null)
    this.deps.secure(win)
    win.on('close', (e) => {
      if (!this.allowClose.has(win)) e.preventDefault()
    })
    return win
  }

  private createLockWindow(d: Display, primary: boolean): BrowserWindow {
    const win = this.baseWindow(d.bounds, false)
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.setBounds(d.bounds)
      win.show()
      if (primary) win.focus()
    })
    this.deps.load(win, { kind: 'lock', primary: primary ? '1' : '0' })
    win.webContents.on('did-finish-load', () => this.sendTo(win, 'lock', primary))
    win.webContents.on('render-process-gone', () => {
      log.error('lock overlay renderer crashed, recreating')
      if (this.lock) {
        this.lockWins.delete(d.id)
        this.destroy(win)
        this.reconcileLock()
      }
    })
    return win
  }

  // -- guard -----------------------------------------------------------------

  showGuard(view: GuardView): void {
    this.guard = view
    this.placeGuard()
    if (this.guardWin) this.sendTo(this.guardWin, 'guard', true)
  }

  hideGuard(): void {
    this.guard = null
    if (this.guardWin) this.destroy(this.guardWin)
    this.guardWin = null
    this.guardDisplay = null
  }

  private placeGuard(): void {
    if (!this.guard) return
    const b = this.guard.target.bounds
    let display = screen.getPrimaryDisplay()
    if (b && b.width > 0) {
      const dip = process.platform === 'win32' ? screen.screenToDipRect(null, b) : b
      display = screen.getDisplayMatching(dip)
    }
    if (this.guardWin && !this.guardWin.isDestroyed() && this.guardDisplay === display.id) {
      this.guardWin.setBounds(display.bounds)
      return
    }
    if (this.guardWin) this.destroy(this.guardWin)
    const win = this.baseWindow(display.bounds, true)
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.setBounds(display.bounds)
      // Do not steal focus from the app underneath until the user clicks.
      win.showInactive()
    })
    this.deps.load(win, { kind: 'guard', primary: '1' })
    win.webContents.on('did-finish-load', () => this.sendTo(win, 'guard', true))
    this.guardWin = win
    this.guardDisplay = display.id
  }

  // -- adhan notice ----------------------------------------------------------

  /** Shows the notice on the primary display and closes it at `view.until`. */
  showAdhan(view: AdhanView): void {
    this.hideAdhan()
    this.adhan = view
    const wa = screen.getPrimaryDisplay().workArea
    const bounds = {
      x: Math.round(wa.x + wa.width - ADHAN_SIZE.width - ADHAN_MARGIN),
      y: Math.round(wa.y + wa.height - ADHAN_SIZE.height - ADHAN_MARGIN),
      ...ADHAN_SIZE
    }
    const win = this.baseWindow(bounds, true)
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.setBounds(bounds)
      // A notice never takes focus from what the user is doing.
      win.showInactive()
    })
    this.deps.load(win, { kind: 'adhan', primary: '1' })
    win.webContents.on('did-finish-load', () => this.sendTo(win, 'adhan', true))
    win.webContents.on('render-process-gone', () => this.hideAdhan())
    this.adhanWin = win
    this.adhanTimer = setTimeout(() => this.hideAdhan(), Math.max(0, view.until - this.deps.now()))
  }

  hideAdhan(): void {
    this.adhan = null
    if (this.adhanTimer) clearTimeout(this.adhanTimer)
    this.adhanTimer = null
    if (this.adhanWin) this.destroy(this.adhanWin)
    this.adhanWin = null
  }

  // -- shared ----------------------------------------------------------------

  /** Which overlay a window shows, for `overlay:state` requests. */
  kindOf(win: BrowserWindow | null): { kind: OverlayKind; primary: boolean } | null {
    if (!win) return null
    if (win === this.guardWin) return { kind: 'guard', primary: true }
    if (win === this.adhanWin) return { kind: 'adhan', primary: true }
    const primaryId = screen.getPrimaryDisplay().id
    for (const [id, w] of this.lockWins)
      if (w === win) return { kind: 'lock', primary: id === primaryId }
    return null
  }

  isOverlay(win: BrowserWindow | null): boolean {
    return this.kindOf(win) !== null
  }

  push(): void {
    const primaryId = screen.getPrimaryDisplay().id
    for (const [id, w] of this.lockWins) this.sendTo(w, 'lock', id === primaryId)
    if (this.guardWin) this.sendTo(this.guardWin, 'guard', true)
  }

  private sendTo(win: BrowserWindow, kind: OverlayKind, primary: boolean): void {
    if (win.isDestroyed() || win.webContents.isLoading()) return
    win.webContents.send('overlay:state', this.deps.stateFor(kind, primary))
  }

  private destroy(win: BrowserWindow): void {
    if (win.isDestroyed()) return
    this.allowClose.add(win)
    win.destroy()
  }

  destroyAll(): void {
    this.hideLock()
    this.hideGuard()
    this.hideAdhan()
  }
}
