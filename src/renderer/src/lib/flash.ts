import { useCallback, useEffect, useRef, useState } from 'react'

export interface Flash {
  text: string
  tone: 'ok' | 'info'
  /** Changes on every call, so the same message twice still replays. */
  key: number
}

/** A short confirmation ("تمت إضافة YouTube") that clears itself after a few seconds. */
export function useFlash(ms = 2800): [Flash | null, (text: string, tone?: Flash['tone']) => void] {
  const [flash, setFlash] = useState<Flash | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  const show = useCallback(
    (text: string, tone: Flash['tone'] = 'ok') => {
      setFlash({ text, tone, key: Date.now() })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setFlash(null), ms)
    },
    [ms]
  )
  return [flash, show]
}
