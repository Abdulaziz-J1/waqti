import { createContext, useCallback, useContext } from 'react'
import { toneColor } from '@shared/palette'
import type { Tone } from '@shared/sky'

/** The current UI tone (light/dark), provided by App from the sky theme. */
export const ToneContext = createContext<Tone>('light')

export function useTone(): Tone {
  return useContext(ToneContext)
}

/** Maps a stored category colour to the validated step for the current tone. */
export function useCatColor(): (hex: string) => string {
  const tone = useTone()
  return useCallback((hex: string) => toneColor(hex, tone), [tone])
}
