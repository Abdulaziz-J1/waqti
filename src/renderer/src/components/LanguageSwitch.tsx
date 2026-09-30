import { LANGS, LANGUAGE_NAMES, type Lang } from '@shared/strings'
import { updateSettings, useSettings } from '../lib/store'
import { Segmented } from './Segmented'

/**
 * العربية / English. Each name is written in its own language and script, so
 * anyone can find theirs; switching turns the whole layout around.
 */
export function LanguageSwitch({
  label,
  size = 'sm'
}: {
  label: string
  size?: 'sm' | 'md'
}): React.JSX.Element {
  const current = useSettings().general.language
  return (
    <Segmented<Lang>
      label={label}
      size={size}
      value={current}
      onChange={(language) => void updateSettings({ general: { language } })}
      options={LANGS.map((l) => ({
        value: l,
        label: (
          <span lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} data-testid={`lang-${l}`}>
            {LANGUAGE_NAMES[l]}
          </span>
        )
      }))}
    />
  )
}
