import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { invoke, launch } from './helpers'

test('settings: digits, recategorize, export, import and delete all', async () => {
  const { app, win, dataDir } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'debug:seed', { range: 'week' })

  // Latin digits apply everywhere.
  await win.locator('[data-testid="nav-settings"]').click()
  await win.getByRole('radio', { name: '0123' }).click()
  await win.locator('[data-testid="nav-today"]').click()
  await expect(win.locator('[role="timer"]').first()).toHaveAttribute('aria-label', /[0-9]/)

  // Re-categorise an activity from the reports table.
  await win.locator('[data-testid="nav-reports"]').click()
  const firstChip = win.locator('#reports-table [role="row"] button').first()
  await firstChip.click()
  await win.getByRole('option', { name: 'أخرى' }).click()
  await expect(win.getByRole('dialog')).toBeHidden()
  const cats = await invoke(win, 'categories:get')
  expect(cats.rules.some((r) => r.categoryId === 'other')).toBe(true)

  // Export JSON and CSV (the save dialog is replaced by a fixed path).
  const jsonPath = path.join(dataDir, 'export.json')
  const csvPath = path.join(dataDir, 'export.csv')
  // Demo rows are never exported, so create one real focus session to export.
  await invoke(win, 'focus:start', { minutes: 25 })
  await invoke(win, 'focus:stop')
  for (const [file, format] of [
    [jsonPath, 'json'],
    [csvPath, 'csv']
  ] as const) {
    await app.evaluate(({ dialog }, f) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: f
      })) as typeof dialog.showSaveDialog
    }, file)
    const r = await invoke(win, 'data:export', { format })
    expect(r.path).toBe(file)
  }
  const bundle = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
    format: string
    focusSessions: unknown[]
  }
  expect(bundle.format).toBe('waqti-export')
  expect(bundle.focusSessions.length).toBe(1)
  expect(fs.readFileSync(csvPath, 'utf8').charCodeAt(0)).toBe(0xfeff)

  // Delete all data through the confirmation dialog.
  await win.locator('[data-testid="nav-settings"]').click()
  await win.getByRole('radio', { name: 'البيانات' }).click()
  await win.locator('[data-testid="delete-all"]').click()
  await expect(win.locator('[data-testid="delete-all-confirm"]')).toBeDisabled()
  await win.locator('[data-testid="delete-all-input"]').fill('حذف')
  await win.locator('[data-testid="delete-all-confirm"]').click()
  await expect.poll(async () => (await invoke(win, 'data:counts')).sessions).toBe(0)

  // Import the JSON back.
  await app.evaluate(({ dialog }, f) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [f]
    })) as typeof dialog.showOpenDialog
  }, jsonPath)
  const imported = await invoke(win, 'data:import')
  expect(imported.error).toBeNull()
  expect(imported.imported?.sessions).toBe(1)
  await app.close()
})
