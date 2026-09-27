import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import s from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'onSky'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  block?: boolean
}

/**
 * Buttons lift 1–2 px on hover with a soft highlight that follows the cursor,
 * press to 0.97, and animate their focus ring in.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    block,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      data-glow
      className={[s.btn, s[variant], s[size], block ? s.block : '', className ?? ''].join(' ')}
      {...rest}
    >
      <span className={s.glow} aria-hidden />
      {icon ? <span className={s.icon}>{icon}</span> : null}
      {children !== undefined ? <span className={s.label}>{children}</span> : null}
    </button>
  )
})
