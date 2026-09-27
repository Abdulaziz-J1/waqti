import { useEffect, useState } from 'react'
import { useSnapshot } from './store'
import { isVisible, onVisibilityChange } from './visibility'

/**
 * One shared ticker for every "now"-dependent component. It aligns to whole
 * seconds (so odometer digits change together) and stops while the window is
 * hidden.
 */
type Sub = { every: number; last: number; cb: (t: number) => void }
const subs = new Set<Sub>()
let timer: ReturnType<typeof setTimeout> | null = null

function schedule(): void {
  if (timer || !subs.size || !isVisible()) return
  const delay = 1000 - (Date.now() % 1000) + 5
  timer = setTimeout(() => {
    timer = null
    const t = Date.now()
    for (const s of subs) {
      if (t - s.last >= s.every - 50) {
        s.last = t
        s.cb(t)
      }
    }
    schedule()
  }, delay)
}

onVisibilityChange(() => {
  if (isVisible()) {
    const t = Date.now()
    for (const s of subs) {
      s.last = t
      s.cb(t)
    }
    schedule()
  } else if (timer) {
    clearTimeout(timer)
    timer = null
  }
})

/** Wall-clock ms, re-rendering every `everyMs` while visible. */
export function useWallNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const sub: Sub = { every: everyMs, last: Date.now(), cb: setNow }
    subs.add(sub)
    schedule()
    return () => {
      subs.delete(sub)
    }
  }, [everyMs])
  return now
}

/** Scheduler "now" (wall clock + debug offset from main). */
export function useNow(everyMs = 1000): number {
  const offset = useSnapshot().clockOffsetMs
  return useWallNow(everyMs) + offset
}
