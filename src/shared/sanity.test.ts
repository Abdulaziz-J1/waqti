import { describe, expect, it } from 'vitest'

describe('test setup', () => {
  it('pins the timezone to Riyadh', () => {
    expect(new Date(Date.UTC(2026, 0, 1, 0, 0)).getHours()).toBe(3)
  })
})
