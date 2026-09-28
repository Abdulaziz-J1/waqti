import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import type { Channel, RequestOf, ResponseMap, WaqtiApi } from '../../src/shared/ipc'

export interface Launched {
  app: ElectronApplication
  win: Page
  dataDir: string
}

/**
 * Offset that makes the app's clock read 10:00 today: well clear of every
 * prayer, so a run never starts inside a real adhan's startup offer.
 */
function tenAmOffset(): string {
  const target = new Date()
  target.setHours(10, 0, 0, 0)
  return String(Math.round((target.getTime() - Date.now()) / 60_000) * 60_000)
}

/** Launches the built app with an isolated data folder and a pinned clock. */
export async function launch(
  extraEnv: Record<string, string> = {},
  dataDir?: string
): Promise<Launched> {
  const dir = dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-e2e-'))
  const app = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      WAQTI_USER_DATA: dir,
      WAQTI_CLOCK_OFFSET_MS: tenAmOffset(),
      ...extraEnv
    } as Record<string, string>
  })
  const win = await app.firstWindow()
  return { app, win, dataDir: dir }
}

/**
 * Resolves once the overlay window behind `page` is on screen. Overlays are
 * created hidden and shown (and focused) after their first paint; a press
 * that starts earlier races that focus change, which cancels a press-and-hold,
 * and a real user cannot press a window before it appears anyway.
 */
export async function shown(app: ElectronApplication, page: Page): Promise<Page> {
  const url = page.url()
  await expect
    .poll(() =>
      app.evaluate(
        ({ BrowserWindow }, u) =>
          BrowserWindow.getAllWindows().some((w) => w.webContents.getURL() === u && w.isVisible()),
        url
      )
    )
    .toBe(true)
  return page
}

/**
 * Moves the app's clock `minutes` forward from where it reads now.
 * (`debug:setOffset` alone is relative to the real clock, and tests start pinned.)
 */
export async function advanceClock(win: Page, minutes: number): Promise<void> {
  const { clockOffsetMs } = await invoke(win, 'app:snapshot')
  await invoke(win, 'debug:setOffset', { minutes: Math.round(clockOffsetMs / 60_000) + minutes })
}

/** Calls the typed IPC bridge from the page. */
export function invoke<C extends Channel>(
  win: Page,
  channel: C,
  payload?: RequestOf<C>
): Promise<ResponseMap[C]> {
  return win.evaluate(
    ([c, p]) => {
      const api = (globalThis as unknown as { waqti: WaqtiApi }).waqti
      return (api.invoke as (ch: string, pl?: unknown) => Promise<unknown>)(c as string, p)
    },
    [channel, payload] as const
  ) as Promise<ResponseMap[C]>
}

export function readLog(dataDir: string): string {
  const f = path.join(dataDir, 'logs', 'waqti.log')
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''
}
