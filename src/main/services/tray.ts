import fs from 'node:fs'
import path from 'node:path'
import { Menu, Tray, nativeImage } from 'electron'
import { type Lang, tray as t } from '../../shared/strings'
import { log } from './logger'

export interface TrayState {
  /** The menu is rebuilt in the new language when it changes. */
  lang: Lang
  tooltip: string
  focusRunning: boolean
  /** «ابدأ تركيز ٣٠ دقيقة»: the length on the Focus dial. */
  focusLabel: string
  trackingPaused: boolean
}

export interface TrayActions {
  open: () => void
  startFocus: () => void
  stopFocus: () => void
  setTrackingPaused: (paused: boolean) => void
  quit: () => void
}

/** Tray icon with a menu in the interface language and a live "next prayer" tooltip. */
export class TrayService {
  private tray: Tray | null = null
  private last: TrayState | null = null

  constructor(
    private readonly resourcesDir: string,
    private readonly actions: TrayActions
  ) {}

  create(state: TrayState): void {
    const file = path.join(this.resourcesDir, 'tray.png')
    const icon = fs.existsSync(file) ? nativeImage.createFromPath(file) : nativeImage.createEmpty()
    try {
      this.tray = new Tray(icon)
    } catch (err) {
      log.error('tray creation failed', err)
      return
    }
    this.tray.on('click', () => this.actions.open())
    this.tray.on('double-click', () => this.actions.open())
    this.update(state)
  }

  update(state: TrayState): void {
    if (!this.tray || this.tray.isDestroyed()) return
    const l = this.last
    if (
      l &&
      l.lang === state.lang &&
      l.tooltip === state.tooltip &&
      l.focusRunning === state.focusRunning &&
      l.focusLabel === state.focusLabel &&
      l.trackingPaused === state.trackingPaused
    ) {
      return
    }
    if (!l || l.tooltip !== state.tooltip) this.tray.setToolTip(state.tooltip)
    if (
      !l ||
      l.lang !== state.lang ||
      l.focusRunning !== state.focusRunning ||
      l.focusLabel !== state.focusLabel ||
      l.trackingPaused !== state.trackingPaused
    ) {
      this.tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: t.open, click: () => this.actions.open() },
          state.focusRunning
            ? { label: t.stopFocus, click: () => this.actions.stopFocus() }
            : { label: state.focusLabel, click: () => this.actions.startFocus() },
          {
            label: state.trackingPaused ? t.resumeTracking : t.pauseTracking,
            click: () => this.actions.setTrackingPaused(!state.trackingPaused)
          },
          { type: 'separator' },
          { label: t.quit, click: () => this.actions.quit() }
        ])
      )
    }
    this.last = state
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
