import path from 'node:path'
import { utilityProcess } from 'electron'
import {
  type MediaReply,
  type MediaRequest,
  type MediaSessionInfo,
  anyPlaying
} from '../../shared/media'
import { log } from './logger'

/** Longest a media helper may run before it is stopped. */
const TIMEOUT_MS = 15_000

/**
 * Pauses whatever is playing when a lock starts (see shared/media.ts). Each
 * request runs in its own short-lived utility process (media-helper.ts), so
 * the lock never waits for it and a failure there cannot affect the app.
 * Isolated test profiles leave the user's real media alone, unless
 * WAQTI_MEDIA_PAUSE_APP names the one app a test may pause (its own player).
 */
export class MediaService {
  private busy = false

  pausePlaying(): void {
    if (process.platform !== 'win32' || this.busy) return
    const onlyAppId = process.env['WAQTI_MEDIA_PAUSE_APP'] ?? ''
    if (process.env['WAQTI_USER_DATA'] && !onlyAppId) return
    this.busy = true
    void this.ask({ kind: 'pause', onlyAppId }).then((reply) => {
      this.busy = false
      if (reply.kind === 'paused') {
        log.info(
          reply.appIds.length > 0
            ? `media paused: ${reply.appIds.join(', ')}`
            : 'media: nothing playing'
        )
      } else if (reply.kind === 'error') {
        log.warn(`media pause failed: ${reply.message}`)
      }
    })
  }

  /**
   * Whether something is playing right now (someone watching counts as
   * present); false when it cannot tell. Test profiles only look at
   * WAQTI_MEDIA_PAUSE_APP, never at the real machine's media.
   */
  async anyPlaying(): Promise<boolean> {
    const onlyAppId = process.env['WAQTI_MEDIA_PAUSE_APP'] ?? ''
    if (process.env['WAQTI_USER_DATA'] && !onlyAppId) return false
    try {
      return anyPlaying(await this.sessions(), onlyAppId)
    } catch (err) {
      log.warn('media check failed', err)
      return false
    }
  }

  /** Read-only: the sessions Windows lists right now (debug panel, E2E). */
  async sessions(): Promise<MediaSessionInfo[]> {
    if (process.platform !== 'win32') return []
    const reply = await this.ask({ kind: 'list' })
    if (reply.kind === 'error') throw new Error(reply.message)
    return reply.kind === 'sessions' ? reply.sessions : []
  }

  private ask(req: MediaRequest): Promise<MediaReply> {
    return new Promise((resolve) => {
      const child = utilityProcess.fork(path.join(__dirname, 'media-helper.js'), [], {
        serviceName: 'Waqti media'
      })
      let settled = false
      const finish = (reply: MediaReply): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        child.kill()
        resolve(reply)
      }
      const timer = setTimeout(
        () => finish({ kind: 'error', message: 'media helper timed out' }),
        TIMEOUT_MS
      )
      child.once('spawn', () => child.postMessage(req))
      child.on('message', (reply: MediaReply) => finish(reply))
      child.on('exit', (code) =>
        finish({ kind: 'error', message: `media helper exited (${code})` })
      )
    })
  }
}
