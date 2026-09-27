import type { ReactNode } from 'react'
import s from './PageHeader.module.css'

interface PageHeaderProps {
  title: ReactNode
  sub?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, sub, actions }: PageHeaderProps): React.JSX.Element {
  return (
    <header className={s.header}>
      <div className={s.titles}>
        <h1 className={s.title}>{title}</h1>
        {sub ? <p className={s.sub}>{sub}</p> : null}
      </div>
      {actions ? <div className={s.actions}>{actions}</div> : null}
    </header>
  )
}
