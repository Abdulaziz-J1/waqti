import path from 'node:path'
import { BrowserWindow, type WebContents } from 'electron'
import { log } from './logger'

const DEV_URL = process.env['ELECTRON_RENDERER_URL']

export const preloadPath = (): string => path.join(__dirname, '../preload/index.js')

/** True for URLs that belong to this app (the dev server or the packaged files). */
export function isAppUrl(url: string): boolean {
  if (DEV_URL && url.startsWith(DEV_URL)) return true
  return url.startsWith('file://')
}

/** Blocks navigation, new windows and permission requests for a window. */
export function secureWindow(win: BrowserWindow): void {
  const wc: WebContents = win.webContents
  wc.on('will-navigate', (e, url) => {
    if (!isAppUrl(url) || url !== wc.getURL()) e.preventDefault()
  })
  wc.on('will-redirect', (e) => e.preventDefault())
  wc.setWindowOpenHandler(({ url }) => {
    log.warn('blocked window.open', { url: url.slice(0, 80) })
    return { action: 'deny' }
  })
  wc.session.setPermissionRequestHandler((_wc, _permission, cb) => cb(false))
}

export function loadPage(
  win: BrowserWindow,
  page: 'index' | 'overlay',
  query: Record<string, string> = {}
): void {
  if (DEV_URL) {
    const q = new URLSearchParams(query).toString()
    void win.loadURL(`${DEV_URL}/${page}.html${q ? `?${q}` : ''}`)
  } else {
    void win.loadFile(path.join(__dirname, `../renderer/${page}.html`), { query })
  }
}

export interface MainWindowOptions {
  show: boolean
  background: string
  symbolColor: string
}

export function createMainWindow(opts: MainWindowOptions): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'وقتي',
    backgroundColor: opts.background,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: opts.symbolColor, height: 44 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false
    }
  })
  win.setMenu(null)
  secureWindow(win)
  win.once('ready-to-show', () => {
    if (opts.show) win.show()
  })
  loadPage(win, 'index')
  return win
}
