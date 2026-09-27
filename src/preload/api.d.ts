import type { WaqtiApi } from '../shared/ipc'

declare global {
  interface Window {
    waqti: WaqtiApi
  }
}

export {}
