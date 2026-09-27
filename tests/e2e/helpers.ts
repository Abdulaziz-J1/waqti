import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import type { Channel, RequestOf, ResponseMap, WaqtiApi } from '../../src/shared/ipc'

export interface Launched {
  app: ElectronApplication
  win: Page
  dataDir: string
}

/** Launches the built app with an isolated data folder. */
export async function launch(
  extraEnv: Record<string, string> = {},
  dataDir?: string
): Promise<Launched> {
  const dir = dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-e2e-'))
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, WAQTI_USER_DATA: dir, ...extraEnv } as Record<string, string>
  })
  const win = await app.firstWindow()
  return { app, win, dataDir: dir }
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
