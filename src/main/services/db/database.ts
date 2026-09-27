import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

export type DB = Database.Database

/** Schema migrations, applied in order; index + 1 = PRAGMA user_version. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE apps (
    id INTEGER PRIMARY KEY,
    process TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    exe_path TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE intervals (
    id INTEGER PRIMARY KEY,
    app_id INTEGER NOT NULL REFERENCES apps(id),
    site TEXT,
    title TEXT,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    day TEXT NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_intervals_day ON intervals(day, app_id, site);
  CREATE INDEX idx_intervals_start ON intervals(start_ms);
  CREATE UNIQUE INDEX idx_intervals_app_start ON intervals(app_id, start_ms);

  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE rules (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('app', 'site', 'path')),
    pattern TEXT NOT NULL,
    category_id TEXT NOT NULL,
    UNIQUE (kind, pattern)
  );

  CREATE TABLE focus_sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    planned_ms INTEGER NOT NULL,
    focused_ms INTEGER NOT NULL,
    blocked INTEGER NOT NULL,
    snoozed INTEGER NOT NULL,
    completed INTEGER NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_focus_started ON focus_sessions(started_at);

  CREATE TABLE distractions (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    at_ms INTEGER NOT NULL,
    label TEXT NOT NULL,
    process TEXT NOT NULL,
    site TEXT,
    action TEXT NOT NULL CHECK (action IN ('back', 'snooze')),
    demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_distractions_at ON distractions(at_ms);

  CREATE TABLE prayer_log (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    prayer TEXT NOT NULL,
    scheduled_at INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    reason TEXT,
    snoozed INTEGER NOT NULL,
    at_ms INTEGER NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0,
    UNIQUE (day, prayer)
  );
  `
]

export const SCHEMA_VERSION = MIGRATIONS.length

export function applyPragmas(db: DB): void {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('temp_store = MEMORY')
  db.pragma('cache_size = -8000')
}

export function migrate(db: DB): void {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!)
      db.pragma(`user_version = ${v + 1}`)
    })()
  }
}

/** `PRAGMA quick_check` → true when the file is healthy. */
export function isHealthy(db: DB): boolean {
  const rows = db.pragma('quick_check') as Array<{ quick_check: string }>
  return rows.length === 1 && rows[0]!.quick_check === 'ok'
}

export function openDatabase(file: string): DB {
  const db = new Database(file)
  try {
    applyPragmas(db)
    if (!isHealthy(db)) throw new Error('Database failed integrity check')
    migrate(db)
    return db
  } catch (err) {
    // Release the file handle so a corrupt file can be moved aside on Windows.
    db.close()
    throw err
  }
}

export type OpenStatus = 'ok' | 'restored' | 'reset'

export interface OpenResult {
  db: DB
  status: OpenStatus
  /** Where the damaged file was moved, when it was. */
  quarantined: string | null
}

function listBackups(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => /^waqti-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .reverse()
    .map((f) => path.join(dir, f))
}

function moveAside(file: string, stamp: string): string | null {
  if (!fs.existsSync(file)) return null
  const target = file.replace(/\.db$/, `.corrupt-${stamp}.db`)
  fs.renameSync(file, target)
  for (const ext of ['-wal', '-shm']) {
    if (fs.existsSync(file + ext)) fs.renameSync(file + ext, target + ext)
  }
  return target
}

/**
 * Opens the database, checking integrity. A corrupt file is moved aside and
 * the newest healthy backup is restored; with no usable backup a fresh
 * database is created. The user is told which happened.
 */
export function openWithRecovery(file: string, backupDir: string, now = Date.now()): OpenResult {
  try {
    return { db: openDatabase(file), status: 'ok', quarantined: null }
  } catch {
    const quarantined = moveAside(file, String(now))
    for (const backup of listBackups(backupDir)) {
      try {
        fs.copyFileSync(backup, file)
        return { db: openDatabase(file), status: 'restored', quarantined }
      } catch {
        if (fs.existsSync(file)) fs.rmSync(file)
      }
    }
    return { db: openDatabase(file), status: 'reset', quarantined }
  }
}

/** Writes today's backup (once per day) and keeps the newest `keep`. */
export async function dailyBackup(
  db: DB,
  backupDir: string,
  day: string,
  keep = 7
): Promise<string | null> {
  fs.mkdirSync(backupDir, { recursive: true })
  const target = path.join(backupDir, `waqti-${day}.db`)
  if (fs.existsSync(target)) return null
  const tmp = `${target}.tmp`
  await db.backup(tmp)
  fs.renameSync(tmp, target)
  for (const old of listBackups(backupDir).slice(keep)) fs.rmSync(old, { force: true })
  return target
}
