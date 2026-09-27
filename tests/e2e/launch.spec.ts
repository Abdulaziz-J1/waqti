import { _electron as electron, expect, test } from '@playwright/test'

test('app launches', async () => {
  const app = await electron.launch({ args: ['.'] })
  const win = await app.firstWindow()
  await expect(win.locator('h1')).toHaveText('وقتي')
  await app.close()
})
