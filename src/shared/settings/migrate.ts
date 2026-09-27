import { SETTINGS_VERSION, type Settings, settingsSchema } from './schema'

/** Upgrades raw settings from version N to N + 1. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * Registry of migrations keyed by the version they upgrade *from*. Version 1 is
 * the first released schema, so the registry starts empty; add `1: (raw) => …`
 * together with bumping SETTINGS_VERSION when the schema changes.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {}

export type MigrationStatus = 'ok' | 'migrated' | 'reset' | 'newer'

export interface MigrationResult {
  settings: Settings
  /** Version found on disk (null when the file was unusable). */
  from: number | null
  status: MigrationStatus
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Brings settings read from disk to the current schema: runs every migration
 * from the stored version upward, then validates. Unknown or invalid fields
 * fall back to their defaults instead of failing the whole file.
 */
export function migrateSettings(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  current: number = SETTINGS_VERSION
): MigrationResult {
  if (!isRecord(raw)) {
    return { settings: settingsSchema.parse({}), from: null, status: 'reset' }
  }
  const from =
    typeof raw['version'] === 'number' && Number.isInteger(raw['version']) ? raw['version'] : 0

  if (from > current) {
    // Written by a newer build: keep everything we understand.
    return { settings: { ...settingsSchema.parse(raw), version: current }, from, status: 'newer' }
  }

  let data: Record<string, unknown> = { ...raw }
  for (let v = from; v < current; v++) {
    const step = migrations[v]
    if (step) data = step(data)
  }
  const settings = { ...settingsSchema.parse(data), version: current }
  return { settings, from, status: from === current ? 'ok' : 'migrated' }
}
