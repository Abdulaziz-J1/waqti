import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { useEffect } from 'react'
import type { Page } from '@shared/ipc'
import { app, nav, trackingStatus } from '@shared/strings'
import { siteLabel } from '@shared/tracking/sites'
import { api } from '../lib/api'
import { PAGES, go, useNav } from '../lib/nav'
import { updateSettings, useSnapshot } from '../lib/store'
import { spring } from '../motion'
import { LogoMark, NavIcon } from './NavIcons'
import s from './Sidebar.module.css'

/**
 * Right-hand sidebar (RTL). The active indicator slides between items. It
 * folds to a rail of icons (the handle on its edge, or Ctrl+B): the logo, the
 * pages and the tracking switch with its light stay; names show as tips.
 */
export function Sidebar(): React.JSX.Element {
  const { page } = useNav()
  const snap = useSnapshot()
  const t = snap.tracking
  const paused = snap.settings.tracking.paused
  const collapsed = snap.settings.appearance.sidebarCollapsed
  const status = paused ? 'paused' : t.reason
  const current = t.current
    ? t.current.site
      ? siteLabel(t.current.site)
      : t.current.appName
    : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyB') {
        e.preventDefault()
        void updateSettings({ appearance: { sidebarCollapsed: !collapsed } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed])

  const toggleLabel = collapsed ? nav.expand : nav.collapse
  const pauseLabel = paused ? trackingStatus.resume : trackingStatus.pause

  return (
    <aside className={s.sidebar} data-collapsed={collapsed || undefined}>
      <div className={s.brand}>
        <LogoMark size={30} />
        <span className={s.name}>{app.name}</span>
      </div>

      <nav aria-label={nav.label}>
        <ul className={s.list}>
          {PAGES.map((p: Page) => {
            const active = p === page
            return (
              <li key={p} className={s.entry}>
                <button
                  type="button"
                  className={s.item}
                  data-active={active || undefined}
                  aria-current={active ? 'page' : undefined}
                  aria-label={nav[p]}
                  onClick={() => go(p)}
                  data-testid={`nav-${p}`}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-indicator"
                      className={s.indicator}
                      transition={spring.snappy}
                    >
                      <span className={s.bar} />
                    </motion.span>
                  ) : null}
                  <span className={s.icon}>
                    <NavIcon page={p} />
                  </span>
                  <span className={s.label} aria-hidden>
                    {nav[p]}
                  </span>
                </button>
                <span className={s.tip} aria-hidden>
                  {nav[p]}
                </span>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={s.statusWrap}>
        <div className={s.status} data-status={status}>
          <div className={s.statusText}>
            <span className={s.dot} role="img" aria-label={trackingStatus[status]} />
            <div className={s.statusLines} aria-hidden={collapsed || undefined}>
              <span>{trackingStatus[status]}</span>
              {current && !paused ? (
                <span className={s.current}>
                  <bdi>{current}</bdi>
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={s.pause}
            aria-label={pauseLabel}
            title={pauseLabel}
            onClick={() => void api.invoke('tracking:setPaused', { paused: !paused })}
            data-testid="tracking-toggle"
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
        </div>
        <span className={s.tip} aria-hidden>
          {trackingStatus[status]}
        </span>
      </div>
      {/* Last in the sidebar on purpose: window-drag regions are applied in
          document order, so nothing after it can turn part of it into a drag area. */}
      <button
        type="button"
        className={s.toggle}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        title={toggleLabel}
        onClick={() => void updateSettings({ appearance: { sidebarCollapsed: !collapsed } })}
        data-testid="sidebar-toggle"
      >
        {collapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
    </aside>
  )
}
