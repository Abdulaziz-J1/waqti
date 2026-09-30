import { expect, test } from '@playwright/test'
import { PlaybackStatus } from '../../src/shared/media'
import { TEST_APP_ID as APP_ID, invoke, launch, readLog } from './helpers'

/** 10 s of 8 kHz 8-bit mono silence: long enough for Windows to list it as media, and inaudible. */
function silentWav(seconds = 10): string {
  const rate = 8000
  const n = rate * seconds
  const b = Buffer.alloc(44 + n, 0x80)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate, 28)
  b.writeUInt16LE(1, 32)
  b.writeUInt16LE(8, 34)
  b.write('data', 36)
  b.writeUInt32LE(n, 40)
  return `data:audio/wav;base64,${b.toString('base64')}`
}

type Launched = Awaited<ReturnType<typeof launch>>

/** Starts a silent looping player in the app window; resolves once Windows lists it as playing. */
async function startPlayer(win: Launched['win']): Promise<() => Promise<boolean>> {
  await win.evaluate((src) => {
    const audio = new Audio(src)
    audio.loop = true
    ;(globalThis as unknown as { player: HTMLAudioElement }).player = audio
    return audio.play()
  }, silentWav())
  // Read through the app's own media helper.
  const status = async (): Promise<number | null> =>
    (await invoke(win, 'debug:mediaSessions')).find((m) => m.appId === APP_ID)?.status ?? null
  await expect.poll(status, { timeout: 15_000 }).toBe(PlaybackStatus.playing)
  return () =>
    win.evaluate(() => (globalThis as unknown as { player: HTMLAudioElement }).player.paused)
}

test('media: what is playing pauses when the lock starts', async () => {
  test.skip(process.platform !== 'win32', 'Windows media controls only')
  const { app, win, dataDir } = await launch({ WAQTI_MEDIA_PAUSE_APP: APP_ID })
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })
  const paused = await startPlayer(win)

  await invoke(win, 'debug:simulatePrayer', { prayer: 'asr' })
  await expect.poll(paused, { timeout: 15_000 }).toBe(true)
  await expect.poll(() => readLog(dataDir), { timeout: 5_000 }).toContain(`media paused: ${APP_ID}`)
  await app.close()
})

test('media: every playing tab pauses, not only the one Windows shows', async () => {
  test.skip(process.platform !== 'win32', 'Windows media controls only')
  const { app, win } = await launch({ WAQTI_MEDIA_PAUSE_APP: APP_ID })
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })
  const first = await startPlayer(win)
  // A second window of the same app plays too, like a second browser tab.
  await app.evaluate(async ({ BrowserWindow }, src) => {
    const w = new BrowserWindow({ width: 320, height: 200, show: true })
    await w.loadURL('about:blank')
    await w.webContents.executeJavaScript(
      `(() => { const a = new Audio(${JSON.stringify(src)}); a.loop = true; window.player = a; return a.play() })()`,
      true
    )
    ;(globalThis as unknown as { second: typeof w }).second = w
  }, silentWav())
  const second = (): Promise<boolean> =>
    app.evaluate(() =>
      (
        globalThis as unknown as { second: Electron.BrowserWindow }
      ).second.webContents.executeJavaScript('window.player.paused')
    ) as Promise<boolean>
  await expect.poll(second, { timeout: 10_000 }).toBe(false)

  await win.waitForTimeout(1500)
  await invoke(win, 'debug:simulatePrayer', { prayer: 'asr' })
  await expect.poll(first, { timeout: 15_000 }).toBe(true)
  await expect.poll(second, { timeout: 15_000 }).toBe(true)
  // Stopping a browser session pauses in place: both keep their position.
  const position = await win.evaluate(
    () => (globalThis as unknown as { player: HTMLAudioElement }).player.currentTime
  )
  const secondPosition = (await app.evaluate(() =>
    (
      globalThis as unknown as { second: Electron.BrowserWindow }
    ).second.webContents.executeJavaScript('window.player.currentTime')
  )) as number
  expect(position).toBeGreaterThan(1)
  expect(secondPosition).toBeGreaterThan(1)
  await app.close()
})

test('media: watching without touching the keyboard is not away', async () => {
  test.skip(process.platform !== 'win32', 'Windows media controls only')
  const { app, win, dataDir } = await launch({ WAQTI_MEDIA_PAUSE_APP: APP_ID })
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  // The away rule stays on (its default); the input idle time is over 5 minutes.
  await invoke(win, 'debug:setIdle', { on: true })
  const paused = await startPlayer(win)

  await invoke(win, 'debug:simulatePrayer', { prayer: 'maghrib' })
  await expect
    .poll(async () => (await invoke(win, 'app:snapshot')).machine.prayer.kind, { timeout: 15_000 })
    .toBe('locked')
  await expect.poll(paused, { timeout: 15_000 }).toBe(true)
  expect(readLog(dataDir)).toContain('media is playing: locking')
  await app.close()
})
