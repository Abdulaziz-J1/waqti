import { useEffect, useState } from 'react'
import type { RunningApp } from '@shared/ipc'
import { common, focusPage } from '@shared/strings'
import { api } from '../lib/api'
import { AppIcon } from './AppIcon'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Switch } from './Toggle'
import s from './AppPicker.module.css'

interface AppPickerProps {
  open: boolean
  onClose: () => void
  title: string
  selected: string[]
  onToggle: (process: string) => void
}

/** Running apps plus recently used apps, each with a switch. */
export function AppPicker({
  open,
  onClose,
  title,
  selected,
  onToggle
}: AppPickerProps): React.JSX.Element {
  const [apps, setApps] = useState<RunningApp[] | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    void Promise.all([api.invoke('apps:running'), api.invoke('apps:recent')])
      .then(([running, recent]) => {
        if (!alive) return
        const seen = new Map<string, RunningApp>()
        for (const a of [...running, ...recent]) if (!seen.has(a.process)) seen.set(a.process, a)
        setApps([...seen.values()])
      })
      .catch(() => {
        if (alive) setApps([])
      })
    return () => {
      alive = false
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="primary" onClick={onClose}>
          {common.done}
        </Button>
      }
    >
      {apps === null ? (
        <p>{common.loading}</p>
      ) : apps.length === 0 ? (
        <p>{focusPage.noApps}</p>
      ) : (
        <ul className={s.list}>
          {apps.map((a) => (
            <li key={a.process} className={s.item}>
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
                onChange={() => onToggle(a.process)}
              />
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
