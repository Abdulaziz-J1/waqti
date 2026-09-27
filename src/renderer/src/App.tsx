import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect } from 'react'
import type { Page } from '@shared/ipc'
import { SkyBackground } from './components/SkyBackground'
import { Sidebar } from './components/Sidebar'
import { useNav } from './lib/nav'
import { useReducedMotion, useSkyTheme } from './lib/sky'
import { useSnapshot } from './lib/store'
import { api } from './lib/api'
import { pageVariants } from './motion'
import { TodayPage } from './pages/Today'
import { FocusPage } from './pages/Focus'
import { ReportsPage } from './pages/Reports'
import { PrayerPage } from './pages/Prayer'
import { SettingsPage } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import s from './App.module.css'

const PAGE_COMPONENTS: Record<Page, () => React.JSX.Element> = {
  today: TodayPage,
  focus: FocusPage,
  reports: ReportsPage,
  prayer: PrayerPage,
  settings: SettingsPage
}

function Shell(): React.JSX.Element {
  const { page, dir } = useNav()
  const Current = PAGE_COMPONENTS[page]
  return (
    <div className={s.shell}>
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
            <Current />
          </motion.div>
        </AnimatePresence>
      </main>
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
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <SkyBackground night={night} />
      {snap.settings.onboarded ? <Shell /> : <Onboarding />}
    </MotionConfig>
  )
}
