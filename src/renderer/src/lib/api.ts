import type { WaqtiApi } from '@shared/ipc'

/** The typed bridge exposed by the preload. */
export const api: WaqtiApi = window.waqti
