import { motion } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import type { Page } from '@shared/ipc'
import { app, nav, trackingStatus } from '@shared/strings'
import { siteLabel } from '@shared/tracking/sites'
import { api } from '../lib/api'
import { PAGES, go, useNav } from '../lib/nav'
import { useSnapshot } from '../lib/store'
import { spring } from '../motion'
import { LogoMark, NavIcon } from './NavIcons'
import s from './Sidebar.module.css'

/** Right-hand sidebar (RTL). The active indicator slides between items. */
export function Sidebar(): React.JSX.Element {
  const { page } = useNav()
  const snap = useSnapshot()
  const t = snap.tracking
  const paused = snap.settings.tracking.paused
  const status = paused ? 'paused' : t.reason
  const current = t.current
    ? t.current.site
      ? siteLabel(t.current.site)
      : t.current.appName
    : null

  return (
    <aside className={s.sidebar}>
      <div className={s.brand}>
        <LogoMark size={32} />
        <span className={s.name}>{app.name}</span>
      </div>

      <nav aria-label={nav.label}>
        <ul className={s.list}>
          {PAGES.map((p: Page) => {
            const active = p === page
            return (
              <li key={p}>
                <button
                  type="button"
                  className={s.item}
                  data-active={active || undefined}
                  aria-current={active ? 'page' : undefined}
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
                  <span className={s.label}>{nav[p]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={s.status} data-status={status}>
        <div className={s.statusText}>
          <span className={s.dot} aria-hidden />
          <div className={s.statusLines}>
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
          aria-label={paused ? trackingStatus.resume : trackingStatus.pause}
          title={paused ? trackingStatus.resume : trackingStatus.pause}
          onClick={() => void api.invoke('tracking:setPaused', { paused: !paused })}
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>
    </aside>
  )
}
