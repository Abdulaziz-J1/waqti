import { useEffect, useRef, useSyncExternalStore } from 'react'
import { PALETTES, type PeriodId, type Tone, skyAt } from '@shared/sky'
import { useNow } from './now'
import { useSnapshot } from './store'

export interface SkyInfo {
  period: PeriodId
  tone: Tone
}

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)')

function subscribeReduced(cb: () => void): () => void {
  prefersReduced.addEventListener('change', cb)
  return () => prefersReduced.removeEventListener('change', cb)
}

/** OS reduced-motion preference or the in-app تقليل الحركة setting. */
export function useReducedMotion(): boolean {
  const os = useSyncExternalStore(subscribeReduced, () => prefersReduced.matches)
  const app = useSnapshot().settings.appearance.reduceMotion
  return os || app
}

/**
 * Drives the "سماء اليوم" theme: writes the blended sky colours to CSS
 * variables every 30 s (they cross-fade through registered @property
 * transitions) and sets the light/dark tone the surfaces use.
 */
export function useSkyTheme(): SkyInfo {
  const snap = useSnapshot()
  const theme = snap.settings.appearance.theme
  const reduced = useReducedMotion()
  const now = useNow(30_000)
  const first = useRef(true)
  const lastTheme = useRef(theme)

  const today = snap.schedule?.today ?? null
  const sky = today ? skyAt(today, now) : { period: 'day' as PeriodId, colors: PALETTES.day }
  const tone: Tone = theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : sky.colors.tone

  useEffect(() => {
    const root = document.documentElement
    root.dataset['theme'] = theme
    root.dataset['tone'] = tone
    root.dataset['period'] = sky.period
    root.toggleAttribute('data-reduce-motion', reduced)
    const fast = first.current || lastTheme.current !== theme
    first.current = false
    lastTheme.current = theme
    const dur = reduced || fast ? '1.2s' : 'var(--dur-sky)'
    root.style.transition = `--sky-top ${dur} linear, --sky-mid ${dur} linear, --sky-horizon ${dur} linear`
    if (theme === 'sky') {
      root.style.setProperty('--sky-top', sky.colors.top)
      root.style.setProperty('--sky-mid', sky.colors.mid)
      root.style.setProperty('--sky-horizon', sky.colors.horizon)
    } else {
      root.style.removeProperty('--sky-top')
      root.style.removeProperty('--sky-mid')
      root.style.removeProperty('--sky-horizon')
    }
  }, [theme, tone, reduced, sky.period, sky.colors.top, sky.colors.mid, sky.colors.horizon])

  return { period: sky.period, tone }
}
