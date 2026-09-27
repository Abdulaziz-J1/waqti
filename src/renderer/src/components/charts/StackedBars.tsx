import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps
} from 'recharts'
import type { Category } from '@shared/tracking/categorize'
import { useFmt } from '../../lib/fmt'
import { useReducedMotion } from '../../lib/sky'
import { useCatColor } from '../../lib/tone'
import { ChartTooltip } from './ChartTooltip'
import s from './charts.module.css'

export interface StackRow {
  key: string
  /** Axis label. */
  label: string
  /** Tooltip title. */
  title: string
  total: number
  byCategory: Record<string, number>
}

interface StackedBarsProps {
  rows: StackRow[]
  categories: Category[]
  height?: number
}

/** Axis ticks on whole hours (or 15-minute steps for short spans), at most four. */
function niceHourTicks(maxMs: number): number[] {
  const QUARTER = 15 * 60_000
  const HOUR = 60 * 60_000
  if (maxMs <= 0) return [0, HOUR]
  const unit = maxMs <= 2 * HOUR ? QUARTER : HOUR
  const steps = [1, 2, 3, 4, 6, 8, 12, 24, 48]
  const units = Math.ceil(maxMs / unit)
  const step = steps.find((s) => units / s <= 3) ?? Math.ceil(units / 3)
  const top = Math.ceil(units / step) * step
  const out: number[] = []
  for (let v = 0; v <= top; v += step) out.push(v * unit)
  return out
}

/** Rounded top corners (4 px) on the topmost segment only, square elsewhere. */
function segmentPath(x: number, y: number, w: number, h: number, top: boolean): string {
  if (h <= 0 || w <= 0) return ''
  const r = top ? Math.min(4, w / 2, h) : 0
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

/**
 * Stacked bars by category. Time runs right-to-left (the X axis is reversed)
 * and the value axis sits on the right, matching the RTL layout.
 */
export function StackedBars({
  rows,
  categories,
  height = 280
}: StackedBarsProps): React.JSX.Element {
  const fmt = useFmt()
  const color = useCatColor()
  const reduced = useReducedMotion()
  const used = categories.filter((c) => rows.some((r) => (r.byCategory[c.id] ?? 0) > 0))
  const data = rows.map((r) => ({
    key: r.key,
    label: r.label,
    title: r.title,
    total: r.total,
    ...r.byCategory
  }))
  const topOf = (row: Record<string, unknown>): string | undefined =>
    [...used].reverse().find((c) => Number(row[c.id] ?? 0) > 0)?.id
  const maxMs = Math.max(0, ...rows.map((r) => r.total))
  const ticks = niceHourTicks(maxMs)
  const names = new Map(used.map((c) => [c.id, c.name]))
  const colors = new Map(used.map((c) => [c.id, color(c.color)]))

  return (
    <div className={s.chart} dir="ltr" style={{ blockSize: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            reversed
            tickLine={false}
            axisLine={{ stroke: 'var(--border-strong)' }}
            tick={{ fill: 'var(--text-3)', fontSize: 12 }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            orientation="right"
            width={50}
            tickLine={false}
            axisLine={false}
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1] ?? 0]}
            tick={{ fill: 'var(--text-3)', fontSize: 12 }}
            tickFormatter={(v: number) => fmt.hoursAxis(v)}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-hover)', radius: 6 }}
            isAnimationActive={!reduced}
            animationDuration={160}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined
              if (!active || !row) return null
              const parts = used
                .map((c) => ({ id: c.id, ms: Number((row as Record<string, unknown>)[c.id] ?? 0) }))
                .filter((p) => p.ms > 0)
              return (
                <ChartTooltip
                  title={row.title}
                  total={fmt.dur(row.total)}
                  rows={parts.map((p) => ({
                    color: colors.get(p.id) ?? 'var(--text-3)',
                    name: names.get(p.id) ?? p.id,
                    value: fmt.dur(p.ms)
                  }))}
                />
              )
            }}
          />
          {used.map((c) => (
            <Bar
              key={c.id}
              dataKey={c.id}
              stackId="usage"
              fill={colors.get(c.id)}
              isAnimationActive={!reduced}
              animationDuration={700}
              animationEasing="ease-out"
              shape={(p: BarShapeProps) => {
                const top = topOf(p.payload as Record<string, unknown>) === c.id
                return (
                  <path
                    d={segmentPath(p.x, p.y, p.width, p.height, top)}
                    fill={colors.get(c.id)}
                    fillOpacity={p.isActive ? 1 : 0.9}
                    stroke="var(--chart-surface)"
                    strokeWidth={top ? 0 : 1}
                  />
                )
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
