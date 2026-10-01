import { expect, test, type Page } from '@playwright/test'
import { invoke, launch, shown } from './helpers'

const isNotice = (w: Page): boolean => w.url().includes('kind=adhan')

test('adhan notice: announces the prayer and in how long the lock follows, closes by button or after 10 s', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })

  let opened = app.waitForEvent('window', isNotice)
  await invoke(win, 'debug:simulateAdhan', { prayer: 'asr' })
  let notice = await shown(app, await opened)
  const card = notice.getByTestId('adhan-notice')
  await expect(card).toContainText('حان وقت أذان العصر')
  // Asr locks 20 minutes after its adhan by default.
  await expect(card).toContainText('الشاشة بتنقفل بعد ٢٠ دقيقة، الساعة')
  // Only a notice: the lock waits for the iqama.
  expect((await invoke(win, 'app:snapshot')).machine.prayer.kind).toBe('idle')
  let closed = notice.waitForEvent('close')
  await notice.getByTestId('adhan-close').click()
  await closed

  // Left alone, it closes itself after about 10 seconds.
  opened = app.waitForEvent('window', isNotice)
  await invoke(win, 'debug:simulateAdhan', { prayer: 'maghrib' })
  notice = await shown(app, await opened)
  const t0 = Date.now()
  closed = notice.waitForEvent('close', { timeout: 15_000 })
  await closed
  expect(Date.now() - t0).toBeGreaterThan(8_000)
  await app.close()
})

test('sunrise notice: says when Fajr ends, and follows its setting', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })

  const opened = app.waitForEvent('window', isNotice)
  await invoke(win, 'debug:simulateSunrise')
  const notice = await shown(app, await opened)
  const card = notice.getByTestId('adhan-notice')
  // 15 minutes before by default: the time left and the last time for Fajr.
  await expect(card).toContainText('الشروق بعد ١٥ دقيقة')
  await expect(card).toContainText('آخر وقت لصلاة الفجر')
  const closed = notice.waitForEvent('close')
  await notice.getByTestId('adhan-close').click()
  await closed

  // The Prayer page has the switch and how long before sunrise.
  await win.locator('[data-testid="nav-prayer"]').click()
  const panel = win.locator('#prayer-reminders')
  await expect(panel.getByRole('switch', { name: 'تنبيه الشروق' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await panel.getByRole('switch', { name: 'تنبيه الشروق' }).click()
  await expect
    .poll(async () => (await invoke(win, 'app:snapshot')).settings.sunrise.notice)
    .toBe(false)
  await app.close()
})
