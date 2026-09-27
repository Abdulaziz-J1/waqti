import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OverlayApp } from './overlay/OverlayApp'

const kind = new URLSearchParams(window.location.search).get('kind')
if (kind === 'guard') {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <OverlayApp />
      </ErrorBoundary>
    </StrictMode>
  )
}
