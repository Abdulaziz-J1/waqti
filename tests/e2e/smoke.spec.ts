import { expect, test, type Page } from '@playwright/test'
import { invoke, launch, readLog, shown } from './helpers'

/**
 * Smoke test: the app launches, onboarding completes, Today shows the
 * prayer times, the debug panel's "simulate prayer time" shows the overlay and
 * the emergency exit closes it.
 */
test('smoke: onboarding → Today → debug simulate → lock → emergency exit', async () => {
  const { app, win, dataDir } = await launch()

  // Onboarding, clicked through like a user.
  await expect(win.getByRole('heading', { name: 'هلا بك في وقتي' })).toBeVisible()
  for (let i = 0; i < 4; i++) {
    await win.locator('[data-testid="onboarding-next"]').click()
    await win.waitForTimeout(350)
  }
  await win.locator('[data-testid="onboarding-finish"]').click()

  // Today shows the prayer times on the Sky Arc and the next-prayer countdown.
  await expect(win.locator('[data-testid="nav-today"]')).toBeVisible()
  for (const name of ['الفجر', 'العصر', 'المغرب', 'العشاء']) {
    await expect(win.getByRole('button', { name: new RegExp(`^${name} `) })).toBeVisible()
  }
  await expect(win.getByRole('timer').first()).toBeVisible()

  // This machine may genuinely be idle; the away rule has its own test.
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })

  // Debug panel (Ctrl+Shift+D) → simulate prayer time.
  await win.keyboard.press('Control+Shift+D')
  await expect(win.locator('[data-testid="debug-panel"]')).toBeVisible()
  const overlayPromise: Promise<Page> = app.waitForEvent('window', {
    predicate: (w) => w.url().includes('kind=lock')
  })
  await win.locator('[data-testid="debug-simulate-prayer"]').click()
  const overlay = await shown(app, await overlayPromise)
  await expect(overlay.locator('h1')).toContainText('حان الآن وقت صلاة')

  // Emergency exit: hold for three seconds.
  const closed = overlay.waitForEvent('close')
  const box = await overlay.locator('[data-testid="emergency-exit"]').boundingBox()
  await overlay.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await overlay.mouse.down()
  await closed
  await overlay.mouse.up().catch(() => undefined)
  expect((await invoke(win, 'app:snapshot')).machine.prayer.kind).toBe('idle')

  await app.close()
  expect(readLog(dataDir)).not.toContain('[error]')
})
