import fs from 'node:fs'
import path from 'node:path'
import { test, type ElectronApplication, type Page } from '@playwright/test'
import { invoke, launch, shown } from './helpers'

/**
 * README images (`npm run screenshots`): the real app with a week of demo data
 * at set times of day. Each window is framed (rounded corners, soft shadow,
 * transparent margin) and the overlays are laid over the window behind them.
 */
const RAW = path.resolve('test-results/readme-shots')
const OUT = path.resolve('docs/screenshots')
const W = 1280
const H = 800

/** Minutes to add to the clock so local time becomes hh:mm today. */
function offsetTo(hh: number, mm: number): number {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hh, mm, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 60_000)
}

async function setTime(win: Page, hh: number, mm: number): Promise<void> {
  await invoke(win, 'debug:setOffset', { minutes: offsetTo(hh, mm) })
}

/** A still frame: the rolling digits jump instead of being caught mid-roll. */
async function capture(page: Page, name: string, wait = 1600, transparent = false): Promise<void> {
  await page.addStyleTag({ content: '[role="timer"] * { transition: none !important; }' })
  await page.waitForTimeout(wait)
  await page.screenshot({ path: path.join(RAW, name), omitBackground: transparent })
}

async function overlay(app: ElectronApplication, kind: string): Promise<Page> {
  const match = (w: Page): boolean => w.url().includes(`kind=${kind}`)
  const page = await shown(
    app,
    app.windows().find(match) ?? (await app.waitForEvent('window', match))
  )
  return page
}

const STYLE = `
  html, body { margin: 0; background: transparent; }
  .pad { padding: 28px 40px 52px; }
  .win {
    position: relative; inline-size: ${W}px; block-size: ${H}px;
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 0 0 1px rgba(16, 26, 51, 0.1), 0 4px 10px rgba(16, 26, 51, 0.12),
      0 22px 50px rgba(16, 26, 51, 0.24);
  }
  .win img { position: absolute; inset: 0; display: block; }
  .notice { inset: auto 24px 24px auto !important; filter: drop-shadow(0 14px 30px rgba(0, 0, 0, 0.35)); }
  .grid { display: grid; grid-template-columns: repeat(2, ${W / 2}px); gap: 28px; }
  .grid figure { margin: 0; }
  .grid .win { inline-size: ${W / 2}px; block-size: ${H / 2}px; border-radius: 10px; }
  .grid .win img { inline-size: 100%; block-size: 100%; }
  figcaption {
    margin-block-start: 12px; text-align: center; color: #7d889c;
    font: 600 17px 'Segoe UI', Tahoma, sans-serif;
  }
`

interface Job {
  out: string
  body: string
  size: { width: number; height: number }
}

