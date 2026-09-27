import type { ReactNode } from 'react'
import s from './EmptyState.module.css'

interface EmptyStateProps {
  title?: ReactNode
  body: ReactNode
  action?: ReactNode
  art?: 'sky' | 'focus' | 'chart' | 'error'
}

/** Useful empty and error states: a quiet drawing, a plain sentence, one next step. */
export function EmptyState({
  title,
  body,
  action,
  art = 'sky'
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className={s.empty} role={art === 'error' ? 'alert' : undefined}>
      <svg className={s.art} viewBox="0 0 120 64" aria-hidden>
        {art === 'chart' ? (
          <g fill="currentColor">
            <rect x="20" y="36" width="12" height="20" rx="3" opacity=".35" />
            <rect x="40" y="26" width="12" height="30" rx="3" opacity=".5" />
            <rect x="60" y="16" width="12" height="40" rx="3" opacity=".7" />
            <rect x="80" y="30" width="12" height="26" rx="3" opacity=".45" />
          </g>
        ) : art === 'focus' ? (
          <g fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="60" cy="32" r="24" opacity=".3" />
            <circle cx="60" cy="32" r="14" opacity=".55" />
            <circle cx="60" cy="32" r="4" fill="currentColor" />
          </g>
        ) : art === 'error' ? (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 52 Q60 -4 100 52" opacity=".35" strokeDasharray="4 6" />
            <path d="M60 22 v14" />
            <circle cx="60" cy="44" r="1.5" fill="currentColor" />
          </g>
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 54 Q60 -6 108 54" opacity=".4" />
            <circle cx="42" cy="22" r="5" fill="currentColor" stroke="none" opacity=".8" />
            <path d="M6 54 H114" opacity=".25" />
          </g>
        )}
      </svg>
      {title ? <h3 className={s.title}>{title}</h3> : null}
      <p className={s.body}>{body}</p>
      {action ? <div className={s.action}>{action}</div> : null}
    </div>
  )
}
