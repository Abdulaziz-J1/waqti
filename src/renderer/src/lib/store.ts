import { useSyncExternalStore } from 'react'
import type { AppSnapshot } from '@shared/ipc'
import type { Settings, SettingsPatch } from '@shared/settings/schema'
import { api } from './api'

let snapshot: AppSnapshot | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

/** Loads the first snapshot and subscribes to updates from main. */
export async function initStore(): Promise<AppSnapshot> {
  api.on('app:snapshot', (s) => {
    snapshot = s
    emit()
  })
  snapshot = await api.invoke('app:snapshot')
  emit()
  return snapshot
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getSnapshot(): AppSnapshot {
  if (!snapshot) throw new Error('store not initialised')
  return snapshot
}

export function useSnapshot(): AppSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function useSettings(): Settings {
  return useSnapshot().settings
}

function merge<T>(a: T, b: unknown): T {
  if (
    typeof a !== 'object' ||
    a === null ||
    Array.isArray(a) ||
    typeof b !== 'object' ||
    b === null ||
    Array.isArray(b)
  ) {
    return (b === undefined ? a : b) as T
  }
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) }
  for (const [k, v] of Object.entries(b)) {
    out[k] = k === 'location' ? v : merge((a as Record<string, unknown>)[k], v)
  }
  return out as T
}

/** Applies a settings change optimistically, then takes main's validated result. */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  if (snapshot) {
    snapshot = { ...snapshot, settings: merge(snapshot.settings, patch) }
    emit()
  }
  const next = await api.invoke('settings:update', patch as Record<string, unknown>)
  if (snapshot) {
    snapshot = { ...snapshot, settings: next }
    emit()
  }
  return next
}
