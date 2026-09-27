import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { spring } from '../motion'
import s from './Field.module.css'

/** A labelled settings row: text on the start side, the control on the end side. */
export function SettingRow({
  label,
  hint,
  children
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className={s.row}>
      <div className={s.text}>
        <span className={s.label}>{label}</span>
        {hint ? <span className={s.hint}>{hint}</span> : null}
      </div>
      <div className={s.control}>{children}</div>
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
}

/** Text input with an animated focus ring. Numbers and Latin text are isolated with dir="auto". */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, className, ...rest },
  ref
) {
  const id = useId()
  return (
    <label className={`${s.field} ${className ?? ''}`} htmlFor={id}>
      <span className={s.fieldLabel}>{label}</span>
      <span className={s.inputWrap} data-error={error ? true : undefined}>
        <input
          ref={ref}
          id={id}
          dir="auto"
          className={s.input}
          aria-invalid={Boolean(error)}
          {...rest}
        />
      </span>
    </label>
  )
})

interface ChipProps {
  selected: boolean
  onToggle: () => void
  children: ReactNode
  icon?: ReactNode
}

/** Selectable chip with a spring check mark. */
export function Chip({ selected, onToggle, children, icon }: ChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={s.chip}
      data-selected={selected || undefined}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {icon}
      <span className={s.chipLabel}>{children}</span>
      <motion.span
        className={s.check}
        initial={false}
        animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
        transition={spring.snappy}
        aria-hidden
      >
        <Check size={12} strokeWidth={3} />
      </motion.span>
    </button>
  )
}
