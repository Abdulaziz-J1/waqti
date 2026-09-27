/**
 * The one orchestrated entrance animation plays when onboarding finishes and
 * the Today screen appears for the first time.
 */
let pending = false

export function requestEntrance(): void {
  pending = true
}

export function takeEntrance(): boolean {
  const v = pending
  pending = false
  return v
}
