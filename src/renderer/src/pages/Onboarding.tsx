import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RunningApp } from '@shared/ipc'
import type { DaySchedule } from '@shared/prayer/schedule'
import { PRAYERS, SLOTS } from '@shared/prayer/schedule'
import { common, onboarding as t, prayerNames, prayerPage } from '@shared/strings'
import { PRESET_DISTRACTION_SITES } from '@shared/tracking/detect'
import { siteLabel } from '@shared/tracking/sites'
import { AppIcon } from '../components/AppIcon'
import { Button } from '../components/Button'
import { Chip } from '../components/Field'
import { LocationPicker } from '../components/LocationPicker'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { LogoMark } from '../components/NavIcons'
import { Stepper } from '../components/Stepper'
import { Switch, Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import { requestEntrance } from '../lib/entrance'
import { useFmt } from '../lib/fmt'
import { updateSettings, useSettings } from '../lib/store'
import { endSide, spring } from '../motion'
import s from './Onboarding.module.css'

const STEPS = 5

/** Steps slide in from the reading end and leave toward the start. */
const slide = {
  enter: (dir: number) => ({ opacity: 0, x: (dir >= 0 ? 24 : -24) * endSide() }),
  center: { opacity: 1, x: 0, transition: spring.gentle },
  exit: (dir: number) => ({
    opacity: 0,
    x: (dir >= 0 ? -24 : 24) * endSide(),
    transition: { duration: 0.16 }
  })
}

function PrayerPreview({ schedule }: { schedule: DaySchedule | null }): React.JSX.Element {
  const fmt = useFmt()
  if (!schedule) return <div className={s.previewEmpty}>{common.loading}</div>
  return (
    <ul className={s.preview} aria-live="polite">
      {SLOTS.map((slot) => (
        <li key={slot} className={s.previewItem}>
          <span className={s.previewName}>
            {slot === 'dhuhr' && schedule.isFriday ? prayerNames.jumuah : prayerNames[slot]}
          </span>
          <motion.span
            key={schedule.times[slot]}
            className={`${s.previewTime} num`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {fmt.clock(schedule.times[slot])}
          </motion.span>
        </li>
      ))}
    </ul>
  )
}

export function Onboarding(): React.JSX.Element {
  const settings = useSettings()
  const fmt = useFmt()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [preview, setPreview] = useState<DaySchedule | null>(null)
  const [running, setRunning] = useState<RunningApp[] | null>(null)
  const [launchAtStartup, setLaunchAtStartup] = useState(settings.general.launchAtStartup)
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    let alive = true
    void api.invoke('prayer:preview', { location: settings.location }).then((r) => {
      if (alive) setPreview(r.schedule)
    })
    return () => {
      alive = false
    }
  }, [settings.location])

  useEffect(() => {
    if (step !== 3 || running) return
    let alive = true
    void api
      .invoke('apps:running')
      .then((list) => {
        if (alive) setRunning(list)
      })
      .catch(() => {
        if (alive) setRunning([])
      })
    return () => {
      alive = false
    }
  }, [step, running])

  const goTo = (n: number): void => {
    setDir(n > step ? 1 : -1)
    setStep(n)
  }

  const finish = async (): Promise<void> => {
    setFinishing(true)
    requestEntrance()
    await api.invoke('onboarding:complete', { launchAtStartup })
  }

  const toggleSite = (id: string): void => {
    const cur = settings.distractions.sites
    void updateSettings({
      distractions: { sites: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }
    })
  }
  const toggleApp = (process: string): void => {
    const cur = settings.distractions.apps
    void updateSettings({
      distractions: {
        apps: cur.includes(process) ? cur.filter((x) => x !== process) : [...cur, process]
      }
    })
  }

  return (
    <div className={s.screen}>
      <div className={s.drag} aria-hidden />
      <div className={s.card}>
        <div
          className={s.progress}
          aria-label={t.stepOf(fmt.num(step + 1), fmt.num(STEPS))}
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS}
        >
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={s.seg}>
              <motion.span
                className={s.segFill}
                initial={false}
                animate={{ scaleX: i <= step ? 1 : 0 }}
                transition={spring.gentle}
              />
            </span>
          ))}
        </div>

        <div className={s.body}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              className={s.step}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {step === 0 ? (
                <div className={s.welcome}>
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ ...spring.gentle, delay: 0.1 }}
                  >
                    <LogoMark size={84} />
                  </motion.div>
                  <div className={s.language}>
                    <LanguageSwitch label={t.language} size="md" />
                  </div>
                  <h1 className={s.title}>{t.welcomeTitle}</h1>
                  <p className={s.lead}>{t.welcomeBody}</p>
                  <p className={s.small}>{t.welcomePrivacy}</p>
                </div>
              ) : step === 1 ? (
                <>
                  <h1 className={s.title}>{t.cityTitle}</h1>
                  <p className={s.lead}>{t.cityBody}</p>
                  <LocationPicker
                    value={settings.location}
                    onChange={(loc) => void updateSettings({ location: loc })}
                  />
                  <h2 className={s.subTitle}>{t.previewTitle}</h2>
                  <PrayerPreview schedule={preview} />
                </>
              ) : step === 2 ? (
                <>
                  <h1 className={s.title}>{t.lockTitle}</h1>
                  <p className={s.lead}>{t.lockBody}</p>
                  <ul className={s.lockList}>
                    {PRAYERS.map((p) => {
                      const cfg = settings.prayers[p]
                      return (
                        <li key={p} className={s.lockRow}>
                          <span className={s.lockName}>{prayerNames[p]}</span>
                          <Switch
                            checked={cfg.lock}
                            label={`${prayerPage.lock} ${prayerNames[p]}`}
                            onChange={(v) => void updateSettings({ prayers: { [p]: { lock: v } } })}
                          />
                          <span className={cfg.lock ? undefined : s.dim}>
                            <Stepper
                              label={`${prayerPage.lockFor} ${prayerNames[p]}`}
                              value={cfg.lockMinutes}
                              min={5}
                              max={60}
                              step={5}
                              format={(v) => fmt.minutes(v)}
                              onChange={(v) =>
                                void updateSettings({ prayers: { [p]: { lockMinutes: v } } })
                              }
                            />
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : step === 3 ? (
                <>
                  <h1 className={s.title}>{t.distractionsTitle}</h1>
                  <p className={s.lead}>{t.distractionsBody}</p>
                  <h2 className={s.subTitle}>{t.presetSites}</h2>
                  <div className={s.chips}>
                    {PRESET_DISTRACTION_SITES.map((id) => (
                      <Chip
                        key={id}
                        selected={settings.distractions.sites.includes(id)}
                        onToggle={() => toggleSite(id)}
                      >
                        <bdi>{siteLabel(id)}</bdi>
                      </Chip>
                    ))}
                  </div>
                  <h2 className={s.subTitle}>{t.runningApps}</h2>
                  {running === null ? (
                    <p className={s.small}>{common.loading}</p>
                  ) : running.length === 0 ? (
                    <p className={s.small}>{t.noApps}</p>
                  ) : (
                    <div className={s.chips}>
                      {running.map((a) => (
                        <Chip
                          key={a.process}
                          selected={settings.distractions.apps.includes(a.process)}
                          onToggle={() => toggleApp(a.process)}
                          icon={<AppIcon icon={a.icon} name={a.appName} size={18} />}
                        >
                          <bdi>{a.appName}</bdi>
                        </Chip>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 className={s.title}>{t.startupTitle}</h1>
                  <p className={s.lead}>{t.startupBody}</p>
                  <Toggle
                    label={t.startupToggle}
                    hint={t.startupHint}
                    checked={launchAtStartup}
                    onChange={setLaunchAtStartup}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className={s.footer}>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => goTo(step - 1)}>
              {common.back}
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS - 1 ? (
            <Button
              variant="primary"
              size="lg"
              icon={<ArrowRight size={18} className="icon-directional" />}
              onClick={() => goTo(step + 1)}
              data-testid="onboarding-next"
            >
              {step === 0 ? t.start : common.next}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              disabled={finishing}
              onClick={() => void finish()}
              data-testid="onboarding-finish"
            >
              {t.finish}
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}
