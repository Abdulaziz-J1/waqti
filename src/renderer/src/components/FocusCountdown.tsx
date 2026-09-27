import type { FocusState } from '@shared/machine/types'
import { focusRemaining } from '@shared/machine/machine'
import { useFmt } from '../lib/fmt'
import { useNow } from '../lib/now'
import { Odometer } from './Odometer'

/** Remaining focus time as a rolling countdown; re-renders only itself each second. */
export function FocusCountdown({
  focus,
  className
}: {
  focus: FocusState
  className?: string
}): React.JSX.Element | null {
  const fmt = useFmt()
  const now = useNow(1000)
  const left = focusRemaining(focus, now)
  if (left === null) return null
  return <Odometer value={fmt.countdown(left)} className={className} />
}
