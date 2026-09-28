import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { invoke, launch, shown } from './helpers'

const SHOTS = process.env['SHOT_DIR']

async function overlayWindow(app: Awaited<ReturnType<typeof launch>>['app']): Promise<Page> {
  const match = (w: Page): boolean => w.url().includes('overlay.html')
  return shown(app, app.windows().find(match) ?? (await app.waitForEvent('window', match)))
}

test('prayer lock: overlay appears on simulate and the emergency exit closes it', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  // The test machine may really be idle; the away rule is covered by its own test.
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })
  await invoke(win, 'debug:simulatePrayer', { prayer: 'asr' })

  const overlay = await overlayWindow(app)
  await expect(overlay.locator('h1')).toContainText('العصر')
  await expect(overlay.locator('[data-testid="lock-prayed"]')).toBeDisabled()
  await expect(overlay.locator('[data-testid="lock-snooze"]')).toBeEnabled()
  if (SHOTS) {
    await overlay.waitForTimeout(1200)
    await overlay.screenshot({ path: path.join(SHOTS, 'lock.png') })
  }

  const snap = await invoke(win, 'app:snapshot')
  expect(snap.machine.prayer.kind).toBe('locked')

  // A short press does nothing.
  await overlay.locator('[data-testid="emergency-exit"]').click({ delay: 400 })
  await overlay.waitForTimeout(300)
  expect((await invoke(win, 'app:snapshot')).machine.prayer.kind).toBe('locked')

  // Holding for 3 s exits (the window closes while the button is still held).
  const closed = overlay.waitForEvent('close')
  const box = await overlay.locator('[data-testid="emergency-exit"]').boundingBox()
  await overlay.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await overlay.mouse.down()
  await closed
  await overlay.mouse.up().catch(() => undefined)
  const after = await invoke(win, 'app:snapshot')
  expect(after.machine.prayer.kind).toBe('idle')
  const today = after.schedule!.today.day
  const log = await invoke(win, 'prayer:history', { from: today, to: today })
  expect(log.find((e) => e.prayer === 'asr')?.outcome).toBe('emergency')
  await app.close()
})

test('prayer lock: snooze once, then صلّيت after the minimum time', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', { minUnlockMinutes: 0, smart: { skipWhenAway: false } })
  await invoke(win, 'debug:simulatePrayer', { prayer: 'maghrib' })
  let overlay = await overlayWindow(app)
  const closed = overlay.waitForEvent('close')
  await overlay.locator('[data-testid="lock-snooze"]').click()
  await closed
  expect((await invoke(win, 'app:snapshot')).machine.prayer.kind).toBe('snoozed')

  // Jump the scheduler clock past the snooze: the lock returns without a second snooze.
  await invoke(win, 'debug:setOffset', { minutes: 6 })
  overlay = await overlayWindow(app)
  await expect(overlay.locator('[data-testid="lock-snooze"]')).toBeDisabled()
  const closed2 = overlay.waitForEvent('close')
  await overlay.locator('[data-testid="lock-prayed"]').click()
  await closed2
  const snap = await invoke(win, 'app:snapshot')
  expect(snap.machine.prayer.kind).toBe('idle')
  await app.close()
})

test('smart rules: away skips the lock, meetings defer it', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'debug:setIdle', { on: true })
  await invoke(win, 'debug:simulatePrayer', { prayer: 'isha' })
  let snap = await invoke(win, 'app:snapshot')
  expect(snap.machine.prayer.kind).toBe('idle')
  const log = await invoke(win, 'prayer:history', {
    from: snap.schedule!.today.day,
    to: snap.schedule!.today.day
  })
  expect(log.find((e) => e.prayer === 'isha')).toMatchObject({ outcome: 'skipped', reason: 'away' })

  await invoke(win, 'debug:setIdle', { on: false })
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })
  await invoke(win, 'debug:setMeeting', { on: true })
  await win.waitForTimeout(1500)
  await invoke(win, 'debug:simulatePrayer', { prayer: 'fajr' })
  snap = await invoke(win, 'app:snapshot')
  expect(snap.machine.prayer.kind).toBe('meetingDeferred')
  await app.close()
})
