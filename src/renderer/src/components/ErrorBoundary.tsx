import { Component, type ErrorInfo, type ReactNode } from 'react'
import { errorScreen } from '@shared/strings'
import s from './ErrorBoundary.module.css'

interface State {
  error: Error | null
  showDetails: boolean
}

/** Arabic recovery screen instead of a white window when rendering fails. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, showDetails: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('render error', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error, showDetails } = this.state
    if (!error) return this.props.children
    return (
      <div className={s.screen} role="alert">
        <div className={s.card}>
          <svg viewBox="0 0 120 64" className={s.art} aria-hidden>
            <path
              d="M12 54 Q60 -6 108 54"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity=".4"
            />
            <circle cx="60" cy="30" r="6" fill="currentColor" opacity=".8" />
          </svg>
          <h1 className={s.title}>{errorScreen.title}</h1>
          <p className={s.body}>{errorScreen.body}</p>
          <div className={s.actions}>
            <button type="button" className={s.primary} onClick={() => window.location.reload()}>
              {errorScreen.reload}
            </button>
            <button
              type="button"
              className={s.link}
              onClick={() => this.setState({ showDetails: !showDetails })}
            >
              {errorScreen.details}
            </button>
          </div>
          {showDetails ? (
            <pre className={s.details} dir="ltr">
              {error.name}: {error.message}
            </pre>
          ) : null}
        </div>
      </div>
    )
  }
}
