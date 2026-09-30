import path from 'node:path'
import { createRequire } from 'node:module'
import {
  type ForegroundInfo,
  type RawForeground,
  normalizeForeground
} from '../../shared/tracking/apps'
import { app as appStrings } from '../../shared/strings'
import { log } from './logger'
import type { Native } from './native'

interface GetWindowsResult {
  title: string
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  owner: { name: string; processId: number; path: string }
}

interface GetWindowsAddon {
  getActiveWindow(): GetWindowsResult | undefined
}

/**
 * Loads get-windows' prebuilt N-API binary directly. The package's JS entry
 * resolves the binary through node-pre-gyp on every call, which is wasteful at
 * 1 Hz; loading it once gives the same data.
 */
function loadGetWindows(): GetWindowsAddon | null {
  if (process.platform !== 'win32') return null
  try {
    const req = createRequire(__filename)
    const entry = req.resolve('get-windows')
    const binary = path.join(
      path.dirname(entry),
      'lib',
      'binding',
      `napi-9-win32-unknown-${process.arch}`,
      'node-get-windows.node'
    )
    const addon = req(binary) as GetWindowsAddon
    addon.getActiveWindow()
    return addon
  } catch (err) {
    log.warn('get-windows unavailable, falling back to koffi', err)
    return null
  }
}

export type ForegroundProviderName = 'get-windows' | 'koffi' | 'none'

/** Reads the foreground window: get-windows first, koffi (user32/kernel32) as fallback. */
export class ForegroundService {
  readonly provider: ForegroundProviderName
  private readonly addon: GetWindowsAddon | null

  constructor(private readonly native: Native) {
    this.addon = loadGetWindows()
    this.provider = this.addon ? 'get-windows' : native.available ? 'koffi' : 'none'
    log.info(`foreground provider: ${this.provider}`)
  }

  private raw(): RawForeground | null {
    if (this.addon) {
      try {
        const w = this.addon.getActiveWindow()
        if (!w) return null
        return {
          exePath: w.owner.path,
          title: w.title ?? '',
          pid: w.owner.processId,
          hwnd: w.id,
          bounds: w.bounds ?? null,
          description: w.owner.name
        }
      } catch {
        // fall through to koffi for this reading
      }
    }
    if (!this.native.available) return null
    try {
      const r = this.native.foreground()
      if (r && r.exePath) r.description = this.native.fileDescription(r.exePath)
      return r
    } catch {
      return null
    }
  }

  /** The foreground window, or null. `self` is true for Waqti's own windows. */
  read(ownPid: number): { info: ForegroundInfo; self: boolean } | null {
    const r = this.raw()
    if (!r || !r.exePath) return null
    const self = r.pid === ownPid
    const info = normalizeForeground(r)
    if (self) {
      info.process = 'waqti.exe'
      info.appName = appStrings.name
    }
    // Only PowerPoint needs the window class (slideshow detection).
    if (info.process === 'powerpnt.exe' && info.hwnd && info.className == null) {
      info.className = this.native.className(info.hwnd)
    }
    return { info, self }
  }
}
