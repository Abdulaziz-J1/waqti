import { expect, test } from '@playwright/test'
import { invoke, launch } from './helpers'

test('sidebar: folds to a rail of icons and back, and the tracking light turns red when paused', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  const collapsed = async (): Promise<boolean> =>
    (await invoke(win, 'app:snapshot')).settings.appearance.sidebarCollapsed
  const width = async (): Promise<number> => (await win.locator('aside').boundingBox())?.width ?? 0

  // The handle on the sidebar's edge folds it; the pages still work from their icons.
  await win.locator('[data-testid="sidebar-toggle"]').click()
  await expect.poll(collapsed).toBe(true)
  await expect.poll(width).toBeLessThan(80)
  await win.getByRole('button', { name: 'التقارير' }).click()
  await expect(win.locator('[data-testid="nav-reports"]')).toHaveAttribute('aria-current', 'page')

  // The tracking switch stays on the rail; paused shows a red light.
  await win.locator('[data-testid="tracking-toggle"]').click()
  await expect
    .poll(async () => (await invoke(win, 'app:snapshot')).settings.tracking.paused)
    .toBe(true)
  await expect(win.getByRole('img', { name: 'التتبع متوقف مؤقتاً' })).toBeVisible()
  await win.locator('[data-testid="tracking-toggle"]').click()

  // Ctrl+B unfolds it again, and the choice is kept.
  await win.keyboard.press('Control+KeyB')
  await expect.poll(collapsed).toBe(false)
  await expect.poll(width).toBeGreaterThan(200)
  await app.close()
})
