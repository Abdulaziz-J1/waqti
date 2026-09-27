// Smoke-checks the packaged app (dist/win-unpacked/Waqti.exe) after `npm run dist`:
// it must start, open its database, load the native modules (SQLite, get-windows,
// koffi) and log no errors. Uses a temporary data folder and never touches the
// real %APPDATA%\Waqti. Usage: node scripts/verify-packaged.mjs
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exe = path.join(root, 'dist', 'win-unpacked', 'Waqti.exe')
if (!fs.existsSync(exe)) {
  console.error('Build the installer first: npm run dist')
  process.exit(1)
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-packaged-'))
fs.writeFileSync(
  path.join(dir, 'settings.json'),
  JSON.stringify({ version: 1, onboarded: true, general: { launchAtStartup: false } })
)
const perf = path.join(dir, 'perf.jsonl')

const child = spawn(exe, [], {
  env: { ...process.env, WAQTI_USER_DATA: dir, WAQTI_PERF_LOG: perf },
  stdio: 'ignore'
})

setTimeout(() => {
  child.kill()
  setTimeout(() => {
    const log = fs.readFileSync(path.join(dir, 'logs', 'waqti.log'), 'utf8')
    const metrics = fs.existsSync(perf)
      ? fs.readFileSync(perf, 'utf8').trim().split('\n').at(-1)
      : null
    const checks = {
      started: /started v/.test(log),
      interactive: /interactive after \d+ ms/.test(log),
      provider: (log.match(/foreground provider: (\S+)/) ?? [])[1] ?? null,
      database: fs.existsSync(path.join(dir, 'waqti.db')),
      meetingConfig: fs.existsSync(path.join(dir, 'meeting-apps.json')),
      errors: log.split('\n').filter((l) => l.includes('[error]'))
    }
    console.log(JSON.stringify({ checks, metrics: metrics ? JSON.parse(metrics) : null }, null, 2))
    const ok =
      checks.started &&
      checks.interactive &&
      checks.provider === 'get-windows' &&
      checks.database &&
      !checks.errors.length
    process.exit(ok ? 0 : 1)
  }, 1500)
}, 15_000)
