import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { fadeUp } from '../motion'
import s from './Panel.module.css'

interface PanelProps {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Panels are the main content level: a surface with an edge light that follows the cursor. */
  tone?: 'default' | 'quiet'
  id?: string
}

export function Panel({
  title,
  actions,
  children,
  className,
  tone = 'default',
  id
}: PanelProps): React.JSX.Element {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      className={`${s.panel} ${tone === 'quiet' ? s.quiet : ''} ${className ?? ''}`}
      data-glow
      aria-labelledby={title && id ? `${id}-title` : undefined}
    >
      <span className={s.edge} aria-hidden />
      {title || actions ? (
        <header className={s.head}>
          {title ? (
            <h2 className={s.title} id={id ? `${id}-title` : undefined}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions ? <div className={s.actions}>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </motion.section>
  )
}
