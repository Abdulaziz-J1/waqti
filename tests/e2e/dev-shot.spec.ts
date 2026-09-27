import path from 'node:path'
import { test } from '@playwright/test'
import { invoke, launch } from './helpers'

const OUT = process.env['SHOT_DIR'] ?? 'test-results'
const PAGES = (process.env['SHOT_PAGES'] ?? 'today').split(',')

/** Developer screenshots (skipped unless SHOT_DIR is set). */
test('dev screenshots', async () => {
  test.skip(!process.env['SHOT_DIR'], 'developer screenshots only')
  const { app, win } = await launch()
  await win.setViewportSize({ width: 1280, height: 820 })
  if (process.env['SHOT_OFFSET']) {
    await invoke(win, 'debug:setOffset', { minutes: Number(process.env['SHOT_OFFSET']) })
  }
  if (process.env['SHOT_ONBOARDING'] === '1') {
    await win.waitForTimeout(800)
    for (let i = 0; i < 5; i++) {
      await win.waitForTimeout(900)
      await win.screenshot({ path: path.join(OUT, `onboarding-${i + 1}.png`) })
      if (i < 4) await win.locator('[data-testid="onboarding-next"]').click()
    }
    await app.close()
    return
  }
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  if (process.env['SHOT_SEED']) {
    await invoke(win, 'debug:seed', { range: process.env['SHOT_SEED'] as 'week' })
  }
  await win.waitForTimeout(1500)
  for (const p of PAGES) {
    await win.locator(`[data-testid="nav-${p}"]`).click()
    await win.waitForTimeout(1600)
    await win.screenshot({ path: path.join(OUT, `${p}.png`) })
    if (p === 'settings' && process.env['SHOT_SECTIONS']) {
      for (const name of process.env['SHOT_SECTIONS'].split(',')) {
        await win.getByRole('radio', { name }).click()
        await win.waitForTimeout(700)
        await win.screenshot({ path: path.join(OUT, `settings-${name}.png`) })
      }
    }
    if (process.env['SHOT_FULL'] === '1') {
      await win.evaluate(() => document.querySelector('main > div:last-child')?.scrollTo(0, 99999))
      await win.waitForTimeout(600)
      await win.screenshot({ path: path.join(OUT, `${p}-bottom.png`) })
    }
  }
  await app.close()
})
