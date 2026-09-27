import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { CHANNELS, EVENTS } from '../shared/ipc-channels'

const allowedChannels = new Set<string>(CHANNELS)
const allowedEvents = new Set<string>(EVENTS)

/**
 * Minimal, typed bridge. Only whitelisted channels pass; every payload is
 * validated again with zod in the main process.
 */
const api = {
  invoke(channel: string, payload?: unknown): Promise<unknown> {
    if (!allowedChannels.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, payload)
  },
  on(event: string, cb: (payload: unknown) => void): () => void {
    if (!allowedEvents.has(event)) throw new Error(`Blocked IPC event: ${event}`)
    const listener = (_e: IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on(event, listener)
    return () => {
      ipcRenderer.removeListener(event, listener)
    }
  }
}

contextBridge.exposeInMainWorld('waqti', api)
