import { expect, test } from '@playwright/test'
import { invoke, launch } from './helpers'

test('focus: sites as chips that switch off, come off the list and say what happened', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await win.locator('[data-testid="nav-focus"]').click()
  const distractions = async () => (await invoke(win, 'app:snapshot')).settings.distractions

  // «إضافة موقع»: switch on a known site and type any other one.
  await win.locator('[data-testid="add-site"]').click()
  const dialog = win.getByRole('dialog')
  await dialog.getByRole('switch', { name: 'Reddit' }).click()
  await dialog.locator('[data-testid="site-input"]').fill('https://www.kick.com/some-stream')
  await dialog.locator('[data-testid="site-input"]').press('Enter')
  await expect.poll(distractions).toMatchObject({ customSites: ['kick'] })
  expect((await distractions()).sites).toContain('reddit')
  await dialog.getByRole('button', { name: 'تم' }).click()

  // Each added site is a chip like YouTube's: pressing it switches it off, and it stays.
  const chips = win.locator('[data-testid="site-chips"]')
  const kick = chips.getByRole('button', { name: 'kick', exact: true })
  await expect(kick).toHaveAttribute('aria-pressed', 'true')
  await kick.click()
  await expect(kick).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(distractions).toMatchObject({ customSites: [], listedCustomSites: ['kick'] })

  // Adding again says it is already there, and the dialog stays open for more.
  await win.locator('[data-testid="add-site"]').click()
  await dialog.locator('[data-testid="site-input"]').fill('youtube.com')
  await dialog.locator('[data-testid="site-add"]').click()
  await expect(
    dialog.getByTestId('flash-note').filter({ hasText: 'في القائمة من قبل' })
  ).toBeVisible()
  await dialog.locator('[data-testid="site-input"]').fill('kick')
  await dialog.locator('[data-testid="site-input"]').press('Enter')
  await expect(dialog.getByTestId('flash-note').filter({ hasText: 'فعّلنا kick' })).toBeVisible()
  await expect.poll(distractions).toMatchObject({ customSites: ['kick'] })
  await dialog.getByRole('button', { name: 'تم' }).last().click()

  // The pencil beside «مواقع»: × takes any site off the list, presets included.
  await win.locator('[data-testid="edit-sites"]').click()
  await chips.getByRole('button', { name: 'حذف kick' }).click()
  await expect(kick).toHaveCount(0)
  await chips.getByRole('button', { name: 'حذف Snapchat' }).click()
  await expect(chips.getByRole('button', { name: 'Snapchat', exact: true })).toHaveCount(0)
  await expect
    .poll(distractions)
    .toMatchObject({ listedCustomSites: [], hiddenPresets: ['snapchat'] })
  expect((await distractions()).sites).not.toContain('snapchat')
  await win.locator('[data-testid="edit-sites"]').click()

  // A removed preset waits in «إضافة موقع» and comes back with its switch.
  await win.locator('[data-testid="add-site"]').click()
  await dialog.getByRole('switch', { name: 'Snapchat' }).click()
  await expect(
    dialog.getByTestId('flash-note').filter({ hasText: 'تمت إضافة Snapchat' })
  ).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Snapchat' })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await dialog.getByRole('button', { name: 'تم' }).last().click()
  await expect(chips.getByRole('button', { name: 'Snapchat', exact: true })).toBeVisible()
  expect((await distractions()).hiddenPresets).toEqual([])
  await app.close()
})

test('focus: the dial starts at 30 minutes, steps by 5, and the picker sets any length', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', {
    distractions: { apps: [], sites: [], keywords: [], customSites: [] }
  })
  await win.locator('[data-testid="nav-focus"]').click()
  const face = win.locator('[data-testid="focus-face"]')
  await expect(face).toHaveAccessibleName(/٣٠ دقيقة/)

  // − and + beside the dial: five minutes a press.
  await win.locator('[data-testid="focus-more"]').click()
  await expect(face).toHaveAccessibleName(/٣٥ دقيقة/)
  await win.locator('[data-testid="focus-less"]').click()
  await win.locator('[data-testid="focus-less"]').click()
  await expect(face).toHaveAccessibleName(/٢٥ دقيقة/)

  // The clock face opens the picker: hours, minutes and seconds wheels.
  await face.click()
  const picker = win.locator('[data-testid="time-picker"]')
  await expect(picker).toBeVisible()
  await picker.getByRole('spinbutton', { name: 'ساعة' }).press('ArrowUp')
  await picker.getByRole('spinbutton', { name: 'ثانية' }).press('PageUp')
  await picker.getByRole('spinbutton', { name: 'ثانية' }).press('PageUp')
  await expect(picker.getByRole('spinbutton', { name: 'دقيقة' })).toHaveAttribute(
    'aria-valuenow',
    '25'
  )
  await picker.locator('[data-testid="time-picker-done"]').click()
  await expect(picker).toHaveCount(0)

  // Saved for next time (and for the tray), then started at 1:25:20.
  await expect
    .poll(async () => (await invoke(win, 'app:snapshot')).settings.focus.lastSeconds)
    .toBe(3600 + 25 * 60 + 20)
  await win.locator('[data-testid="focus-start"]').click()
  const planned = async (): Promise<number | null> => {
    const f = (await invoke(win, 'app:snapshot')).machine.focus
    return f.kind === 'off' ? null : f.session.plannedMs
  }
  await expect.poll(planned).toBe((3600 + 25 * 60 + 20) * 1000)

  // During the session + moves the end five minutes later.
  await expect(win.locator('[data-testid="focus-stop"]')).toBeVisible()
  await win.locator('[data-testid="focus-more"]').click()
  await expect.poll(planned).toBe((3600 + 30 * 60 + 20) * 1000)
  await win.locator('[data-testid="focus-stop"]').click()
  await expect(win.locator('[data-testid="focus-start"]')).toBeVisible()

  // Dragging the ring like a kitchen timer: a quarter turn is 15 minutes.
  const ring = await win.locator('[data-testid="focus-ring"]').boundingBox()
  const cx = ring!.x + ring!.width / 2
  const cy = ring!.y + ring!.height / 2
  const r = (ring!.width / 2) * (124 / 160)
  await win.mouse.move(cx + r, cy)
  await win.mouse.down()
  await win.mouse.move(cx + r * 0.7, cy + r * 0.7, { steps: 4 })
  await win.mouse.move(cx, cy + r, { steps: 4 })
  await win.mouse.up()
  // From 1:25:20 the press lands on 1:15 (this hour's quarter) and the drag winds on to 1:30.
  await expect(face).toHaveAccessibleName(/ساعة و٣٠ دقيقة/)
  await app.close()
})

test('focus: a prayer inside the length is announced, with a length that ends at its adhan', async () => {
  const { app, win } = await launch()
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', { focus: { lastSeconds: 12 * 3600 } })
  await win.locator('[data-testid="nav-focus"]').click()
  const note = win.locator('[data-testid="focus-prayer-note"]')
  await expect(note).toContainText(/الظهر|الجمعة/)
  await note.getByRole('button').click()
  // Ends with the Dhuhr adhan: under two hours from the pinned 10:00.
  await expect
    .poll(async () => (await invoke(win, 'app:snapshot')).settings.focus.lastSeconds)
    .toBeLessThan(2 * 3600)
  await expect(note).toHaveCount(0)
  await app.close()
})
