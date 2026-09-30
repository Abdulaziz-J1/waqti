import { AnimatePresence, motion } from 'motion/react'
import { Check, Pencil, Plus } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import type { RunningApp } from '@shared/ipc'
import { common, focusPage as t } from '@shared/strings'
import { friendlyAppName } from '@shared/tracking/apps'
import { PRESET_DISTRACTION_SITES, type SiteInput } from '@shared/tracking/detect'
import {
  type ChipKind,
  type Distractions,
  addChip,
  chipsOf,
  removeChip,
  setChip
} from '@shared/tracking/distractions'
import { siteLabel } from '@shared/tracking/sites'
import { api } from '../lib/api'
import { updateSettings, useSettings } from '../lib/store'
import { AppIcon } from './AppIcon'
import { AppPicker } from './AppPicker'
import { Button } from './Button'
import { Chip, TextField } from './Field'
import { SitePicker } from './SitePicker'
import { spring } from '../motion'
import s from './DistractionEditor.module.css'

type Section = 'sites' | 'apps' | 'keywords'

/** Icons and names of running and recently used apps, for the app chips. */
function useKnownApps(listed: string[]): Map<string, RunningApp> {
  const [apps, setApps] = useState(() => new Map<string, RunningApp>())
  const key = listed.join('|')
  useEffect(() => {
    if (!key) return
    let alive = true
    void Promise.all([api.invoke('apps:running'), api.invoke('apps:recent')])
      .then(([running, recent]) => {
        if (!alive) return
        const map = new Map<string, RunningApp>()
        for (const a of [...running, ...recent]) if (!map.has(a.process)) map.set(a.process, a)
        setApps(map)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [key])
  return apps
}

/**
 * The distraction list as chips: every site, app and keyword switches on and
 * off where it stands, and the pencil beside a heading lets you take the
 * added ones off the list (the preset sites only switch off).
 */
export function DistractionEditor(): React.JSX.Element {
  const { distractions: d } = useSettings()
  const [editing, setEditing] = useState<Section | null>(null)
  const [picker, setPicker] = useState(false)
  const [sitePicker, setSitePicker] = useState(false)
  const [keyword, setKeyword] = useState('')

  const knownSites = chipsOf(d, 'sites')
  const customSites = chipsOf(d, 'customSites')
  const apps = chipsOf(d, 'apps')
  const keywords = chipsOf(d, 'keywords')
  const appInfo = useKnownApps(apps)

  const save = (patch: Partial<Distractions>): void => {
    void updateSettings({ distractions: patch })
  }
  const toggle = (kind: ChipKind, v: string): void =>
    save(setChip(d, kind, v, !d[kind].includes(v)))

  const addSite = (site: SiteInput): void => {
    save(
      site.kind === 'known' ? addChip(d, 'sites', site.id) : addChip(d, 'customSites', site.name)
    )
  }

  const addKeyword = (): void => {
    const k = keyword.trim()
    if (!k) return
    save(addChip(d, 'keywords', k))
    setKeyword('')
  }

  // Edit mode ends by itself once nothing is left to remove.
  const removable: Record<Section, number> = {
    sites: knownSites.length + customSites.length,
    apps: apps.length,
    keywords: keywords.length
  }
  const isEditing = (sec: Section): boolean => editing === sec && removable[sec] > 0

  const chip = (kind: ChipKind, sec: Section, v: string, label: string, icon?: ReactNode) => (
    <Chip
      key={`${kind}:${v}`}
      selected={d[kind].includes(v)}
      onToggle={() => toggle(kind, v)}
      icon={icon}
      onRemove={isEditing(sec) ? () => save(removeChip(d, kind, v)) : undefined}
      removeLabel={t.remove(label)}
    >
      <bdi>{label}</bdi>
    </Chip>
  )

  const addButton = (label: string, onClick: () => void, testId?: string) => (
    <motion.button
      key="add"
      layout
      type="button"
      className={s.addChip}
      onClick={onClick}
      transition={spring.snappy}
      data-testid={testId}
    >
      <Plus size={15} strokeWidth={2.4} />
      {label}
    </motion.button>
  )

  const head = (sec: Section, title: string) => (
    <div className={s.head}>
      <h3 className={s.title}>{title}</h3>
      {removable[sec] > 0 ? (
        <button
          type="button"
          className={s.edit}
          aria-label={isEditing(sec) ? t.editDone : t.edit(title)}
          aria-pressed={isEditing(sec)}
          onClick={() => setEditing(isEditing(sec) ? null : sec)}
          data-testid={`edit-${sec}`}
        >
          {isEditing(sec) ? (
            <>
              <Check size={14} strokeWidth={2.6} />
              <span>{t.editDone}</span>
            </>
          ) : (
            <Pencil size={14} />
          )}
        </button>
      ) : null}
      <AnimatePresence>
        {isEditing(sec) ? (
          <motion.span
            className={s.editHint}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            {t.editHint}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  )

  return (
    <div className={s.root}>
      <p className={s.hint}>{t.distractionsHint}</p>

      {head('sites', t.sites)}
      <div className={s.chips} data-testid="site-chips">
        <AnimatePresence initial={false} mode="popLayout">
          {PRESET_DISTRACTION_SITES.map((id) => (
            <Chip
              key={`preset:${id}`}
              selected={d.sites.includes(id)}
              onToggle={() => toggle('sites', id)}
            >
              <bdi>{siteLabel(id)}</bdi>
            </Chip>
          ))}
          {knownSites.map((id) => chip('sites', 'sites', id, siteLabel(id)))}
          {customSites.map((name) => chip('customSites', 'sites', name, name))}
          {addButton(t.addSite, () => setSitePicker(true), 'add-site')}
        </AnimatePresence>
      </div>

      {head('apps', t.apps)}
      <div className={s.chips} data-testid="app-chips">
        <AnimatePresence initial={false} mode="popLayout">
          {apps.map((p) => {
            const info = appInfo.get(p)
            const name = info?.appName ?? friendlyAppName(p)
            return chip(
              'apps',
              'apps',
              p,
              name,
              <AppIcon icon={info?.icon ?? null} name={name} size={18} />
            )
          })}
          {addButton(t.addApp, () => setPicker(true), 'add-app')}
        </AnimatePresence>
      </div>

      {head('keywords', t.keywords)}
      {keywords.length > 0 ? (
        <div className={s.chips} data-testid="keyword-chips">
          <AnimatePresence initial={false} mode="popLayout">
            {keywords.map((k) => chip('keywords', 'keywords', k, k))}
          </AnimatePresence>
        </div>
      ) : null}
      <form
        className={s.addRow}
        onSubmit={(e) => {
          e.preventDefault()
          addKeyword()
        }}
      >
        <TextField
          label={t.newKeyword}
          className={s.keywordField}
          placeholder={t.keywordPlaceholder}
          value={keyword}
          maxLength={60}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!keyword.trim()}>
          {common.add}
        </Button>
      </form>

      <AppPicker
        open={picker}
        onClose={() => setPicker(false)}
        title={t.pickApp}
        selected={apps}
        onToggle={(p) => save(apps.includes(p) ? removeChip(d, 'apps', p) : addChip(d, 'apps', p))}
      />
      <SitePicker
        open={sitePicker}
        onClose={() => setSitePicker(false)}
        selected={knownSites}
        onToggle={(id) =>
          save(knownSites.includes(id) ? removeChip(d, 'sites', id) : addChip(d, 'sites', id))
        }
        onAdd={addSite}
      />
    </div>
  )
}
