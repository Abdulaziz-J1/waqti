import { describe, expect, it } from 'vitest'
import { CATEGORY_SLOTS, toneColor } from './palette'
import { BUILTIN_CATEGORIES, CUSTOM_CATEGORY_COLORS } from './tracking/categorize'

describe('category palette', () => {
  it('has eight fixed slots with a dark step each', () => {
    expect(CATEGORY_SLOTS).toHaveLength(8)
    expect(new Set(CATEGORY_SLOTS.map((s) => s.light)).size).toBe(8)
  })

  it('maps stored light colours to the tone step', () => {
    expect(toneColor('#2a78d6', 'dark')).toBe('#3987E5')
    expect(toneColor('#3987E5', 'light')).toBe('#2A78D6')
    expect(toneColor('#123456', 'dark')).toBe('#123456')
  })

  it('uses slots 1–4 for built-ins and 5–8 for custom categories', () => {
    expect(BUILTIN_CATEGORIES.map((c) => c.color)).toEqual(
      CATEGORY_SLOTS.slice(0, 4).map((s) => s.light)
    )
    expect(CUSTOM_CATEGORY_COLORS).toEqual(CATEGORY_SLOTS.slice(4).map((s) => s.light))
  })
})
