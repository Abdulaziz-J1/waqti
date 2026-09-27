import fs from 'node:fs'
import path from 'node:path'

const MAX_BYTES = 5 * 1024 * 1024

type Level = 'info' | 'warn' | 'error'

/**
 * Small rotating file logger: `waqti.log` rolls over to `waqti.1.log` at
 * ~5 MB, so logs never take more than ~10 MB. Never logs window titles.
 */
class Logger {
  private file: string | null = null
  private size = 0

  init(dir: string): void {
    fs.mkdirSync(dir, { recursive: true })
    this.file = path.join(dir, 'waqti.log')
    this.size = fs.existsSync(this.file) ? fs.statSync(this.file).size : 0
  }

  get path(): string | null {
    return this.file
  }

  private write(level: Level, msg: string, extra?: unknown): void {
    const detail =
      extra instanceof Error
        ? ` ${extra.stack ?? extra.message}`
        : extra === undefined
          ? ''
          : ` ${safeJson(extra)}`
    const line = `${new Date().toISOString()} [${level}] ${msg}${detail}\n`
    if (level !== 'info') console.error(line.trimEnd())
    if (!this.file) return
    try {
      if (this.size + line.length > MAX_BYTES) this.rotate()
      fs.appendFileSync(this.file, line)
      this.size += Buffer.byteLength(line)
    } catch {
      // Logging must never crash the app.
    }
  }

  private rotate(): void {
    if (!this.file) return
    const old = this.file.replace(/\.log$/, '.1.log')
    try {
      fs.rmSync(old, { force: true })
      fs.renameSync(this.file, old)
    } catch {
      // ignore
    }
    this.size = 0
  }

  info(msg: string, extra?: unknown): void {
    this.write('info', msg, extra)
  }
  warn(msg: string, extra?: unknown): void {
    this.write('warn', msg, extra)
  }
  error(msg: string, extra?: unknown): void {
    this.write('error', msg, extra)
  }
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export const log = new Logger()
