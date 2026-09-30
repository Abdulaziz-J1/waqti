import { motion } from 'motion/react'
import s from './charts.module.css'
import { dirOf, lang } from '@shared/strings'

interface ChartTooltipProps {
  title: string
  total?: string
  rows: Array<{ color: string; name: string; value: string }>
}

/** Shared tooltip card: fades and slides in; text stays in ink colours. */
export function ChartTooltip({ title, total, rows }: ChartTooltipProps): React.JSX.Element {
  return (
    <motion.div
      className={s.tip}
      dir={dirOf(lang)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
    >
      <div className={s.tipHead}>
        <span className={s.tipTitle}>{title}</span>
        {total ? <span className={`${s.tipTotal} num`}>{total}</span> : null}
      </div>
      {rows.length ? (
        <ul className={s.tipRows}>
          {rows.map((r) => (
            <li key={r.name} className={s.tipRow}>
              <span className={s.swatch} style={{ background: r.color }} />
              <span className={s.tipName}>
                <bdi>{r.name}</bdi>
              </span>
              <span className={`${s.tipValue} num`}>{r.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </motion.div>
  )
}
