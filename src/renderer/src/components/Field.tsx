import { motion } from 'motion/react'
import { Check, X } from 'lucide-react'
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
  /** Edit mode: a × badge takes the chip off the list. */
  onRemove?: () => void
  removeLabel?: string
}

/**
 * Selectable chip with a spring check mark. Chips pop in and out and the row
 * reflows smoothly (layout animations move them with transforms); in edit
 * mode they sway a little and carry a × badge.
 */
export function Chip({
  selected,
  onToggle,
  children,
  icon,
  onRemove,
  removeLabel
}: ChipProps): React.JSX.Element {
  return (
    <motion.span
      layout
      className={s.chipWrap}
      data-editing={onRemove ? true : undefined}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={spring.snappy}
    >
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
      {onRemove ? (
        <motion.button
          type="button"
          className={s.chipRemove}
          aria-label={removeLabel}
          onClick={onRemove}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={spring.snappy}
        >
          <X size={12} strokeWidth={3} />
        </motion.button>
      ) : null}
    </motion.span>
  )
}
