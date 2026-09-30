import { useState } from 'react'
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  type PieSectorShapeProps
} from 'recharts'
import type { CategoryTotal } from '@shared/tracking/aggregate'
import { useFmt } from '../../lib/fmt'
import { useReducedMotion } from '../../lib/sky'
import { useCatColor } from '../../lib/tone'
import { ChartTooltip } from './ChartTooltip'
import s from './charts.module.css'
import { dirOf, lang } from '@shared/strings'

interface DonutProps {
  totals: CategoryTotal[]
  centerLabel: string
}

/**
 * Category share as a donut. The hovered segment grows outward and the rest
 * dim; the total sits in the middle. The legend (names, durations, shares)
 * is always shown next to it so identity never depends on colour alone.
 */
export function Donut({ totals, centerLabel }: DonutProps): React.JSX.Element {
  const fmt = useFmt()
  const color = useCatColor()
  const reduced = useReducedMotion()
  const [active, setActive] = useState<string | null>(null)
  const data = totals
    .filter((t) => t.ms > 0)
    .map((t) => ({ ...t, value: t.ms, fill: color(t.color) }))
  const sum = data.reduce((a, d) => a + d.ms, 0)

  return (
    <div className={s.donutWrap}>
      <div className={s.donut} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              startAngle={90}
              endAngle={450}
              paddingAngle={data.length > 1 ? 1.2 : 0}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={!reduced}
              animationDuration={800}
              animationEasing="ease-out"
              onMouseEnter={(d) => setActive((d as unknown as CategoryTotal).categoryId)}
              onMouseLeave={() => setActive(null)}
              shape={(p: PieSectorShapeProps) => {
                const id = (p.payload as CategoryTotal | undefined)?.categoryId
                const isHover = active !== null && id === active
                const dim = active !== null && !isHover
                return (
                  <Sector
                    {...p}
                    outerRadius={(p.outerRadius ?? 0) + (isHover ? 6 : 0)}
                    fill={p.fill}
                    fillOpacity={dim ? 0.45 : 1}
                    style={{ transition: 'fill-opacity 160ms ease-out' }}
                  />
                )
              }}
            />
            <Tooltip
              isAnimationActive={!reduced}
              animationDuration={140}
              content={({ active: on, payload }) => {
                const d = payload?.[0]?.payload as (typeof data)[number] | undefined
                if (!on || !d) return null
                return (
                  <ChartTooltip
                    title={d.name}
                    rows={[
                      { color: d.fill, name: fmt.pct(sum ? d.ms / sum : 0), value: fmt.dur(d.ms) }
                    ]}
                  />
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={s.donutCenter} dir={dirOf(lang)}>
          <span className={s.donutValue}>{fmt.durShort(sum)}</span>
          <span className={s.donutLabel}>{centerLabel}</span>
        </div>
      </div>
      <ul className={s.legend}>
        {totals
          .filter((t) => t.ms > 0)
          .map((t) => (
            <li
              key={t.categoryId}
              className={s.legendItem}
              data-dim={(active !== null && active !== t.categoryId) || undefined}
              onMouseEnter={() => setActive(t.categoryId)}
              onMouseLeave={() => setActive(null)}
            >
              <span className={s.swatch} style={{ background: color(t.color) }} />
              <span className={s.legendName}>{t.name}</span>
              <span className={`${s.legendValue} num`}>{fmt.dur(t.ms)}</span>
              <span className={`${s.legendPct} num`}>{fmt.pct(sum ? t.ms / sum : 0)}</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
