/**
 * Categorical chart palette (validated with the dataviz six-checks script on
 * the light panel surface #F7FAFC and the dark surface #16213F). Slots are
 * assigned in fixed order and never cycled: 1–4 are the built-in categories,
 * 5–8 are offered for user categories. Each slot has its own dark-mode step.
 */
export interface PaletteSlot {
  light: string
  dark: string
}

export const CATEGORY_SLOTS: readonly PaletteSlot[] = [
  { light: '#2A78D6', dark: '#3987E5' }, // 1 blue   → دراسة وعمل
  { light: '#1BAF7A', dark: '#199E70' }, // 2 aqua   → تواصل
  { light: '#EB6834', dark: '#D95926' }, // 3 orange → ترفيه
  { light: '#4A3AA7', dark: '#9085E9' }, // 4 violet → أخرى
  { light: '#E87BA4', dark: '#D55181' }, // 5 magenta
  { light: '#EDA100', dark: '#C98500' }, // 6 yellow
  { light: '#008300', dark: '#008300' }, // 7 green
  { light: '#E34948', dark: '#E66767' } // 8 red
]

/** Stored category colours are the light steps; this returns the step for the current tone. */
export function toneColor(hex: string, tone: 'light' | 'dark'): string {
  const h = hex.toUpperCase()
  const slot = CATEGORY_SLOTS.find((s) => s.light === h || s.dark === h)
  if (!slot) return hex
  return tone === 'dark' ? slot.dark : slot.light
}
