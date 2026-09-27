import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initStore } from './lib/store'
import { installPointerEffects } from './lib/pointer'
import './lib/visibility'

async function boot(): Promise<void> {
  const root = document.getElementById('root')
  if (!root) return
  installPointerEffects()
  await initStore()
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
}

void boot()
