import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { advanceClock, invoke, launch, shown } from './helpers'

const SHOTS = process.env['SHOT_DIR']

async function overlay(
  app: Awaited<ReturnType<typeof launch>>['app'],
  kind: 'guard' | 'lock'
): Promise<Page> {
  const match = (w: Page): boolean => w.url().includes(`kind=${kind}`)
  return shown(app, app.windows().find(match) ?? (await app.waitForEvent('window', match)))
}

test('focus session: guard, back to work, snooze, prayer pause and summary', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  // Empty lists: the real foreground window (whatever the person at the machine is
  // doing) must never replace the simulated distraction below.
  await invoke(win, 'settings:update', {
    smart: { skipWhenAway: false },
    distractions: { apps: [], sites: [], keywords: [] }
  })
  await win.locator('[data-testid="nav-focus"]').click()
  await win.locator('[data-testid="focus-start"]').click()
  await expect(win.locator('[data-testid="focus-stop"]')).toBeVisible()
  expect((await invoke(win, 'app:snapshot')).machine.focus.kind).toBe('focus')

  // A distraction brings up the guard; "back to work" closes it and counts a block.
  await invoke(win, 'debug:simulateDistraction', { label: 'YouTube' })
  let guard = await overlay(app, 'guard')
  await expect(guard.locator('h1')).toContainText('ارجع لتركيزك')
  await expect(guard.locator('bdi')).toHaveText('YouTube')
  if (SHOTS) {
    await guard.waitForTimeout(700)
    await guard.screenshot({ path: path.join(SHOTS, 'guard.png') })
  }
  let closed = guard.waitForEvent('close')
  await guard.locator('[data-testid="guard-back"]').click()
  await closed
  let snap = await invoke(win, 'app:snapshot')
  expect(snap.machine.focus.kind).toBe('focus')
  if (snap.machine.focus.kind === 'focus') expect(snap.machine.focus.session.blocked).toBe(1)

  // Snooze allows five minutes and counts a distraction.
  await win.waitForTimeout(3500)
  await invoke(win, 'debug:simulateDistraction', { label: 'Netflix' })
  guard = await overlay(app, 'guard')
  closed = guard.waitForEvent('close')
  await guard.locator('[data-testid="guard-snooze"]').click()
  await closed
  snap = await invoke(win, 'app:snapshot')
  if (snap.machine.focus.kind === 'focus') expect(snap.machine.focus.session.snoozed).toBe(1)

  // A prayer lock pauses the session; unlocking resumes it.
  await invoke(win, 'debug:simulatePrayer', { prayer: 'dhuhr' })
  const lock = await overlay(app, 'lock')
  expect((await invoke(win, 'app:snapshot')).machine.focus.kind).toBe('focusPaused')
  closed = lock.waitForEvent('close')
  const box = await lock.locator('[data-testid="emergency-exit"]').boundingBox()
  await lock.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await lock.mouse.down()
  await closed
  await lock.mouse.up().catch(() => undefined)
  expect((await invoke(win, 'app:snapshot')).machine.focus.kind).toBe('focus')

  if (SHOTS) {
    await win.setViewportSize({ width: 1280, height: 820 })
    await win.waitForTimeout(800)
    await win.screenshot({ path: path.join(SHOTS, 'focus-running.png') })
  }

  // Jump past the end: the session completes and the summary appears.
  await advanceClock(win, 30)
  await expect(win.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
  await expect(win.getByRole('dialog')).toContainText('أحسنت')
  if (SHOTS) {
    await win.waitForTimeout(1200)
    await win.screenshot({ path: path.join(SHOTS, 'focus-summary.png') })
  }
  snap = await invoke(win, 'app:snapshot')
  expect(snap.machine.focus.kind).toBe('off')
  await app.close()
})
