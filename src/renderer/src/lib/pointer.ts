import { isVisible } from './visibility'

/**
 * Cursor effects without React re-renders:
 * - `[data-glow]` elements get `--mx/--my` (cursor position inside them) so a
 *   pseudo-element highlight can follow the pointer.
 * - The sky's "lantern" glow follows the mouse with spring lag.
 * Everything is written in requestAnimationFrame, at most once per frame, and
 * the lantern loop sleeps when the pointer is still or the window is hidden.
 */
let pending: { el: HTMLElement; x: number; y: number } | null = null
let frame = 0

let lantern: HTMLElement | null = null
let target = { x: 0, y: 0 }
const pos = { x: 0, y: 0 }
const vel = { x: 0, y: 0 }
let lanternFrame = 0
let lastT = 0
let reduced = false

/**
 * The lantern is anchored at the inline start (the right edge in RTL), so its
 * centre sits at x = innerWidth before translation.
 */
function toTransform(x: number, y: number): string {
  const rtl = document.documentElement.dir === 'rtl'
  const dx = rtl ? x - window.innerWidth : x
  return `translate3d(${dx}px, ${y}px, 0)`
}

function writeGlow(): void {
  frame = 0
  if (!pending) return
  const { el, x, y } = pending
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${x - r.left}px`)
  el.style.setProperty('--my', `${y - r.top}px`)
  pending = null
}

function stepLantern(t: number): void {
  lanternFrame = 0
  if (!lantern || !isVisible()) return
  const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016)
  lastT = t
  // Critically-damped-ish spring: the glow trails the cursor softly.
  const k = 38
  const c = 11
  for (const axis of ['x', 'y'] as const) {
    const a = k * (target[axis] - pos[axis]) - c * vel[axis]
    vel[axis] += a * dt
    pos[axis] += vel[axis] * dt
  }
  lantern.style.transform = toTransform(pos.x, pos.y)
  const moving =
    Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) + Math.abs(vel.x) + Math.abs(vel.y) >
    0.5
  if (moving) lanternFrame = requestAnimationFrame(stepLantern)
  else lastT = 0
}

function onMove(e: PointerEvent): void {
  const el = (e.target as Element | null)?.closest<HTMLElement>('[data-glow]')
  if (el) {
    pending = { el, x: e.clientX, y: e.clientY }
    if (!frame) frame = requestAnimationFrame(writeGlow)
  }
  if (lantern && !reduced) {
    target = { x: e.clientX, y: e.clientY }
    if (!lanternFrame) lanternFrame = requestAnimationFrame(stepLantern)
  }
}

let installed = false

export function installPointerEffects(): void {
  if (installed) return
  installed = true
  document.addEventListener('pointermove', onMove, { passive: true })
}

export function setLantern(el: HTMLElement | null, reduceMotion: boolean): void {
  lantern = el
  reduced = reduceMotion
  if (el) {
    const x = window.innerWidth * 0.3
    const y = window.innerHeight * 0.25
    target = { x, y }
    pos.x = x
    pos.y = y
    el.style.transform = toTransform(x, y)
  }
}
