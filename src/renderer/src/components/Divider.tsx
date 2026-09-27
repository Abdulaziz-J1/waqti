import s from './Divider.module.css'

/**
 * A thin vertical rule between inline items. A middle dot would read like the
 * Arabic-Indic zero (٠) next to Arabic digits, so dates never use one.
 */
export function Divider(): React.JSX.Element {
  return <span className={s.divider} aria-hidden />
}
