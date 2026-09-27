import { expect, test } from '@playwright/test'
import { invoke, launch, readLog } from './helpers'

test('app launches with a working main process', async () => {
  const { app, win, dataDir } = await launch()
  await expect(win.locator('h1').first()).toBeVisible()
  const snap = await invoke(win, 'app:snapshot')
  expect(snap.schedule?.today.times.fajr).toBeGreaterThan(0)
  expect(snap.machine.prayer.kind).toBe('idle')
  await app.close()
  expect(readLog(dataDir)).not.toContain('[error]')
})
