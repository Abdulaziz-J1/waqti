import { useState } from 'react'
import { common, focusPage as t } from '@shared/strings'
import {
  EXTRA_DISTRACTION_SITES,
  PRESET_DISTRACTION_SITES,
  siteFromInput
} from '@shared/tracking/detect'
import {
  type Distractions,
  addChip,
  addOutcome,
  chipsOf,
  removeChip,
  shownPresets
} from '@shared/tracking/distractions'
import { siteLabel } from '@shared/tracking/sites'
import { useFlash } from '../lib/flash'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { TextField } from './Field'
import { FlashNote } from './FlashNote'
import { Switch } from './Toggle'
import s from './SitePicker.module.css'

interface SitePickerProps {
  open: boolean
  onClose: () => void
  distractions: Distractions
  save: (patch: Partial<Distractions>) => void
}

/**
 * Known sites with a switch each (more sites, and any preset taken off the
 * list), and a field for any other site. It stays open after each add and
 * says what happened: added, already there, or switched back on.
 */
export function SitePicker({
  open,
  onClose,
  distractions: d,
  save
}: SitePickerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [flash, show] = useFlash()
  // Presets brought back here stay in the list until the dialog closes.
  const [revived, setRevived] = useState<string[]>([])
  const shown = shownPresets(d)
  const listed = chipsOf(d, 'sites')
  const onList = (id: string): boolean => listed.includes(id) || shown.includes(id)
  const offered = [
    ...PRESET_DISTRACTION_SITES.filter((id) => !shown.includes(id) || revived.includes(id)),
    ...EXTRA_DISTRACTION_SITES
  ]
  const close = (): void => {
    setRevived([])
    onClose()
  }

  const add = (): void => {
    const site = siteFromInput(text)
    if (!site) {
      setError(t.siteInvalid)
      return
    }
    const kind = site.kind === 'known' ? 'sites' : 'customSites'
    const value = site.kind === 'known' ? site.id : site.name
    const name = site.kind === 'known' ? siteLabel(site.id) : site.name
    const outcome = addOutcome(d, kind, value)
    if (
      kind === 'sites' &&
      outcome === 'added' &&
      PRESET_DISTRACTION_SITES.some((p) => p === value)
    )
      setRevived((r) => [...r, value])
    if (outcome !== 'exists') save(addChip(d, kind, value))
    show(
      outcome === 'added'
        ? t.added(name)
        : outcome === 'enabled'
          ? t.switchedOn(name)
          : t.alreadyThere(name),
      outcome === 'exists' ? 'info' : 'ok'
    )
    setText('')
    setError(null)
  }

  const toggle = (id: string): void => {
    if (onList(id)) {
      save(removeChip(d, 'sites', id))
      show(t.removedItem(siteLabel(id)), 'info')
    } else {
      if (!shown.includes(id)) setRevived((r) => (r.includes(id) ? r : [...r, id]))
      save(addChip(d, 'sites', id))
      show(t.added(siteLabel(id)))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.pickSite}
      footer={
        <>
          <FlashNote flash={flash} className={s.flash} />
          <Button variant="primary" onClick={close}>
            {common.done}
          </Button>
        </>
      }
    >
      <ul className={s.list}>
        {offered.map((id) => (
          <li key={id} className={s.item}>
            <span className={s.name}>
              <bdi>{siteLabel(id)}</bdi>
            </span>
            <Switch checked={onList(id)} label={siteLabel(id)} onChange={() => toggle(id)} />
          </li>
        ))}
      </ul>
      <form
        className={s.other}
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <TextField
          label={t.otherSite}
          className={s.field}
          placeholder={t.otherSitePlaceholder}
          value={text}
          maxLength={200}
          error={error}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          data-testid="site-input"
        />
        <Button
          type="submit"
          variant="primary"
          className={s.addButton}
          disabled={!text.trim()}
          data-testid="site-add"
        >
          {common.add}
        </Button>
      </form>
      <p className={error ? s.error : s.hint} role={error ? 'alert' : undefined}>
        {error ?? t.otherSiteHint}
      </p>
    </Dialog>
  )
}
