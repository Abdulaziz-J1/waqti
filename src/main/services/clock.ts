/**
 * The scheduler clock. `now()` is wall time plus the debug offset. It also
 * detects wall-clock jumps (manual time change) by comparing wall time with a
 * monotonic clock, and timezone changes.
 */
export class Clock {
  offsetMs = 0
  private lastWall = Date.now()
  private lastMono = performance.now()
  private tzOffset = new Date().getTimezoneOffset()
  private tzName = Intl.DateTimeFormat().resolvedOptions().timeZone

  now(): number {
    return Date.now() + this.offsetMs
  }

  setOffset(ms: number): void {
    this.offsetMs = ms
  }

  /** Wall-clock jump since the last call, in ms (0 when the clock ran normally). */
  takeJump(): number {
    const wall = Date.now()
    const mono = performance.now()
    const jump = wall - this.lastWall - (mono - this.lastMono)
    this.lastWall = wall
    this.lastMono = mono
    return Math.abs(jump) > 30_000 ? jump : 0
  }

  /** Resets jump tracking (after sleep, where the monotonic clock may pause). */
  resync(): void {
    this.lastWall = Date.now()
    this.lastMono = performance.now()
  }

  /**
   * Asks V8/ICU to re-read the host timezone and reports whether it changed.
   * Deleting TZ from process.env makes Node notify V8 to redetect it.
   */
  timezoneChanged(): boolean {
    if (process.env['TZ'] === undefined) {
      delete process.env['TZ']
    }
    const offset = new Date().getTimezoneOffset()
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone
    const changed = offset !== this.tzOffset || name !== this.tzName
    this.tzOffset = offset
    this.tzName = name
    return changed
  }
}
