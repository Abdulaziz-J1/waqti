import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { spring } from '../motion'
import s from './Toggle.module.css'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
}

/** Switch with a spring knob. In RTL the knob rests on the right when off. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled
}: ToggleProps): React.JSX.Element {
  const id = useId()
  return (
    <div className={s.row}>
      <div className={s.text}>
        <label htmlFor={id} className={s.label}>
          {label}
        </label>
        {hint ? <span className={s.hint}>{hint}</span> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={s.track}
        data-on={checked || undefined}
        onClick={() => onChange(!checked)}
      >
        <motion.span className={s.knob} layout transition={spring.snappy} />
      </button>
    </div>
  )
}

/** A bare switch for tables (labelled through aria-label). */
export function Switch({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={s.track}
      data-on={checked || undefined}
      onClick={() => onChange(!checked)}
    >
      <motion.span className={s.knob} layout transition={spring.snappy} />
    </button>
  )
}
