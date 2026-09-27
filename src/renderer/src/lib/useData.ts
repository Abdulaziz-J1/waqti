import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from './api'
import { isVisible, onVisibilityChange } from './visibility'

export interface DataState<T> {
  data: T | null
  error: boolean
  loading: boolean
  reload: () => void
}

/**
 * Loads data over IPC and keeps it fresh: reloads when main says data changed,
 * every `refreshMs` while visible, and when the window becomes visible again.
 */
export function useData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  refreshMs: number | null = null
): DataState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const fetchRef = useRef(fetcher)
  useLayoutEffect(() => {
    fetchRef.current = fetcher
  })

  const load = useCallback(() => {
    // Keeps showing the previous data until the new data arrives (no flicker).
    const id = ++seq.current
    fetchRef
      .current()
      .then((d) => {
        if (id !== seq.current) return
        setData(d)
        setError(false)
      })
      .catch(() => {
        if (id === seq.current) setError(true)
      })
      .finally(() => {
        if (id === seq.current) setLoading(false)
      })
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, deps)

  useEffect(() => {
    const offChanged = api.on('data:changed', load)
    const offVis = onVisibilityChange(() => {
      if (isVisible()) load()
    })
    let timer: ReturnType<typeof setInterval> | null = null
    if (refreshMs) {
      timer = setInterval(() => {
        if (isVisible()) load()
      }, refreshMs)
    }
    return () => {
      offChanged()
      offVis()
      if (timer) clearInterval(timer)
    }
  }, [load, refreshMs])

  return { data, error, loading, reload: load }
}
