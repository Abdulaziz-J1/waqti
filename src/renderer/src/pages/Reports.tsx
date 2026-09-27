import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ActivityTotal, RangeKind } from '@shared/tracking/aggregate'
import { RANGE_DAYS } from '@shared/tracking/aggregate'
import { common, compare, reports as t } from '@shared/strings'
import { addDays, dayKey, dayStart } from '@shared/time'
import { AppIcon } from '../components/AppIcon'
import { Button } from '../components/Button'
import { CountUp } from '../components/CountUp'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { RecategorizeDialog } from '../components/RecategorizeDialog'
import { Segmented } from '../components/Segmented'
import { Donut } from '../components/charts/Donut'
import { StackedBars, type StackRow } from '../components/charts/StackedBars'
import { api } from '../lib/api'
import { useFmt } from '../lib/fmt'
import { useNow } from '../lib/now'
import { useCatColor } from '../lib/tone'
import { useData } from '../lib/useData'
import { fadeUp, stagger } from '../motion'
import s from './Reports.module.css'

const PREVIEW_ROWS = 10

export function ReportsPage(): React.JSX.Element {
  const fmt = useFmt()
  const color = useCatColor()
  const now = useNow(60_000)
  const today = dayKey(now)
  const [kind, setKind] = useState<RangeKind>('week')
  const [anchor, setAnchor] = useState(today)
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState<ActivityTotal | null>(null)
  const report = useData(() => api.invoke('reports:get', { kind, anchor }), [kind, anchor])
  const cats = useData(() => api.invoke('categories:get'), [])
  const r = report.data
  const n = RANGE_DAYS[kind]
  const isCurrent = anchor >= today

  const move = (dir: -1 | 1): void => {
    const next = addDays(anchor, dir * n)
    setAnchor(next > today ? today : next)
  }

  let rows: StackRow[] = []
  if (r?.hourly) {
    rows = r.hourly.map((h) => ({
      key: String(h.hour),
      label: fmt.hour(h.hour),
      title: `${fmt.hour(h.hour)} – ${fmt.hour(h.hour + 1)}`,
      total: h.total,
      byCategory: h.byCategory
    }))
  } else if (r) {
    rows = r.stacks.map((d) => ({
      key: d.day,
      label: fmt.dayAxis(d.day, kind === 'month'),
      title: `${fmt.weekday(dayStart(d.day).getTime())} ${fmt.dayMonth(dayStart(d.day).getTime())}`,
      total: d.total,
      byCategory: d.byCategory
    }))
  }

  const prevLabel = compare.prev[kind]
  const activeDays = r ? Math.max(1, r.stacks.filter((d) => d.total > 0).length) : 1
  const activities = r?.activities ?? []
  const shown = showAll ? activities : activities.slice(0, PREVIEW_ROWS)
  const maxMs = activities[0]?.ms ?? 1
  const catById = new Map((r?.categories ?? []).map((c) => [c.id, c]))

  return (
    <motion.div className={s.page} initial="hidden" animate="show" variants={stagger()}>
      <PageHeader
        title={t.title}
        sub={r ? fmt.dayRange(r.from, r.to) : common.loading}
        actions={
          <>
            <div className={s.nav}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.prev}
                title={t.prev}
                onClick={() => move(-1)}
                icon={<ChevronRight size={18} />}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.next}
                title={t.next}
                disabled={isCurrent}
                onClick={() => move(1)}
                icon={<ChevronLeft size={18} />}
              />
            </div>
            <Segmented<RangeKind>
              label={t.title}
              value={kind}
              onChange={(k) => {
                setKind(k)
                setAnchor(today)
                setShowAll(false)
              }}
              options={[
                { value: 'day', label: t.tabs.day },
                { value: 'week', label: t.tabs.week },
                { value: 'month', label: t.tabs.month }
              ]}
            />
          </>
        }
      />

      {report.error ? (
        <Panel>
          <EmptyState
            art="error"
            body={common.loadError}
            action={<Button onClick={report.reload}>{common.retry}</Button>}
          />
        </Panel>
      ) : r && r.totalMs === 0 ? (
        <Panel>
          <EmptyState art="chart" body={t.empty} />
        </Panel>
      ) : r ? (
        <>
          <motion.div className={s.tiles} variants={fadeUp}>
            <div className={s.tile}>
              <span className={s.tileLabel}>{t.total}</span>
              <CountUp value={r.totalMs} format={(v) => fmt.dur(v)} className={s.tileValue} />
              <span className={s.tileSub}>{fmt.compare(r.totalMs, r.prevTotalMs, prevLabel)}</span>
            </div>
            {kind !== 'day' ? (
              <div className={s.tile}>
                <span className={s.tileLabel}>{t.dailyAverage}</span>
                <CountUp
                  value={r.totalMs / activeDays}
                  format={(v) => fmt.dur(v)}
                  className={s.tileValue}
                />
                <span className={s.tileSub}>{fmt.days(activeDays)}</span>
              </div>
            ) : null}
            <div className={s.tile}>
              <span className={s.tileLabel}>{t.focusTime}</span>
              <CountUp
                value={r.focus.focusedMs}
                format={(v) => fmt.dur(v)}
                className={s.tileValue}
              />
              <span className={s.tileSub}>
                {r.focus.sessions > 0
                  ? fmt.sessions(r.focus.sessions)
                  : fmt.compare(r.focus.focusedMs, r.prevFocus.focusedMs, prevLabel)}
              </span>
            </div>
            <div className={s.tile}>
              <span className={s.tileLabel}>{t.focusBlocked}</span>
              <CountUp
                value={r.focus.blocked}
                format={(v) => fmt.num(Math.round(v))}
                className={s.tileValue}
              />
              <span className={s.tileSub}>
                {t.focusCompletion}: {fmt.pct(r.focus.completionRate)}
              </span>
            </div>
          </motion.div>

          <div className={s.charts}>
            <Panel
              title={kind === 'day' ? t.byHour : t.byDay}
              actions={<span className={s.note}>{t.byHourNote}</span>}
            >
              <StackedBars
                rows={rows}
                categories={r.categories}
                height={kind === 'month' ? 300 : 280}
              />
            </Panel>
            <Panel title={t.categories}>
              <Donut totals={r.totals} centerLabel={t.total} />
            </Panel>
          </div>

          <Panel title={t.table} id="reports-table">
            <div className={s.table} role="table" aria-label={t.table}>
              <div className={s.thead} role="row">
                <span role="columnheader">{t.colName}</span>
                <span role="columnheader">{t.colCategory}</span>
                <span role="columnheader">{t.share}</span>
                <span role="columnheader" className={s.right}>
                  {t.colTime}
                </span>
              </div>
              {shown.map((a) => {
                const c = catById.get(a.categoryId)
                const col = c ? color(c.color) : 'var(--text-3)'
                return (
                  <div key={a.key} className={s.tr} role="row">
                    <span className={s.nameCell} role="cell">
                      <AppIcon icon={a.icon} name={a.label} site={a.site} color={col} size={26} />
                      <span className={s.nameText}>
                        <span className={s.name}>
                          <bdi>{a.label}</bdi>
                        </span>
                        <span className={s.sub}>
                          <bdi>{a.site ? t.siteVia(a.appName) : t.app}</bdi>
                        </span>
                      </span>
                    </span>
                    <span role="cell">
                      <button
                        type="button"
                        className={s.catChip}
                        onClick={() => setEditing(a)}
                        title={t.recategorize}
                        aria-label={`${t.recategorize}: ${a.label}`}
                      >
                        <span className={s.catDot} style={{ background: col }} />
                        {c?.name}
                      </button>
                    </span>
                    <span role="cell" className={s.shareCell}>
                      <span className={s.shareBar}>
                        <motion.span
                          className={s.shareFill}
                          style={{ background: col }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: a.ms / maxMs }}
                          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
                        />
                      </span>
                      <span className={`${s.pct} num`}>{fmt.pct(a.ms / r.totalMs)}</span>
                    </span>
                    <span role="cell" className={`${s.time} num`}>
                      {fmt.durShort(a.ms)}
                    </span>
                  </div>
                )
              })}
            </div>
            {activities.length > PREVIEW_ROWS ? (
              <div className={s.more}>
                <Button variant="ghost" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? t.showLess : t.showMore}
                </Button>
              </div>
            ) : null}
          </Panel>
        </>
      ) : (
        <Panel>
          <EmptyState art="chart" body={common.loading} />
        </Panel>
      )}

      <RecategorizeDialog
        activity={editing}
        categories={cats.data?.categories ?? r?.categories ?? []}
        rules={cats.data?.rules ?? []}
        onClose={() => {
          setEditing(null)
          cats.reload()
        }}
      />
    </motion.div>
  )
}
