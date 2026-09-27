import { useSyncExternalStore } from 'react'
import { api } from './api'

/**
 * Whether the window is visible. Combines `document.visibilityState` with the
 * main process's show/hide/minimize events (tray). When hidden, CSS animations
 * pause (`data-paused` on <html>) and timers/rAF loops stop.
 */
let mainVisible = true
const listeners = new Set<() => void>()

function compute(): boolean {
  return document.visibilityState === 'visible' && mainVisible
}

let visible = compute()

function update(): void {
  const next = compute()
  if (next === visible) return
  visible = next
  document.documentElement.toggleAttribute('data-paused', !visible)
  for (const l of listeners) l()
}

document.addEventListener('visibilitychange', update)
api.on('window:visibility', ({ visible: v }) => {
  mainVisible = v
  update()
})

export function isVisible(): boolean {
  return visible
}

export function onVisibilityChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useVisible(): boolean {
  return useSyncExternalStore(onVisibilityChange, isVisible)
}
