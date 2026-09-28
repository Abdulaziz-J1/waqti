import { expect, test, type Page } from '@playwright/test'
import { invoke, launch, shown } from './helpers'

const isNotice = (w: Page): boolean => w.url().includes('kind=adhan')

test('adhan notice: announces the prayer and the lock at the iqama, closes by button or after 10 s', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })

  let opened = app.waitForEvent('window', isNotice)
  await invoke(win, 'debug:simulateAdhan', { prayer: 'asr' })
  let notice = await shown(app, await opened)
  const card = notice.getByTestId('adhan-notice')
  await expect(card).toContainText('حان وقت أذان العصر')
  await expect(card).toContainText('وقت الإقامة')
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
