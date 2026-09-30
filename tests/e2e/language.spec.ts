import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { invoke, launch, shown } from './helpers'

/** How far each slider's knob sits from the end of its fill, in pixels (0 = on it). */
async function knobOffsets(win: Page): Promise<number[]> {
  await win.waitForTimeout(600) // let the springs settle
  return win.evaluate(() => {
    const rtl = document.documentElement.dir === 'rtl'
    return Array.from(document.querySelectorAll('[role="slider"]')).map((slider) => {
      const fill = slider.firstElementChild!.firstElementChild!.getBoundingClientRect()
      const knob = slider.lastElementChild!.firstElementChild!.getBoundingClientRect()
      const end = rtl ? fill.left : fill.right
      return Math.round(Math.abs(knob.left + knob.width / 2 - end))
    })
  })
}

test('language: English turns the whole app left to right, and back', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  // The machine running the tests may be idle: the lock must not be skipped as "away".
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })
  await win.locator('[data-testid="nav-settings"]').click()
  await expect(win.locator('html')).toHaveAttribute('dir', 'rtl')

  await win.locator('[data-testid="lang-en"]').click()
  await expect(win.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(win.locator('html')).toHaveAttribute('lang', 'en')
  await expect(win.locator('[data-testid="nav-today"]')).toHaveText('Today')
  await expect(win.locator('h1')).toHaveText('Settings')
  // The sidebar moves to the left edge.
  const aside = await win.locator('aside').boundingBox()
  expect(aside!.x).toBeLessThan(10)

  // Sliders fill from the left and their knob rides the end of the fill.
  await win.locator('[data-testid="nav-prayer"]').click()
  await win.locator('#prayer-lock-screen').scrollIntoViewIfNeeded()
  const offsets = await knobOffsets(win)
  expect(offsets.length).toBeGreaterThanOrEqual(3)
  for (const o of offsets) expect(o).toBeLessThanOrEqual(2)
  await win.locator('[data-testid="nav-settings"]').click()

  // The lock window follows the language too.
  const lockWin = app.waitForEvent('window', { predicate: (w) => w.url().includes('kind=lock') })
  await invoke(win, 'debug:simulatePrayer', { prayer: 'asr' })
  const lock = await shown(app, await lockWin)
  await expect(lock.locator('h1')).toContainText("It's time for Asr")
  await expect(lock.locator('html')).toHaveAttribute('dir', 'ltr')
  const closed = lock.waitForEvent('close')
  const box = await lock.locator('[data-testid="emergency-exit"]').boundingBox()
  await lock.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await lock.mouse.down()
  await closed
  await lock.mouse.up().catch(() => undefined)

  await win.locator('[data-testid="lang-ar"]').click()
  await expect(win.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(win.locator('[data-testid="nav-today"]')).toHaveText('اليوم')
  await win.locator('[data-testid="nav-prayer"]').click()
  await win.locator('#prayer-lock-screen').scrollIntoViewIfNeeded()
  for (const o of await knobOffsets(win)) expect(o).toBeLessThanOrEqual(2)
  await app.close()
})

test('language: the one chosen in the installer is used from the first start', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-e2e-'))
  const marker = path.join(dir, 'installer-language')
  fs.writeFileSync(marker, 'en')
  const { app, win } = await launch({}, dir)
  await expect(win.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(win.getByRole('heading', { level: 1 })).toHaveText('Welcome to Waqti')
  expect((await invoke(win, 'app:snapshot')).settings.general.language).toBe('en')
  // Read once: a later language change in the app is not undone at the next start.
  expect(fs.existsSync(marker)).toBe(false)
  await app.close()
})
