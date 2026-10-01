import { AnimatePresence, motion } from 'motion/react'
import { Bug, Download, FolderOpen, Lightbulb, Plus, Trash2, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { REPO_URL, type FeedbackKind } from '@shared/feedback'
import type { Settings } from '@shared/settings/schema'
import { common, settingsPage as t } from '@shared/strings'
import { friendlyAppName } from '@shared/tracking/apps'
import { CUSTOM_CATEGORY_COLORS } from '@shared/tracking/categorize'
import { siteLabel } from '@shared/tracking/sites'
import { AppPicker } from '../components/AppPicker'
import { Button } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { SettingRow, TextField } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { Segmented } from '../components/Segmented'
import { Stepper } from '../components/Stepper'
import { Toggle } from '../components/Toggle'
import { api } from '../lib/api'
import { useFmt } from '../lib/fmt'
import { updateSettings, useSnapshot } from '../lib/store'
import { useCatColor } from '../lib/tone'
import { useData } from '../lib/useData'
import { duration, ease } from '../motion'
import s from './Settings.module.css'

type Section = keyof typeof t.sections

function General({ settings }: { settings: Settings }): React.JSX.Element {
  const g = settings.general
  return (
    <Panel title={t.sections.general}>
      <SettingRow label={t.language} hint={t.languageHint}>
        <LanguageSwitch label={t.language} />
      </SettingRow>
      <Toggle
        label={t.launchAtStartup}
        hint={t.launchAtStartupHint}
        checked={g.launchAtStartup}
        onChange={(v) => void updateSettings({ general: { launchAtStartup: v } })}
      />
      <Toggle
        label={t.closeToTray}
        checked={g.closeToTray}
        onChange={(v) => void updateSettings({ general: { closeToTray: v } })}
      />
      {/* English always uses 0123; the choice is for Arabic. */}
      {g.language === 'ar' ? (
        <SettingRow label={t.digits}>
          <Segmented<'arab' | 'latn'>
            label={t.digits}
            size="sm"
            value={g.digits}
            onChange={(v) => void updateSettings({ general: { digits: v } })}
            options={[
              { value: 'arab', label: t.digitsArab },
              { value: 'latn', label: <span dir="ltr">{t.digitsLatn}</span> }
            ]}
          />
        </SettingRow>
      ) : null}
      <SettingRow label={t.clock}>
        <Segmented<'12h' | '24h'>
          label={t.clock}
          size="sm"
          value={g.clock}
          onChange={(v) => void updateSettings({ general: { clock: v } })}
          options={[
            { value: '12h', label: t.clock12 },
            { value: '24h', label: t.clock24 }
          ]}
        />
      </SettingRow>
    </Panel>
  )
}

function Appearance({ settings }: { settings: Settings }): React.JSX.Element {
  const a = settings.appearance
  const themes: Array<{ value: Settings['appearance']['theme']; label: string; swatch: string }> = [
    {
      value: 'sky',
      label: t.themeSky,
      swatch: 'linear-gradient(135deg, #3E4A89, #A7CDEA 45%, #E9B872 70%, #B5485D)'
    },
    { value: 'light', label: t.themeLight, swatch: 'linear-gradient(135deg, #CFE2F1, #F4F8FB)' },
    { value: 'dark', label: t.themeDark, swatch: 'linear-gradient(135deg, #0A1128, #1A2547)' }
  ]
  return (
    <Panel title={t.sections.appearance}>
      <div className={s.themes} role="radiogroup" aria-label={t.theme}>
        {themes.map((th) => (
          <button
            key={th.value}
            type="button"
            role="radio"
            aria-checked={a.theme === th.value}
            className={s.theme}
            data-active={a.theme === th.value || undefined}
            onClick={() => void updateSettings({ appearance: { theme: th.value } })}
            data-glow
          >
            <span className={s.themeSwatch} style={{ background: th.swatch }} />
            <span className={s.themeLabel}>{th.label}</span>
          </button>
        ))}
      </div>
      <p className={s.hint}>{t.themeSkyHint}</p>
      <Toggle
        label={t.reduceMotion}
        hint={t.reduceMotionHint}
        checked={a.reduceMotion}
        onChange={(v) => void updateSettings({ appearance: { reduceMotion: v } })}
      />
    </Panel>
  )
}

function Tracking({ settings }: { settings: Settings }): React.JSX.Element {
  const fmt = useFmt()
  const tr = settings.tracking
  const [picker, setPicker] = useState(false)
  const toggleExcluded = (p: string): void => {
    const next = tr.excludedApps.includes(p)
      ? tr.excludedApps.filter((x) => x !== p)
      : [...tr.excludedApps, p]
    void updateSettings({ tracking: { excludedApps: next } })
  }
  return (
    <Panel title={t.sections.tracking}>
      <Toggle
        label={t.pauseTracking}
        checked={tr.paused}
        onChange={(v) => void api.invoke('tracking:setPaused', { paused: v })}
      />
      <SettingRow label={t.idleAfter}>
        <Stepper
          label={t.idleAfter}
          value={tr.idleMinutes}
          min={1}
          max={30}
          format={(v) => fmt.minutes(v)}
          onChange={(v) => void updateSettings({ tracking: { idleMinutes: v } })}
        />
      </SettingRow>
      <Toggle
        label={t.storeTitles}
        hint={t.storeTitlesHint}
        checked={tr.storeTitles}
        onChange={(v) => void updateSettings({ tracking: { storeTitles: v } })}
      />
      <SettingRow label={t.retention}>
        <Segmented<string>
          label={t.retention}
          size="sm"
          value={String(tr.retentionDays)}
          onChange={(v) =>
            void updateSettings({ tracking: { retentionDays: Number(v) as 30 | 90 | 365 | 0 } })
          }
          options={[
            { value: '30', label: fmt.days(30) },
            { value: '90', label: fmt.days(90) },
            { value: '365', label: fmt.days(365) },
            { value: '0', label: t.forever }
          ]}
        />
      </SettingRow>
      <div className={s.block}>
        <div className={s.blockHead}>
          <span>{t.excluded}</span>
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus size={15} />}
            onClick={() => setPicker(true)}
          >
            {common.add}
          </Button>
        </div>
        {tr.excludedApps.length === 0 ? (
          <p className={s.hint}>{t.excludedEmpty}</p>
        ) : (
          <div className={s.tags}>
            {tr.excludedApps.map((p) => (
              <span key={p} className={s.tag}>
                <bdi>{friendlyAppName(p)}</bdi>
                <button
                  type="button"
                  className={s.tagRemove}
                  aria-label={`${common.remove} ${friendlyAppName(p)}`}
                  onClick={() => toggleExcluded(p)}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <AppPicker
        open={picker}
        onClose={() => setPicker(false)}
        title={t.excluded}
        selected={tr.excludedApps}
        onToggle={toggleExcluded}
      />
    </Panel>
  )
}

function Categories(): React.JSX.Element {
  const color = useCatColor()
  const data = useData(() => api.invoke('categories:get'), [])
  const [name, setName] = useState('')
  const [newColor, setNewColor] = useState<string>(CUSTOM_CATEGORY_COLORS[0]!)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const cats = data.data?.categories ?? []
  const rules = data.data?.rules ?? []
  const nameOf = (id: string): string => cats.find((c) => c.id === id)?.name ?? id

  const create = async (): Promise<void> => {
    const n = name.trim()
    if (!n) return
    await api.invoke('categories:create', { name: n, color: newColor })
    setName('')
    data.reload()
  }

  return (
    <Panel title={t.sections.categories}>
      <p className={s.hint}>{t.categoriesLead}</p>
      <ul className={s.catList}>
        {cats.map((c) => (
          <li key={c.id} className={s.catRow}>
            <span className={s.catSwatch} style={{ background: color(c.color) }} />
            <span className={s.catName}>{c.name}</span>
            {c.builtin ? (
              <span className={s.badge}>{t.builtin}</span>
            ) : (
              <span className={s.catActions}>
                {CUSTOM_CATEGORY_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={s.colorDot}
                    data-active={c.color.toUpperCase() === col.toUpperCase() || undefined}
                    style={{ background: color(col) }}
                    aria-label={t.categoryColor}
                    onClick={() =>
                      void api
                        .invoke('categories:update', { id: c.id, color: col })
                        .then(data.reload)
                    }
                  />
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={15} />}
                  aria-label={t.deleteCategory}
                  title={t.deleteCategory}
                  onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                />
              </span>
            )}
          </li>
        ))}
      </ul>

      <form
        className={s.newCat}
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <TextField
          label={t.newCategory}
          placeholder={t.categoryName}
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
        />
        <div className={s.colorPick} role="radiogroup" aria-label={t.categoryColor}>
          {CUSTOM_CATEGORY_COLORS.map((col) => (
            <button
              key={col}
              type="button"
              role="radio"
              aria-checked={newColor === col}
              aria-label={t.categoryColor}
              className={s.colorDot}
              data-active={newColor === col || undefined}
              style={{ background: color(col) }}
              onClick={() => setNewColor(col)}
            />
          ))}
        </div>
        <Button type="submit" variant="primary" icon={<Plus size={16} />} disabled={!name.trim()}>
          {common.add}
        </Button>
      </form>

      <h3 className={s.subTitle}>{t.rulesTitle}</h3>
      {rules.length === 0 ? (
        <p className={s.hint}>{t.rulesEmpty}</p>
      ) : (
        <ul className={s.rules}>
          {rules.map((r) => (
            <li key={`${r.kind}:${r.pattern}`} className={s.rule}>
              <span className={s.badge}>
                {r.kind === 'site' ? t.ruleSite : r.kind === 'app' ? t.ruleApp : t.rulePath}
              </span>
              <span className={s.rulePattern}>
                <bdi>
                  {r.kind === 'site'
                    ? siteLabel(r.pattern)
                    : r.kind === 'app'
                      ? friendlyAppName(r.pattern)
                      : r.pattern}
                </bdi>
              </span>
              <span className={s.ruleArrow} aria-hidden>
                ←
              </span>
              <span className={s.ruleCat}>{nameOf(r.categoryId)}</span>
              <Button
                size="sm"
                variant="ghost"
                icon={<X size={14} />}
                aria-label={common.remove}
                onClick={() =>
                  void api
                    .invoke('rules:delete', { kind: r.kind, pattern: r.pattern })
                    .then(data.reload)
                }
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        title={t.deleteCategory}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>{common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  void api.invoke('categories:delete', { id: confirmDelete.id }).then(data.reload)
                }
                setConfirmDelete(null)
              }}
            >
              {common.delete}
            </Button>
          </>
        }
      >
        <p>{confirmDelete ? t.deleteCategoryConfirm(confirmDelete.name) : ''}</p>
      </Dialog>
    </Panel>
  )
}

function Data(): React.JSX.Element {
  const fmt = useFmt()
  const counts = useData(() => api.invoke('data:counts'), [])
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')

  const exportAs = async (format: 'json' | 'csv'): Promise<void> => {
    const r = await api.invoke('data:export', { format })
    if (r.path) setMessage({ tone: 'ok', text: t.exported })
  }
  const importFile = async (): Promise<void> => {
    const r = await api.invoke('data:import')
    if (r.error === 'invalid') setMessage({ tone: 'error', text: t.importInvalid })
    else if (r.error) setMessage({ tone: 'error', text: t.importUnreadable })
    else if (r.imported) {
      const n = r.imported.intervals + r.imported.sessions + r.imported.prayers
      setMessage({ tone: 'ok', text: n > 0 ? t.imported(fmt.num(n)) : t.importNothing })
      counts.reload()
    }
  }
  const deleteAll = async (): Promise<void> => {
    await api.invoke('data:deleteAll', { confirm: 'DELETE' })
    setConfirm(false)
    setTyped('')
    setMessage({ tone: 'ok', text: t.deleted })
    counts.reload()
  }

  return (
    <Panel title={t.sections.data}>
      {counts.data ? (
        <p className={s.counts}>
          {t.dataCounts(
            fmt.num(counts.data.intervals),
            fmt.num(counts.data.sessions),
            fmt.num(counts.data.prayers)
          )}
        </p>
      ) : null}
      <p className={s.hint}>{t.exportHint}</p>
      <div className={s.actions}>
        <Button icon={<Download size={16} />} onClick={() => void exportAs('json')}>
          {t.exportJson}
        </Button>
        <Button icon={<Download size={16} />} onClick={() => void exportAs('csv')}>
          {t.exportCsv}
        </Button>
        <Button icon={<Upload size={16} />} onClick={() => void importFile()}>
          {t.importJson}
        </Button>
      </div>
      <AnimatePresence>
        {message ? (
          <motion.p
            key={message.text}
            className={s.message}
            data-tone={message.tone}
            role="status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
            exit={{ opacity: 0 }}
          >
            {message.text}
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div className={s.danger}>
        <Button
          variant="danger"
          icon={<Trash2 size={16} />}
          onClick={() => setConfirm(true)}
          data-testid="delete-all"
        >
          {t.deleteAll}
        </Button>
      </div>
      <Dialog
        open={confirm}
        onClose={() => {
          setConfirm(false)
          setTyped('')
        }}
        size="sm"
        title={t.deleteAllTitle}
        footer={
          <>
            <Button
              onClick={() => {
                setConfirm(false)
                setTyped('')
              }}
            >
              {common.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={typed.trim() !== t.deleteAllWord}
              onClick={() => void deleteAll()}
              data-testid="delete-all-confirm"
            >
              {t.deleteAllConfirm}
            </Button>
          </>
        }
      >
        <p className={s.dialogText}>{t.deleteAllBody}</p>
        <TextField
          label={t.deleteAllType}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          data-testid="delete-all-input"
        />
      </Dialog>
    </Panel>
  )
}

function About(): React.JSX.Element {
  const info = useData(() => api.invoke('app:info'), [])
  const [licenses, setLicenses] = useState(false)
  const [feedbackFailed, setFeedbackFailed] = useState(false)
  const i = info.data
  const feedback = (kind: FeedbackKind): void => {
    setFeedbackFailed(false)
    api.invoke('app:feedback', { kind }).catch(() => setFeedbackFailed(true))
  }
  return (
    <Panel title={t.sections.about}>
      <p className={s.offline}>{t.offline}</p>
      {i ? (
        <dl className={s.aboutList}>
          <div>
            <dt>{t.version}</dt>
            <dd className="num">
              <bdi>{i.version}</bdi>
            </dd>
          </div>
          <div>
            <dt>Electron</dt>
            <dd className="num">
              <bdi>
                {i.electron} · Chromium {i.chrome} · Node {i.node}
              </bdi>
            </dd>
          </div>
        </dl>
      ) : null}
      <div className={s.actions}>
        <Button
          icon={<FolderOpen size={16} />}
          onClick={() => void api.invoke('app:openFolder', { which: 'data' })}
        >
          {t.openData}
        </Button>
        <Button
          icon={<FolderOpen size={16} />}
          onClick={() => void api.invoke('app:openFolder', { which: 'logs' })}
        >
          {t.openLogs}
        </Button>
        <Button variant="ghost" onClick={() => setLicenses((v) => !v)} aria-expanded={licenses}>
          {t.licenses}
        </Button>
      </div>
      {licenses && i ? (
        <pre className={s.licenses} dir="ltr" tabIndex={0}>
          {i.licenses}
        </pre>
      ) : null}

      <h3 className={s.subTitle}>{t.feedbackTitle}</h3>
      <p className={s.hint}>{t.feedbackLead}</p>
      <div className={s.actions}>
        <Button
          icon={<Lightbulb size={16} />}
          onClick={() => feedback('idea')}
          data-testid="feedback-idea"
        >
          {t.suggestIdea}
        </Button>
        <Button icon={<Bug size={16} />} onClick={() => feedback('bug')} data-testid="feedback-bug">
          {t.reportProblem}
        </Button>
      </div>
      {feedbackFailed ? (
        <p className={s.hint} role="alert">
          {t.feedbackFailed}{' '}
          <bdi className={s.link} dir="ltr">
            {REPO_URL}/issues
          </bdi>
        </p>
      ) : null}
      <p className={s.hint}>{t.debugHint}</p>
    </Panel>
  )
}

export function SettingsPage(): React.JSX.Element {
  const snap = useSnapshot()
  const [section, setSection] = useState<Section>('general')
  const settings = snap.settings
  const sections: Section[] = ['general', 'appearance', 'tracking', 'categories', 'data', 'about']

  return (
    <div className={s.page}>
      <PageHeader title={t.title} />
      <div className={s.tabs}>
        <Segmented<Section>
          label={t.title}
          value={section}
          onChange={setSection}
          options={sections.map((v) => ({ value: v, label: t.sections[v] }))}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
          exit={{ opacity: 0, transition: { duration: duration.fast } }}
          className={s.section}
        >
          {section === 'general' ? (
            <General settings={settings} />
          ) : section === 'appearance' ? (
            <Appearance settings={settings} />
          ) : section === 'tracking' ? (
            <Tracking settings={settings} />
          ) : section === 'categories' ? (
            <Categories />
          ) : section === 'data' ? (
            <Data />
          ) : (
            <About />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
