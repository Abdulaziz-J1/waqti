import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

test('app launches', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-e2e-'))
  const app = await electron.launch({ args: ['.'], env: { ...process.env, WAQTI_USER_DATA: dir } })
  const win = await app.firstWindow()
  await expect(win.locator('h1')).toHaveText('وقتي')
  await win.waitForTimeout(4000)
  const snap = await win.evaluate(() => window.waqti.invoke('app:snapshot'))
  console.log(
    JSON.stringify({
      machine: snap.machine,
      tracking: snap.tracking,
      sched: snap.schedule?.today.day,
      err: snap.scheduleError
    })
  )
  const readout = await win.evaluate(() => window.waqti.invoke('debug:readout'))
  console.log(JSON.stringify(readout))
  await app.close()
  console.log(fs.readFileSync(path.join(dir, 'logs', 'waqti.log'), 'utf8'))
})
