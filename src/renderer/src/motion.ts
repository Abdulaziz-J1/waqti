import type { Transition, Variants } from 'motion/react'

/** Motion tokens. All motion in the app comes from here. */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 1 },
  gentle: { type: 'spring', stiffness: 240, damping: 28, mass: 1 },
  slow: { type: 'spring', stiffness: 120, damping: 22, mass: 1 }
} as const satisfies Record<string, Transition>

export const duration = {
  fast: 0.14,
  base: 0.22,
  page: 0.24,
  slow: 0.6,
  lockFade: 0.8,
  breathe: 4
} as const

export const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1]
} as const

/** +1 when the reading end is to the right (English), −1 when it is to the left (Arabic). */
export const endSide = (): number => (document.documentElement.dir === 'rtl' ? -1 : 1)

/**
 * Page transition: short crossfade with an 8 px slide. "Forward" (moving
 * down the sidebar) enters from the reading end: the left in Arabic, the
 * right in English.
 */
export const pageVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: (dir >= 0 ? 8 : -8) * endSide() }),
  center: { opacity: 1, x: 0, transition: { duration: duration.page, ease: ease.out } },
  exit: (dir: number) => ({
    opacity: 0,
    x: (dir >= 0 ? -8 : 8) * endSide(),
    transition: { duration: duration.fast, ease: ease.inOut }
  })
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }
}

/** Staggered children for lists and grids. */
export const stagger = (step = 0.04, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } }
})
