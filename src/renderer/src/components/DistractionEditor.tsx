import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { common, focusPage as t } from '@shared/strings'
import { friendlyAppName } from '@shared/tracking/apps'
import { PRESET_DISTRACTION_SITES } from '@shared/tracking/detect'
import { siteLabel } from '@shared/tracking/sites'
import { updateSettings, useSettings } from '../lib/store'
import { AppPicker } from './AppPicker'
import { Button } from './Button'
import { Chip, TextField } from './Field'
import s from './DistractionEditor.module.css'

/** Quick edit of the distraction list: preset sites, extra title keywords, and apps. */
export function DistractionEditor(): React.JSX.Element {
  const { distractions } = useSettings()
  const [picker, setPicker] = useState(false)
  const [keyword, setKeyword] = useState('')

  const save = (patch: Partial<typeof distractions>): void => {
    void updateSettings({ distractions: patch })
  }
  const toggle = (list: string[], v: string): string[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

  const addKeyword = (): void => {
    const k = keyword.trim()
    if (!k || distractions.keywords.includes(k)) return
    save({ keywords: [...distractions.keywords, k] })
    setKeyword('')
  }

  return (
    <div className={s.root}>
      <p className={s.hint}>{t.distractionsHint}</p>

      <h3 className={s.title}>{t.sites}</h3>
      <div className={s.chips}>
        {PRESET_DISTRACTION_SITES.map((id) => (
          <Chip
            key={id}
            selected={distractions.sites.includes(id)}
            onToggle={() => save({ sites: toggle(distractions.sites, id) })}
          >
            <bdi>{siteLabel(id)}</bdi>
          </Chip>
        ))}
      </div>

      <h3 className={s.title}>{t.apps}</h3>
      <div className={s.chips}>
        {distractions.apps.map((p) => (
          <span key={p} className={s.tag}>
            <bdi>{friendlyAppName(p)}</bdi>
            <button
              type="button"
              className={s.remove}
              aria-label={`${common.remove} ${friendlyAppName(p)}`}
              onClick={() => save({ apps: distractions.apps.filter((x) => x !== p) })}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => setPicker(true)}>
          {t.addApp}
        </Button>
      </div>

      <h3 className={s.title}>{t.keywords}</h3>
      <div className={s.chips}>
        {distractions.keywords.map((k) => (
          <span key={k} className={s.tag}>
            <bdi>{k}</bdi>
            <button
              type="button"
              className={s.remove}
              aria-label={`${common.remove} ${k}`}
              onClick={() => save({ keywords: distractions.keywords.filter((x) => x !== k) })}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
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
        selected={distractions.apps}
        onToggle={(p) => save({ apps: toggle(distractions.apps, p) })}
      />
    </div>
  )
}
