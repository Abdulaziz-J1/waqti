import { motion } from 'motion/react'
import type { ScheduleBundle } from '@shared/ipc'
import { prayerLabel } from '@shared/machine/toasts'
import { nextEvent } from '@shared/prayer/schedule'
import { today as t } from '@shared/strings'
import { useFmt } from '../lib/fmt'
import { useNow } from '../lib/now'
import { Odometer } from './Odometer'
import s from './NextPrayerCountdown.module.css'

interface Props {
  bundle: ScheduleBundle
  entrance: boolean
}

/**
 * The next prayer and its rolling countdown. It is the only part of Today that
 * re-renders every second, so the rest of the page repaints once a minute.
 */
export function NextPrayerCountdown({ bundle, entrance }: Props): React.JSX.Element | null {
  const fmt = useFmt()
  const now = useNow(1000)
  const next = nextEvent([bundle.yesterday, bundle.today, bundle.tomorrow], now, true)
  if (!next || next.slot === 'sunrise') return null
  const name = prayerLabel({ prayer: next.slot, isJumuah: next.isJumuah })
  const left = next.at - now
  return (
    <motion.div
      className={s.countdown}
      initial={entrance ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: entrance ? 1.5 : 0, duration: 0.5 }}
    >
      <span className={s.label}>
        {t.prayerOf(name)} {t.inPrefix}
      </span>
      <Odometer
        value={fmt.countdown(left)}
        className={s.odometer}
        label={`${t.prayerOf(name)} ${t.inPrefix} ${fmt.dur(left, { round: 'ceil', gramCase: 'obl' })}`}
      />
      <span className={`${s.at} num`}>{fmt.clock(next.at)}</span>
    </motion.div>
  )
}