/** Renders `body` (images from RAW) offscreen and saves it, transparent margin included. */
async function compose(app: ElectronApplication, { out, body, size }: Job): Promise<void> {
  const html = path.join(RAW, out.replace('.png', '.html'))
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>${body}`)
  const png = await app.evaluate(
    async ({ BrowserWindow }, { file, width, height }) => {
      const w = new BrowserWindow({
        width,
        height,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        useContentSize: true,
        webPreferences: { offscreen: true }
      })
      await w.loadFile(file)
      await new Promise((r) => setTimeout(r, 500))
      const image = await w.webContents.capturePage()
      w.destroy()
      return image.toPNG().toString('base64')
    },
    { file: html, ...size }
  )
  fs.writeFileSync(path.join(OUT, out), Buffer.from(png, 'base64'))
}

/** Composes in a fresh app, with nothing (a lock, a notice) left on screen over it. */
async function composeAll(jobs: Job[]): Promise<void> {
  const { app } = await launch()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.hide())
  for (const job of jobs) await compose(app, job)
  await app.close()
}

const FRAMED = { width: W + 80, height: H + 80 }
const framed = (out: string, ...layers: string[]): Job => ({
  out,
  body: `<div class="pad"><div class="win">${(layers.length ? layers : [out])
    .map((l) => `<img src="${l}">`)
    .join('')}</div></div>`,
  size: FRAMED
})

/** Starts Waqti onboarded, with a week of demo data and the window in front. */
async function start(language: 'ar' | 'en') {
  fs.mkdirSync(RAW, { recursive: true })
  fs.mkdirSync(OUT, { recursive: true })
  const launched = await launch()
  const { app, win } = launched
  await win.setViewportSize({ width: W, height: H })
  await setTime(win, 13, 10)
  // Waqti in front, so the sidebar shows Waqti itself, never the machine's real activity.
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    w?.show()
    w?.moveTop()
    w?.focus()
  })
  await invoke(win, 'settings:update', {
    general: { language },
    smart: { skipWhenAway: false },
    focus: { lastSeconds: 45 * 60 }
  })
  await invoke(win, 'onboarding:complete', { launchAtStartup: false })
  await invoke(win, 'debug:seed', { range: 'week' })
  return launched
}

test('screenshots (Arabic)', async () => {
  const { app, win } = await start('ar')
  const nav = (page: string) => win.locator(`[data-testid="nav-${page}"]`).click()

  await nav('today')
  await capture(win, 'today.png')
  await nav('reports')
  await capture(win, 'reports.png', 2800)
  await nav('prayer')
  await capture(win, 'prayer.png')
  await nav('focus')
  await capture(win, 'focus.png')

  // A focus session, then a distraction: the guard over the session.
  await invoke(win, 'focus:start', { seconds: 45 * 60 })
  await capture(win, 'focus-session.png', 2400)
  await invoke(win, 'debug:simulateDistraction', { label: 'YouTube' })
  const guard = await overlay(app, 'guard')
  await guard.setViewportSize({ width: W, height: H })
  await capture(guard, 'guard.png', 1400, true)
  await invoke(win, 'focus:stop')
  await guard.waitForEvent('close').catch(() => undefined)

  // Asr's adhan notice, over the Today page at that minute.
  await nav('today')
  await setTime(win, 15, 7)
  await capture(win, 'today-asr.png', 2400)
  await invoke(win, 'debug:simulateAdhan', { prayer: 'asr' })
  const adhan = await overlay(app, 'adhan')
  await adhan.waitForTimeout(900)
  await adhan
    .getByTestId('adhan-notice')
    .screenshot({ path: path.join(RAW, 'adhan.png'), omitBackground: true })

  // The sky through the day.
  for (const [name, hh, mm] of [
    ['sky-asr.png', 16, 15],
    ['sky-dusk.png', 18, 25],
    ['sky-night.png', 21, 40]
  ] as const) {
    await setTime(win, hh, mm)
    await capture(win, name, 3200)
  }

  // Maghrib's lock, last: it stays on screen.
  await setTime(win, 18, 25)
  await invoke(win, 'debug:simulatePrayer', { prayer: 'maghrib' })
  const lock = await overlay(app, 'lock')
  await lock.setViewportSize({ width: W, height: H })
  await capture(lock, 'lock.png', 2200)

  await app.close()

  await composeAll([
    framed('today.png'),
    framed('reports.png'),
    framed('prayer.png'),
    framed('focus.png'),
    framed('guard.png', 'focus-session.png', 'guard.png'),
    framed('lock.png'),
    {
      out: 'adhan.png',
      body: `<div class="pad"><div class="win"><img src="today-asr.png"><img class="notice" src="adhan.png"></div></div>`,
      size: FRAMED
    },
    {
      out: 'sky.png',
      body: `<div class="pad"><div class="grid">${(
        [
          ['today.png', 'الظهر'],
          ['sky-asr.png', 'العصر'],
          ['sky-dusk.png', 'المغرب'],
          ['sky-night.png', 'الليل']
        ] as const
      )
        .map(
          ([f, label]) =>
            `<figure><div class="win"><img src="${f}"></div><figcaption>${label}</figcaption></figure>`
        )
        .join('')}</div></div>`,
      size: { width: W + 28 + 80, height: H + 28 + 2 * 36 + 80 }
    }
  ])
})

test('screenshots (English)', async () => {
  const { app, win } = await start('en')
  await win.locator('[data-testid="nav-today"]').click()
  await capture(win, 'en-today.png')
  await win.locator('[data-testid="nav-focus"]').click()
  await capture(win, 'en-focus.png')

  await setTime(win, 21, 40)
  await invoke(win, 'debug:simulatePrayer', { prayer: 'isha' })
  const lock = await overlay(app, 'lock')
  await lock.setViewportSize({ width: W, height: H })
  await capture(lock, 'en-lock.png', 2200)

  await app.close()
  await composeAll([framed('en-today.png'), framed('en-focus.png'), framed('en-lock.png')])
})
