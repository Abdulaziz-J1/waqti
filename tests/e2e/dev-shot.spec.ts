import path from 'node:path'
import { test } from '@playwright/test'
import { invoke, launch } from './helpers'

const OUT = process.env['SHOT_DIR'] ?? 'test-results'
const PAGES = (process.env['SHOT_PAGES'] ?? 'today').split(',')

test('dev screenshots', async () => {
  test.skip(!process.env['SHOT_DIR'], 'developer screenshots only')
  const { app, win } = await launch()
  await win.setViewportSize({ width: 1280, height: 820 })
  if (process.env['SHOT_ONBOARDING'] !== '1') {
    await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  }
  if (process.env['SHOT_SEED'])
    await invoke(win, 'debug:seed', { range: process.env['SHOT_SEED'] as 'week' })
  if (process.env['SHOT_OFFSET']) {
    await invoke(win, 'debug:setOffset', { minutes: Number(process.env['SHOT_OFFSET']) })
  }
  await win.waitForTimeout(1500)
  for (const p of PAGES) {
    if (process.env['SHOT_ONBOARDING'] !== '1') {
      await win.locator(`[data-testid="nav-${p}"]`).click()
    }
    await win.waitForTimeout(1600)
    await win.screenshot({ path: path.join(OUT, `${p}.png`) })
  }
  await app.close()
})
