import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import type { OverlayState } from '@shared/ipc'
import { api } from '../lib/api'
import { FocusGuard } from './FocusGuard'
import { LockOverlay } from './LockOverlay'

/** Root of lock and guard windows. State is pushed by the main process. */
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
    root.toggleAttribute('data-reduce-motion', state.reduceMotion)
    if (state.kind === 'guard') {
      root.style.background = 'transparent'
      document.body.style.background = 'transparent'
    }
  }, [state])

  if (!state || state.kind === 'none') return null
  return (
    <MotionConfig reducedMotion={state.reduceMotion ? 'always' : 'never'}>
      {state.kind === 'lock' ? <LockOverlay state={state} /> : <FocusGuard state={state} />}
    </MotionConfig>
  )
}
