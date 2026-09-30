import { AnimatePresence, motion } from 'motion/react'
import { Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RunningApp } from '@shared/ipc'
import { common, focusPage } from '@shared/strings'
import { api } from '../lib/api'
import { useFlash } from '../lib/flash'
import { spring } from '../motion'
import { AppIcon } from './AppIcon'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { FlashNote } from './FlashNote'
import { Switch } from './Toggle'
import s from './AppPicker.module.css'

interface AppPickerProps {
  open: boolean
  onClose: () => void
  title: string
  selected: string[]
  onToggle: (process: string) => void
}

/** Checks for newly opened apps this often while the picker is open. */
const REFRESH_MS = 3000

/**
 * Running apps plus recently used apps, each with a switch. An app opened
 * while the picker is up appears at the top within a few seconds, and each
 * switch says what it did without closing the picker.
 */
export function AppPicker({
  open,
  onClose,
  title,
  selected,
  onToggle
}: AppPickerProps): React.JSX.Element {
  const [apps, setApps] = useState<RunningApp[] | null>(null)
  const [flash, show] = useFlash()

  useEffect(() => {
    if (!open) return
    let alive = true
    // Recent apps once; then only what is running, to catch newly opened ones.
    const load = (first: boolean): void => {
      void Promise.all([api.invoke('apps:running'), first ? api.invoke('apps:recent') : []])
        .then(([running, recent]) => {
          if (!alive) return
          setApps((prev) => {
            const seen = new Map<string, RunningApp>()
            for (const a of [...running, ...recent])
              if (!seen.has(a.process)) seen.set(a.process, a)
            if (!prev) return [...seen.values()]
            // Keep the order on screen; newly opened apps go first.
            const known = new Set(prev.map((a) => a.process))
            const fresh = [...seen.values()].filter((a) => !known.has(a.process))
            return fresh.length ? [...fresh, ...prev] : prev
          })
        })
        .catch(() => {
          if (alive) setApps((prev) => prev ?? [])
        })
    }
    load(true)
    const timer = setInterval(() => load(false), REFRESH_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [open])

  const toggle = (a: RunningApp): void => {
    const on = selected.includes(a.process)
    onToggle(a.process)
    show(on ? focusPage.removedItem(a.appName) : focusPage.added(a.appName), on ? 'info' : 'ok')
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <FlashNote flash={flash} className={s.flash} />
          <Button variant="primary" onClick={onClose}>
            {common.done}
          </Button>
        </>
      }
    >
      <p className={s.hint}>
        <Info size={15} aria-hidden />
        {focusPage.appsHint}
      </p>
      {apps === null ? (
        <p>{common.loading}</p>
      ) : apps.length === 0 ? (
        <p>{focusPage.noApps}</p>
      ) : (
        <ul className={s.list}>
          <AnimatePresence initial={false}>
            {apps.map((a) => (
              <motion.li
                key={a.process}
                layout
                className={s.item}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.gentle}
              >
                <AppIcon icon={a.icon} name={a.appName} size={26} />
                <span className={s.name}>
                  <bdi>{a.appName}</bdi>
                  <span className={s.proc}>
                    <bdi>{a.process}</bdi>
                  </span>
                </span>
                <Switch
                  checked={selected.includes(a.process)}
                  label={a.appName}
                  onChange={() => toggle(a)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Dialog>
  )
}
