import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('waqti', { version: 1 })
