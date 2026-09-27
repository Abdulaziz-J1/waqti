import { powerMonitor } from 'electron'

/** System idle time and screen-lock state, with debug overrides. */
export class IdleService {
  private locked = false
  simulateIdle = false

  constructor() {
    powerMonitor.on('lock-screen', () => {
      this.locked = true
    })
    powerMonitor.on('unlock-screen', () => {
      this.locked = false
    })
  }

  idleSeconds(): number {
    if (this.simulateIdle) return 3600
    try {
      return powerMonitor.getSystemIdleTime()
    } catch {
      return 0
    }
  }

  screenLocked(): boolean {
    if (this.locked) return true
    try {
      return powerMonitor.getSystemIdleState(1) === 'locked'
    } catch {
      return false
    }
  }
}
