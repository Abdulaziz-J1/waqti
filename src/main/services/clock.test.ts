import { afterEach, describe, expect, it, vi } from 'vitest'
import { Clock } from './clock'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scheduler clock', () => {
  it('applies the debug offset', () => {
    const c = new Clock()
    const before = c.now()
    c.setOffset(60_000)
    expect(c.now() - before).toBeGreaterThanOrEqual(60_000)
  })

  it('reports no jump when wall and monotonic time move together', () => {
    const c = new Clock()
    expect(c.takeJump()).toBe(0)
  })

  it('detects a manual clock change', () => {
    const c = new Clock()
    const wall = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(wall + 3 * 3600_000)
    expect(c.takeJump()).toBeGreaterThan(3 * 3600_000 - 5000)
    // The next reading is relative to the new time.
    expect(c.takeJump()).toBe(0)
  })

  it('detects the clock moving backwards and resyncs after sleep', () => {
    const c = new Clock()
    const wall = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(wall - 3600_000)
    expect(c.takeJump()).toBeLessThan(-3600_000 + 5000)
    c.resync()
    expect(c.takeJump()).toBe(0)
  })

  it('reports an unchanged timezone', () => {
    const c = new Clock()
    expect(c.timezoneChanged()).toBe(false)
  })
})
