// Performance audit on the production build (run `npm run build` first).
// Launches Electron directly (no test harness) with an isolated data folder
// and WAQTI_PERF_LOG, then reports:
//   - cold start to interactive (first data render, measured in main)
//   - memory with the window open on Today (working set and private bytes)
//   - CPU and memory while running hidden in the tray
// Usage: node scripts/perf.mjs
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function prepareDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'waqti-perf-'))
  // Skip onboarding so the app opens straight on Today.
  const onboarded = process.env['PERF_ONBOARDING'] !== '1'
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ version: 1, onboarded }))
  return dir
}

function run({ hidden, seconds }) {
  const dir = prepareDataDir()
  const log = path.join(dir, 'perf.jsonl')
  // Extra Chromium switches can be compared: node scripts/perf.mjs -- --disable-gpu
  const args = ['.', ...process.argv.slice(2).filter((a) => a !== '--')]
  if (hidden) args.push('--hidden')
  return new Promise((resolve) => {
    const child = spawn(electronPath, args, {
      cwd: root,
      env: { ...process.env, WAQTI_USER_DATA: dir, WAQTI_PERF_LOG: log },
      stdio: 'ignore'
    })
    setTimeout(() => {
      child.kill()
      setTimeout(() => {
        const lines = fs.existsSync(log)
          ? fs
              .readFileSync(log, 'utf8')
              .trim()
              .split('\n')
              .filter(Boolean)
              .map((l) => JSON.parse(l))
          : []
        const appLog = fs.readFileSync(path.join(dir, 'logs', 'waqti.log'), 'utf8')
        const m = appLog.match(/interactive after (\d+) ms/)
        resolve({ lines, startupMs: m ? Number(m[1]) : null })
      }, 1500)
    }, seconds * 1000)
  })
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d

const quick = process.env['PERF_QUICK'] === '1'
console.log('Cold start + window open (30 s)…')
const visible = await run({ hidden: false, seconds: 30 })
const settled = visible.lines.filter((l) => l.t > 12_000)
if (quick) {
  console.log(JSON.stringify({ startupMs: visible.startupMs, last: settled.at(-1) }))
  process.exit(0)
}
console.log('Hidden in tray (75 s)…')
const hidden = await run({ hidden: true, seconds: 75 })
const hiddenSettled = hidden.lines.filter((l) => l.t > 15_000)

const report = {
  coldStartToInteractiveMs: visible.startupMs,
  windowOpen: {
    workingSetMB: round(avg(settled.map((l) => l.workingSetMB)), 0),
    privateMB: round(avg(settled.map((l) => l.privateMB)), 0),
    cpuMachinePercent: round(avg(settled.map((l) => l.cpuMachine)), 2)
  },
  hiddenInTray: {
    workingSetMB: round(avg(hiddenSettled.map((l) => l.workingSetMB)), 0),
    privateMB: round(avg(hiddenSettled.map((l) => l.privateMB)), 0),
    cpuMachinePercent: round(avg(hiddenSettled.map((l) => l.cpuMachine)), 2),
    cpuPerCorePercent: round(avg(hiddenSettled.map((l) => l.cpuPerCore)), 2)
  },
  processesWindowOpen: settled.at(-1)?.processes ?? null,
  processesHidden: hiddenSettled.at(-1)?.processes ?? null,
  cores: os.cpus().length
}
console.log(JSON.stringify(report, null, 2))
