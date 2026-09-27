import fs from 'node:fs'
import path from 'node:path'
import { Notification } from 'electron'
import type { RenderedToast } from '../../shared/machine/toasts'
import { log } from './logger'

/**
 * Windows toasts. Notifications are kept referenced until closed so their
 * click handlers are not garbage-collected (a known Electron pitfall).
 */
export class Notifier {
  private live = new Set<Notification>()
  private icon: string | undefined

  constructor(resourcesDir: string) {
    const icon = path.join(resourcesDir, 'icon.png')
    this.icon = fs.existsSync(icon) ? icon : undefined
  }

  show(toast: Pick<RenderedToast, 'title' | 'body'>, onClick?: () => void): void {
    if (!Notification.isSupported()) {
      log.warn('notifications not supported on this system')
      return
    }
    try {
      const n = new Notification({
        title: toast.title,
        body: toast.body,
        icon: this.icon,
        silent: false,
        timeoutType: 'default'
      })
      this.live.add(n)
      const release = (): void => {
        this.live.delete(n)
      }
      n.on('click', () => {
        release()
        onClick?.()
      })
      n.on('close', release)
      n.on('failed', (_e, err) => {
        release()
        log.warn('notification failed', err)
      })
      n.show()
      // Safety net so references never pile up.
      setTimeout(release, 10 * 60_000).unref()
    } catch (err) {
      log.error('notification error', err)
    }
  }
}
