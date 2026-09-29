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

test('media: what is playing pauses when the lock starts', async () => {
  test.skip(process.platform !== 'win32', 'Windows media controls only')
  const { app, win, dataDir } = await launch({ WAQTI_MEDIA_PAUSE_APP: APP_ID })
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'settings:update', { smart: { skipWhenAway: false } })

  const player = (): Promise<boolean> =>
    win.evaluate(() => (globalThis as unknown as { player: HTMLAudioElement }).player.paused)
  await win.evaluate((src) => {
    const audio = new Audio(src)
    audio.loop = true
    ;(globalThis as unknown as { player: HTMLAudioElement }).player = audio
    return audio.play()
  }, silentWav())

  // Windows lists the app's player as playing (read through the app's own media helper).
  const status = async (): Promise<number | null> =>
    (await invoke(win, 'debug:mediaSessions')).find((m) => m.appId === APP_ID)?.status ?? null
  await expect.poll(status, { timeout: 15_000 }).toBe(PlaybackStatus.playing)

  await invoke(win, 'debug:simulatePrayer', { prayer: 'asr' })
  await expect.poll(player, { timeout: 15_000 }).toBe(true)
  await expect.poll(() => readLog(dataDir), { timeout: 5_000 }).toContain(`media paused: ${APP_ID}`)
  await app.close()
})
