import { useState } from 'react'
import { common, focusPage as t } from '@shared/strings'
import { EXTRA_DISTRACTION_SITES, type SiteInput, siteFromInput } from '@shared/tracking/detect'
import { siteLabel } from '@shared/tracking/sites'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { TextField } from './Field'
import { Switch } from './Toggle'
import s from './SitePicker.module.css'

interface SitePickerProps {
  open: boolean
  onClose: () => void
  /** Known site ids already on the list. */
  selected: string[]
  onToggle: (id: string) => void
  onAdd: (site: SiteInput) => void
}

/** More known sites, each with a switch, and a field for any other site. */
export function SitePicker({
  open,
  onClose,
  selected,
  onToggle,
  onAdd
}: SitePickerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = (): void => {
    const site = siteFromInput(text)
    if (!site) {
      setError(t.siteInvalid)
      return
    }
    onAdd(site)
    setText('')
    setError(null)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.pickSite}
      footer={
        <Button variant="primary" onClick={onClose}>
          {common.done}
        </Button>
      }
    >
      <ul className={s.list}>
        {EXTRA_DISTRACTION_SITES.map((id) => (
          <li key={id} className={s.item}>
            <span className={s.name}>
              <bdi>{siteLabel(id)}</bdi>
            </span>
            <Switch
              checked={selected.includes(id)}
              label={siteLabel(id)}
              onChange={() => onToggle(id)}
            />
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
        <Button type="submit" variant="secondary" disabled={!text.trim()}>
          {common.add}
        </Button>
      </form>
      <p className={error ? s.error : s.hint} role={error ? 'alert' : undefined}>
        {error ?? t.otherSiteHint}
      </p>
    </Dialog>
  )
}
