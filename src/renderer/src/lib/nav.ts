import { useSyncExternalStore } from 'react'
import type { Page } from '@shared/ipc'
import { api } from './api'

export const PAGES: Page[] = ['today', 'focus', 'reports', 'prayer', 'settings']

interface NavState {
  page: Page
  /** +1 when moving down the sidebar, −1 when moving up (for direction-aware transitions). */
  dir: number
}

let state: NavState = { page: 'today', dir: 0 }
const listeners = new Set<() => void>()

export function go(page: Page): void {
  if (page === state.page) return
  const dir = Math.sign(PAGES.indexOf(page) - PAGES.indexOf(state.page))
  state = { page, dir }
  for (const l of listeners) l()
}

api.on('nav:go', ({ page }) => go(page))

export function useNav(): NavState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state
  )
}
