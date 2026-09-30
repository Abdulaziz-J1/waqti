import { expect, test, type Page } from '@playwright/test'
import { invoke, launch } from './helpers'

/**
 * Points of the fold handle that Windows would treat as window-drag area.
 * Mirrors Chromium: every visible element with an app-region (it inherits)
 * adds its box in document order, drag as a union, no-drag as a difference.
 * (Test clicks bypass the OS, so this is how a real mouse miss shows up.)
 */
async function draggableSpotsOnHandle(win: Page): Promise<number> {
  return win.evaluate(() => {
    const handle = document.querySelector('[data-testid="sidebar-toggle"]')!.getBoundingClientRect()
    const regions = [...document.querySelectorAll('*')].flatMap((el) => {
      const cs = getComputedStyle(el)
      const v = cs.getPropertyValue('-webkit-app-region')
      if ((v !== 'drag' && v !== 'no-drag') || cs.visibility !== 'visible') return []
      return [{ drag: v === 'drag', r: el.getBoundingClientRect() }]
    })
    let bad = 0
    for (let i = 1; i < 10; i++) {
      for (let j = 1; j < 4; j++) {
        const x = handle.left + (handle.width * i) / 10
        const y = handle.top + (handle.height * j) / 4
        let drag = false
        for (const { drag: d, r } of regions) {
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) drag = d
        }
        if (drag) bad++
      }
    }
    return bad
  })
}

test('sidebar: folds to a rail of icons and back, and the tracking light turns red when paused', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  const collapsed = async (): Promise<boolean> =>
    (await invoke(win, 'app:snapshot')).settings.appearance.sidebarCollapsed
  const width = async (): Promise<number> => (await win.locator('aside').boundingBox())?.width ?? 0

  // The handle on the sidebar's edge folds it; the pages still work from their icons.
  await win.locator('[data-testid="sidebar-toggle"]').waitFor()
  expect(await draggableSpotsOnHandle(win)).toBe(0)
  await win.locator('[data-testid="sidebar-toggle"]').click()
  await expect.poll(collapsed).toBe(true)
  await expect.poll(width).toBeLessThan(80)
  // Folded, the whole handle still takes a real mouse click (no drag area over it).
  await win.waitForTimeout(400)
  expect(await draggableSpotsOnHandle(win)).toBe(0)
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
