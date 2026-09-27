import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { invoke, launch } from './helpers'

test('quit during a lock: no stuck overlay on the next start, recorded as interrupted', async () => {
  const first = await launch()
  await invoke(first.win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(first.win, 'settings:update', { smart: { skipWhenAway: false } })
  await invoke(first.win, 'debug:simulatePrayer', { prayer: 'maghrib' })
  await first.app.waitForEvent('window', { predicate: (w) => w.url().includes('kind=lock') })
  const day = (await invoke(first.win, 'app:snapshot')).schedule!.today.day
  await first.app.close()

  const second = await launch({}, first.dataDir)
  await second.win.waitForTimeout(2500)
  expect(second.app.windows().some((w) => w.url().includes('overlay.html'))).toBe(false)
  const snap = await invoke(second.win, 'app:snapshot')
  expect(snap.machine.prayer.kind).not.toBe('locked')
  const log = await invoke(second.win, 'prayer:history', { from: day, to: day })
  expect(log.find((e) => e.prayer === 'maghrib')).toMatchObject({
    outcome: 'ended',
    reason: 'interrupted'
  })
  await second.app.close()
})

test('database corruption: restores the newest healthy backup and tells the user', async () => {
  const first = await launch()
  await invoke(first.win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(first.win, 'focus:start', { minutes: 25 })
  await invoke(first.win, 'focus:stop')
  await first.app.close()

  const db = path.join(first.dataDir, 'waqti.db')
  const backups = path.join(first.dataDir, 'backups')
  fs.mkdirSync(backups, { recursive: true })
  fs.copyFileSync(db, path.join(backups, 'waqti-2026-09-20.db'))
  for (const ext of ['-wal', '-shm']) fs.rmSync(db + ext, { force: true })
  fs.writeFileSync(db, 'this file is not a database '.repeat(200))

  const second = await launch({}, first.dataDir)
  await expect(second.win.getByRole('status')).toContainText('نسخة احتياطية')
  expect((await invoke(second.win, 'data:counts')).sessions).toBe(1)
  expect(fs.readdirSync(first.dataDir).some((f) => f.includes('.corrupt-'))).toBe(true)
  await second.win.getByRole('button', { name: 'تمام' }).click()
  await expect(second.win.getByRole('status')).toHaveCount(0)
  await second.app.close()
})
