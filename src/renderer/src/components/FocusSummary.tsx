import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { FocusSessionRecord } from '@shared/tracking/aggregate'
import { focusPage as t } from '@shared/strings'
import { api } from '../lib/api'
import { useFmt } from '../lib/fmt'
import { useReducedMotion } from '../lib/sky'
import { Button } from './Button'
import { CountUp } from './CountUp'
import { Dialog } from './Dialog'
import s from './FocusSummary.module.css'

const MOTES = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 37) % 90) + 5,
  delay: (i * 0.23) % 2.2,
  dur: 3.4 + ((i * 7) % 4) * 0.5,
  size: 4 + ((i * 5) % 4)
}))

/** End-of-session summary with a calm celebration (soft rings and rising light). */
export function FocusSummary(): React.JSX.Element {
  const fmt = useFmt()
  const reduced = useReducedMotion()
  const [record, setRecord] = useState<FocusSessionRecord | null>(null)

  useEffect(() => api.on('focus:summary', setRecord), [])

  return (
    <Dialog
      open={record !== null}
      onClose={() => setRecord(null)}
      title={t.summaryTitle}
      size="sm"
      footer={
        <Button variant="primary" onClick={() => setRecord(null)}>
          {t.summaryClose}
        </Button>
      }
    >
      {record ? (
        <div className={s.body}>
          <div className={s.art} aria-hidden>
            {!reduced
              ? [0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className={s.ring}
                    initial={{ scale: 0.4, opacity: 0.55 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 2.6, delay: i * 0.7, repeat: 2, ease: 'easeOut' }}
                  />
                ))
              : null}
            <span className={s.core} />
            {!reduced
              ? MOTES.map((m, i) => (
                  <motion.span
                    key={i}
                    className={s.mote}
                    style={{ insetInlineStart: `${m.x}%`, inlineSize: m.size, blockSize: m.size }}
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: -90, opacity: [0, 0.9, 0] }}
                    transition={{ duration: m.dur, delay: m.delay, ease: 'easeOut' }}
                  />
                ))
              : null}
          </div>
          <dl className={s.stats}>
            <div className={s.stat}>
              <dt>{t.summaryFocused}</dt>
              <dd>
                <CountUp value={record.focusedMs} format={(v) => fmt.dur(v)} />
              </dd>
            </div>
            <div className={s.stat}>
              <dt>{t.summaryBlocked}</dt>
              <dd>
                <CountUp value={record.blocked} format={(v) => fmt.num(Math.round(v))} />
              </dd>
            </div>
            <div className={s.stat}>
              <dt>{t.summarySnoozed}</dt>
              <dd>
                <CountUp value={record.snoozed} format={(v) => fmt.num(Math.round(v))} />
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </Dialog>
  )
}
