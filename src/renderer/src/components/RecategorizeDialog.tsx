import { Check } from 'lucide-react'
import type { ActivityTotal } from '@shared/tracking/aggregate'
import type { Category, Rule } from '@shared/tracking/categorize'
import { common, reports as t } from '@shared/strings'
import { api } from '../lib/api'
import { useCatColor } from '../lib/tone'
import { Button } from './Button'
import { Dialog } from './Dialog'
import s from './RecategorizeDialog.module.css'

interface Props {
  activity: ActivityTotal | null
  categories: Category[]
  rules: Rule[]
  onClose: () => void
}

/** Moves an app or site to another category. Rules apply at query time, so history updates too. */
export function RecategorizeDialog({
  activity,
  categories,
  rules,
  onClose
}: Props): React.JSX.Element {
  const color = useCatColor()
  const kind = activity?.site ? 'site' : 'app'
  const pattern = activity ? (activity.site ?? activity.process) : ''
  const userRule = rules.find(
    (r) => r.kind === kind && r.pattern.toLowerCase() === pattern.toLowerCase()
  )

  const choose = async (categoryId: string): Promise<void> => {
    if (!activity) return
    await api.invoke('rules:set', { kind, pattern, categoryId })
    onClose()
  }

  const reset = async (): Promise<void> => {
    if (!userRule) return
    await api.invoke('rules:delete', { kind: userRule.kind, pattern: userRule.pattern })
    onClose()
  }

  return (
    <Dialog
      open={activity !== null}
      onClose={onClose}
      size="sm"
      title={activity ? t.recategorizeTitle(activity.label) : ''}
      footer={
        <>
          {userRule ? (
            <Button variant="ghost" onClick={() => void reset()}>
              {t.resetRule}
            </Button>
          ) : null}
          <Button onClick={onClose}>{common.cancel}</Button>
        </>
      }
    >
      <p className={s.hint}>{t.recategorizeHint}</p>
      <ul className={s.list} role="listbox" aria-label={t.colCategory}>
        {categories.map((c) => {
          const current = activity?.categoryId === c.id
          return (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={current}
                className={s.option}
                data-current={current || undefined}
                onClick={() => void choose(c.id)}
              >
                <span className={s.swatch} style={{ background: color(c.color) }} />
                <span className={s.name}>{c.name}</span>
                {current ? <Check size={16} className={s.check} /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
