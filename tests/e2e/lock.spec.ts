import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { advanceClock, invoke, launch, shown } from './helpers'

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

test('prayer lock: the countdown starts once the lock is on screen, both times on the same second', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })
  await invoke(win, 'debug:simulatePrayer', { prayer: 'asr' })
  const overlay = await overlayWindow(app)
  await expect(overlay.locator('h1')).toContainText('العصر')

  const lock = async () => {
    const p = (await invoke(win, 'app:snapshot')).machine.prayer
    if (p.kind !== 'locked') throw new Error(`not locked: ${p.kind}`)
    return p
  }
  // Running only after the window has faded in, well inside the 5 s fallback.
  await expect.poll(async () => (await lock()).runningSince !== null, { timeout: 4000 }).toBe(true)
  const p = await lock()
  // Asr locks 15 minutes and «صلّيت» opens after 5: exactly 10 minutes apart,
  // and the full 15 minutes counted from when it appeared, not from when it was due.
  expect(p.until - p.minUnlockAt).toBe(10 * 60_000)
  expect(p.until - p.startedAt).toBeGreaterThanOrEqual(15 * 60_000)
  // The lock screen counts down from there («متاح بعد ٥:٠٠» moves on, rolling like the time left).
  const unlockIn = overlay.locator('[data-testid="lock-prayed"] [role="timer"]')
  await expect(unlockIn).toHaveAttribute('aria-label', /٥:٠٠/)
  await expect(unlockIn).toHaveAttribute('aria-label', /٤:٥/, { timeout: 5000 })
  await app.close()
})

test('prayer lock: snooze once for the chosen minutes, then صلّيت after the minimum time', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', { minUnlockMinutes: 0, smart: { skipWhenAway: false } })
  await invoke(win, 'debug:simulatePrayer', { prayer: 'maghrib' })
  let overlay = await overlayWindow(app)
  const closed = overlay.waitForEvent('close')
  // «أجّل» opens the choice of length; the default (5 minutes) is marked.
  await overlay.locator('[data-testid="lock-snooze"]').click()
  await expect(overlay.locator('[data-testid="lock-snooze-5"]')).toHaveAttribute(
    'data-default',
    'true'
  )
  await overlay.locator('[data-testid="lock-snooze-2"]').click()
  await closed
  const snoozed = (await invoke(win, 'app:snapshot')).machine.prayer
  expect(snoozed.kind).toBe('snoozed')
  if (snoozed.kind === 'snoozed') expect(snoozed.resumeAt - snoozed.snoozedAt).toBe(2 * 60_000)

  // Jump the scheduler clock past the snooze: the lock returns without a second snooze.
  await advanceClock(win, 3)
  overlay = await overlayWindow(app)
  await expect(overlay.locator('[data-testid="lock-snooze"]')).toBeDisabled()
  const closed2 = overlay.waitForEvent('close')
  await overlay.locator('[data-testid="lock-prayed"]').click()
  await closed2
  const snap = await invoke(win, 'app:snapshot')
  expect(snap.machine.prayer.kind).toBe('idle')
  await app.close()
})

test('prayer lock: the sound is muted while locked and comes back after a snooze or an exit', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  // No chime: the mute then happens right away. A 4-second emergency hold is shown.
  await invoke(win, 'settings:update', {
    chime: false,
    emergencyHoldSeconds: 4,
    smart: { skipWhenAway: false }
  })
  const muted = async (): Promise<boolean | null> =>
    (await invoke(win, 'debug:readout')).testOutputMuted
  await invoke(win, 'debug:simulatePrayer', { prayer: 'isha' })
  let overlay = await overlayWindow(app)
  await expect(overlay.locator('[data-testid="emergency-exit"]')).toContainText('٤')
  await expect.poll(muted).toBe(true)

  let closed = overlay.waitForEvent('close')
  await overlay.locator('[data-testid="lock-snooze"]').click()
  await overlay.locator('[data-testid="lock-snooze-1"]').click()
  await closed
  await expect.poll(muted).toBe(false)

  await advanceClock(win, 2)
  overlay = await overlayWindow(app)
  await expect.poll(muted).toBe(true)
  closed = overlay.waitForEvent('close')
  const box = await overlay.locator('[data-testid="emergency-exit"]').boundingBox()
  await overlay.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await overlay.mouse.down()
  await closed
  await overlay.mouse.up().catch(() => undefined)
  await expect.poll(muted).toBe(false)
  expect((await invoke(win, 'debug:readout')).soundMutedByLock).toBe(false)
  await app.close()
})

test('prayer lock: no snooze button when snoozing is turned off', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', {
    snooze: { enabled: false },
    smart: { skipWhenAway: false }
  })
  await invoke(win, 'debug:simulatePrayer', { prayer: 'asr' })
  const overlay = await overlayWindow(app)
  await expect(overlay.locator('[data-testid="lock-prayed"]')).toBeVisible()
  await expect(overlay.locator('[data-testid="lock-snooze"]')).toHaveCount(0)
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
