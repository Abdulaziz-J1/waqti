import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import type { OverlayState } from '@shared/ipc'
import { api } from '../lib/api'
import { AdhanNotice } from './AdhanNotice'
import { FocusGuard } from './FocusGuard'
import { LockOverlay } from './LockOverlay'

/** Root of lock, guard and adhan-notice windows. State is pushed by the main process. */
export function OverlayApp(): React.JSX.Element | null {
  const [state, setState] = useState<OverlayState | null>(null)

  useEffect(() => {
    const off = api.on('overlay:state', setState)
    void api.invoke('overlay:state').then(setState)
    return off
  }, [])

  useEffect(() => {
    if (!state) return
    const root = document.documentElement
    root.dataset['tone'] = 'dark'
    root.dataset['tint'] = state.tint
    root.toggleAttribute('data-reduce-motion', state.reduceMotion)
    if (state.kind === 'guard' || state.kind === 'adhan') {
      root.style.background = 'transparent'
      document.body.style.background = 'transparent'
    }
  }, [state])

  if (!state || state.kind === 'none') return null
  return (
    <MotionConfig reducedMotion={state.reduceMotion ? 'always' : 'never'}>
      {state.kind === 'lock' ? (
        <LockOverlay state={state} />
      ) : state.kind === 'guard' ? (
        <FocusGuard state={state} />
      ) : (
        <AdhanNotice state={state} />
      )}
    </MotionConfig>
  )
}
