import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import { invoke, launch, shown } from './helpers'

const OUT = path.resolve('docs/screenshots')

/** Minutes to add to the clock so local time becomes hh:mm today. */
function offsetTo(hh: number, mm: number): number {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hh, mm, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 60_000)
}

async function shot(page: Page, name: string, wait = 1400): Promise<void> {
  await page.waitForTimeout(wait)
  await page.screenshot({ path: path.join(OUT, name) })
}

for (const [period, hh, mm] of [
  ['day', 13, 10],
  ['night', 21, 40]
] as const) {
  test(`screenshots (${period})`, async () => {
    fs.mkdirSync(OUT, { recursive: true })
    const { app, win } = await launch()
    await win.setViewportSize({ width: 1280, height: 820 })
    await invoke(win, 'debug:setOffset', { minutes: offsetTo(hh, mm) })
    // Bring Waqti to the foreground so the sidebar shows Waqti itself, never the machine's real activity.
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0]
      w?.show()
      w?.moveTop()
      w?.focus()
    })

    // Onboarding (city step with the live preview)
    await win.locator('[data-testid="onboarding-next"]').click()
    await shot(win, `${period}-onboarding-city.png`)

    await invoke(win, 'onboarding:complete', { launchAtStartup: false })
    await invoke(win, 'debug:seed', { range: 'week' })
    await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })

    for (const page of ['today', 'focus', 'reports', 'prayer', 'settings'] as const) {
      await win.locator(`[data-testid="nav-${page}"]`).click()
      await shot(win, `${period}-${page}.png`, page === 'reports' ? 2600 : 1400)
    }

    // Lock overlay (its own window, full display)
    const lockWin = app.waitForEvent('window', { predicate: (w) => w.url().includes('kind=lock') })
    await invoke(win, 'debug:simulatePrayer', { prayer: period === 'day' ? 'asr' : 'isha' })
    const overlay = await shown(app, await lockWin)
    await overlay.setViewportSize({ width: 1280, height: 820 })
    await shot(overlay, `${period}-lock.png`)
    await app.close()
  })
}

test('screenshots (English)', async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const { app, win } = await launch()
  await win.setViewportSize({ width: 1280, height: 820 })
  await invoke(win, 'debug:setOffset', { minutes: offsetTo(13, 10) })
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w?.show()
    w?.moveTop()
    w?.focus()
  })
  await invoke(win, 'settings:update', { general: { language: 'en' } })
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'debug:seed', { range: 'week' })
  for (const page of ['today', 'focus'] as const) {
    await win.locator(`[data-testid="nav-${page}"]`).click()
    await shot(win, `en-${page}.png`)
  }
  await app.close()
})
