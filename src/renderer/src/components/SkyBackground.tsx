import { useEffect, useRef } from 'react'
import { setLantern } from '../lib/pointer'
import { useReducedMotion } from '../lib/sky'
import s from './SkyBackground.module.css'

/** The sky gradient behind the whole app, plus a soft lantern glow that trails the mouse. */
export function SkyBackground({ night }: { night: boolean }): React.JSX.Element {
  const lantern = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    setLantern(reduced ? null : lantern.current, reduced)
    return () => setLantern(null, reduced)
  }, [reduced])

  return (
    <div className={s.sky} aria-hidden>
      {night ? <div className={s.stars} /> : null}
      <div className={s.horizonGlow} />
      {!reduced ? <div ref={lantern} className={`${s.lantern} motion-decor`} /> : null}
    </div>
  )
}
