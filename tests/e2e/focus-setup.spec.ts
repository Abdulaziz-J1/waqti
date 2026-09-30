import { expect, test } from '@playwright/test'
import { invoke, launch } from './helpers'

test('focus: add a known and an unknown site, then start a length typed in hours', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await win.locator('[data-testid="nav-focus"]').click()

  // «إضافة موقع»: switch on a known site and type any other one.
  await win.locator('[data-testid="add-site"]').click()
  const dialog = win.getByRole('dialog')
  await dialog.getByRole('switch', { name: 'Reddit' }).click()
  await dialog.locator('[data-testid="site-input"]').fill('https://www.kick.com/some-stream')
  await dialog.locator('[data-testid="site-input"]').press('Enter')
  await expect
    .poll(async () => (await invoke(win, 'app:snapshot')).settings.distractions)
    .toMatchObject({ customSites: ['kick'] })
  expect((await invoke(win, 'app:snapshot')).settings.distractions.sites).toContain('reddit')
  await dialog.getByRole('button', { name: 'تم' }).click()
  const editor = win.locator('#focus-distractions')
  await expect(editor).toContainText('Reddit')
  await expect(editor).toContainText('kick')

  // A custom length typed as 2 hours.
  await win.getByRole('radio', { name: 'مخصص' }).click()
  await win.getByRole('radio', { name: 'ساعة' }).click()
  await win.locator('[data-testid="focus-typed"]').fill('2')
  await win.locator('[data-testid="focus-start"]').click()
  await expect
    .poll(async () => {
      const f = (await invoke(win, 'app:snapshot')).machine.focus
      return f.kind === 'off' ? null : f.session.plannedMs
    })
    .toBe(120 * 60_000)
  await win.locator('[data-testid="focus-stop"]').click()

  // Out of range: the start button waits for a valid length.
  await win.getByRole('radio', { name: 'مخصص' }).click()
  await win.locator('[data-testid="focus-typed"]').fill('30')
  await expect(win.locator('[data-testid="focus-start"]')).toBeDisabled()
  await expect(win.getByRole('alert')).toContainText('٢٤ ساعة')
  await app.close()
})
