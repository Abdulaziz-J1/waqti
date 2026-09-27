import { motion } from 'motion/react'
import type { CategoryTotal } from '@shared/tracking/aggregate'
import { useFmt } from '../lib/fmt'
import { useCatColor } from '../lib/tone'
import { spring } from '../motion'
import s from './CategoryBar.module.css'

/** A stacked bar that fills from the right (RTL) plus a legend with durations. */
export function CategoryBar({ totals }: { totals: CategoryTotal[] }): React.JSX.Element {
  const fmt = useFmt()
  const color = useCatColor()
  const sum = totals.reduce((a, c) => a + c.ms, 0)
  const shown = totals.filter((c) => c.ms > 0)
  return (
    <div className={s.root}>
      <div className={s.bar} aria-hidden>
        {shown.map((c, i) => (
          <motion.span
            key={c.categoryId}
            className={s.part}
            style={{ flexGrow: c.ms, background: color(c.color) }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...spring.gentle, delay: 0.1 + i * 0.06 }}
          />
        ))}
      </div>
      <ul className={s.legend}>
        {totals.map((c) => (
          <li key={c.categoryId} className={s.item} data-empty={c.ms === 0 || undefined}>
            <span className={s.dot} style={{ background: color(c.color) }} />
            <span className={s.name}>{c.name}</span>
            <span className={`${s.value} num`}>{fmt.dur(c.ms)}</span>
            <span className={`${s.pct} num`}>{sum > 0 ? fmt.pct(c.ms / sum) : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
