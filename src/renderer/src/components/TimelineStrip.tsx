import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import type { Category } from '@shared/tracking/categorize'
import type { TimelineSegment } from '@shared/tracking/aggregate'
import { useFmt } from '../lib/fmt'
import { useCatColor } from '../lib/tone'
import s from './TimelineStrip.module.css'

interface TimelineStripProps {
  segments: TimelineSegment[]
  categories: Category[]
  dayStart: number
  /** Minutes since midnight of "now" (null for past days). */
  nowMin: number | null
  /** Prayer times as minutes since midnight, drawn as thin ticks. */
  prayerMarks: Array<{ min: number; label: string }>
}

const DAY_MIN = 1440
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

/**
 * The day as a strip where time flows right-to-left (midnight at the right
 * edge). Segments are coloured by category; hovering shows the app and time.
 */
export function TimelineStrip({
  segments,
  categories,
  dayStart,
  nowMin,
  prayerMarks
}: TimelineStripProps): React.JSX.Element {
  const fmt = useFmt()
  const tone = useCatColor()
  const colors = new Map(categories.map((c) => [c.id, tone(c.color)]))
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const [hover, setHover] = useState<number | null>(null)
  const strip = useRef<HTMLDivElement>(null)
  const seg = hover !== null ? segments[hover] : undefined
  const pct = (min: number): string => `${(min / DAY_MIN) * 100}%`

  return (
    <div className={s.root}>
      <div ref={strip} className={s.strip} onMouseLeave={() => setHover(null)}>
        {HOURS.slice(1, -1).map((h) => (
          <span
            key={h}
            className={s.gridline}
            style={{ insetInlineStart: pct(h * 60) }}
            aria-hidden
          />
        ))}
        {segments.map((g, i) => (
          <span
            key={`${g.startMin}-${i}`}
            className={s.segment}
            data-hover={hover === i || undefined}
            style={{
              insetInlineStart: pct(g.startMin),
              inlineSize: `max(2px, ${((g.endMin - g.startMin) / DAY_MIN) * 100}%)`,
              background: colors.get(g.categoryId) ?? 'var(--cat-other)'
            }}
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {prayerMarks.map((p) => (
          <span
            key={p.label}
            className={s.prayer}
            style={{ insetInlineStart: pct(p.min) }}
            title={p.label}
          />
        ))}
        {nowMin !== null ? (
          <span className={s.now} style={{ insetInlineStart: pct(nowMin) }} aria-hidden />
        ) : null}
        <AnimatePresence>
          {seg ? (
            <motion.div
              key={hover}
              className={s.tip}
              style={{ insetInlineStart: pct((seg.startMin + seg.endMin) / 2) }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <span className={s.tipTitle}>
                <span className={s.swatch} style={{ background: colors.get(seg.categoryId) }} />
                <bdi>{seg.label}</bdi>
              </span>
              <span className={s.tipMeta}>
                {names.get(seg.categoryId)} · {fmt.dur(seg.ms)}
              </span>
              <span className={`${s.tipMeta} num`}>
                {fmt.clock(dayStart + seg.startMin * 60_000)} –{' '}
                {fmt.clock(dayStart + seg.endMin * 60_000)}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className={s.axis} aria-hidden>
        {HOURS.map((h) => (
          <span key={h} className={`${s.hour} num`} style={{ insetInlineStart: pct(h * 60) }}>
            {fmt.hour(h)}
          </span>
        ))}
      </div>
    </div>
  )
}
