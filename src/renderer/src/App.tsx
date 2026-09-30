import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Suspense, lazy, useEffect } from 'react'
import type { Page } from '@shared/ipc'
import { SkyBackground } from './components/SkyBackground'
import { Sidebar } from './components/Sidebar'
import { FocusSummary } from './components/FocusSummary'
import { DebugPanel } from './components/DebugPanel'
import { Toaster } from './components/Toaster'
import { useNav } from './lib/nav'
import { useReducedMotion, useSkyTheme } from './lib/sky'
import { useSettings, useSnapshot } from './lib/store'
import { ToneContext } from './lib/tone'
import { api } from './lib/api'
import { pageVariants } from './motion'
import { TodayPage } from './pages/Today'
import { FocusPage } from './pages/Focus'
import { PrayerPage } from './pages/Prayer'
import { Onboarding } from './pages/Onboarding'
import s from './App.module.css'

// Reports (charts) and Settings load on first visit, keeping the resident renderer small.
const ReportsPage = lazy(() => import('./pages/Reports').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.SettingsPage }))
)

const PAGE_COMPONENTS: Record<Page, React.ComponentType> = {
  today: TodayPage,
  focus: FocusPage,
  reports: ReportsPage,
  prayer: PrayerPage,
  settings: SettingsPage
}

function Shell(): React.JSX.Element {
  const { page, dir } = useNav()
  const Current = PAGE_COMPONENTS[page]
  const collapsed = useSettings().appearance.sidebarCollapsed
  return (
    <div className={s.shell} data-collapsed={collapsed || undefined}>
      <Sidebar />
      <main className={s.main}>
        <div className={s.titlebar} aria-hidden />
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={page}
            className={s.page}
            custom={dir}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <Suspense fallback={null}>
              <Current />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <FocusSummary />
      <DebugPanel />
      <Toaster />
    </div>
  )
}

export function App(): React.JSX.Element {
  const snap = useSnapshot()
  const sky = useSkyTheme()
  const reduced = useReducedMotion()

  useEffect(() => {
    // Cold-start measurement: the UI is interactive once the first frame with data is painted.
    requestAnimationFrame(() => {
      void api.invoke('app:ready', { at: Date.now() })
    })
  }, [])

  const night =
    snap.settings.appearance.theme !== 'light' &&
    sky.tone === 'dark' &&
    (sky.period === 'night' || sky.period === 'dawn')

  return (
    <ToneContext.Provider value={sky.tone}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
        <SkyBackground night={night} />
        {snap.settings.onboarded ? <Shell /> : <Onboarding />}
      </MotionConfig>
    </ToneContext.Provider>
  )
}
