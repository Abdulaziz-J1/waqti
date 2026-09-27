import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { ARC, arcMarkers, arcPointAt, dayPath, nightPath } from '@shared/arc'
import type { ScheduleBundle } from '@shared/ipc'
import type { SlotId } from '@shared/prayer/schedule'
import { prayerNames, today as t } from '@shared/strings'
import { useFmt } from '../lib/fmt'
import { spring } from '../motion'
import s from './SkyArc.module.css'

interface SkyArcProps {
  bundle: ScheduleBundle
  now: number
  nextSlot: SlotId | null
  /** Plays the orchestrated entrance (after onboarding). */
  entrance: boolean
}

const H = 300

function slotName(slot: SlotId, isFriday: boolean): string {
  if (slot === 'dhuhr' && isFriday) return prayerNames.jumuah
  return prayerNames[slot]
}

/**
 * The signature element: the day as an arc from sunrise to sunset, the night
 * as a quieter arc beneath the horizon, the sun or moon at the current
 * position, and the prayers as markers. Hovering a marker grows it and shows
 * its time; the next prayer pulses softly.
 */
export function SkyArc({ bundle, now, nextSlot, entrance }: SkyArcProps): React.JSX.Element {
  const fmt = useFmt()
  const [hover, setHover] = useState<SlotId | null>(null)
  const markers = arcMarkers(bundle)
  const body = arcPointAt(bundle, now)
  const isDay = body.phase === 'day'
  const dayProgress = isDay ? body.t : now > bundle.today.sunset ? 1 : 0
  const hovered = markers.find((m) => m.slot === hover) ?? null
  const d = entrance ? 1 : 0

  return (
    <div className={s.wrap} role="img" aria-label={t.arcLabel}>
      <svg className={s.svg} viewBox={`0 0 ${ARC.width} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="arc-sun-glow">
            <stop offset="0" stopColor="#FFE6A8" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#F5C977" stopOpacity="0.45" />
            <stop offset="1" stopColor="#F5C977" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="arc-moon-glow">
            <stop offset="0" stopColor="#F2F5FF" stopOpacity="0.7" />
            <stop offset="0.4" stopColor="#C9D4F5" stopOpacity="0.22" />
            <stop offset="1" stopColor="#C9D4F5" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="arc-progress" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#F5D08A" />
            <stop offset="1" stopColor="#D9B26F" />
          </linearGradient>
        </defs>

        {/* Horizon */}
        <motion.line
          x1={40}
          x2={ARC.width - 40}
          y1={ARC.cy}
          y2={ARC.cy}
          className={s.horizon}
          initial={entrance ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />

        {/* Night arc (below the horizon) */}
        <motion.path
          d={nightPath()}
          className={s.night}
          initial={entrance ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 * d }}
        />

        {/* Day arc: faint full track + bright travelled part */}
        <motion.path
          d={dayPath()}
          className={s.track}
          pathLength={1}
          initial={entrance ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.path
          d={dayPath()}
          className={s.progress}
          stroke="url(#arc-progress)"
          initial={{ pathLength: entrance ? 0 : dayProgress }}
          animate={{ pathLength: dayProgress }}
          transition={
            entrance ? { duration: 1.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] } : spring.slow
          }
        />

        {/* Sun or moon */}
        <motion.g
          initial={
            entrance
              ? { x: body.x, y: ARC.cy + 40, opacity: 0 }
              : { x: body.x, y: body.y, opacity: 1 }
          }
          animate={{ x: body.x, y: body.y, opacity: 1 }}
          transition={entrance ? { ...spring.slow, delay: 0.9 } : spring.slow}
        >
          {isDay ? (
            <>
              <circle r={62} fill="url(#arc-sun-glow)" className="motion-decor" />
              <circle r={17} className={s.sun} />
            </>
          ) : (
            <>
              <circle r={54} fill="url(#arc-moon-glow)" className="motion-decor" />
              <circle r={14} className={s.moon} />
            </>
          )}
        </motion.g>

        {/* Prayer markers */}
        {markers.map((m, i) => {
          const isNext = m.slot === nextSlot
          const isSunrise = m.slot === 'sunrise'
          const label = `${slotName(m.slot, bundle.today.isFriday)} ${fmt.clock(m.at)}`
          return (
            <motion.g
              key={m.slot}
              initial={entrance ? { x: m.x, y: m.y, opacity: 0, scale: 0.4 } : { x: m.x, y: m.y }}
              animate={{ x: m.x, y: m.y, opacity: 1, scale: 1 }}
              transition={{ ...spring.gentle, delay: entrance ? 1.1 + i * 0.08 : 0 }}
            >
              {isNext ? <circle r={15} className={`${s.pulse} motion-decor`} /> : null}
              <motion.g
                animate={{ scale: hover === m.slot ? 1.45 : 1 }}
                transition={spring.snappy}
                className={s.markerHit}
                tabIndex={0}
                role="button"
                aria-label={label}
                onMouseEnter={() => setHover(m.slot)}
                onMouseLeave={() => setHover((h) => (h === m.slot ? null : h))}
                onFocus={() => setHover(m.slot)}
                onBlur={() => setHover((h) => (h === m.slot ? null : h))}
              >
                <circle r={20} className={s.hit} />
                <circle
                  r={isSunrise ? 5 : 7.5}
                  className={isSunrise ? s.markerSunrise : isNext ? s.markerNext : s.marker}
                />
              </motion.g>
            </motion.g>
          )
        })}
      </svg>

      <AnimatePresence>
        {hovered ? (
          <motion.div
            key={hovered.slot}
            className={s.tip}
            style={{
              insetInlineStart: `${100 - (hovered.x / ARC.width) * 100}%`,
              insetBlockStart: `${(hovered.y / H) * 100}%`
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
          >
            <span className={s.tipName}>{slotName(hovered.slot, bundle.today.isFriday)}</span>
            <span className={`${s.tipTime} num`}>{fmt.clock(hovered.at)}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
