import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element #root was not found')
}

type RootErrorBoundaryState = {
  error: Error | null
}

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="settings-app settings-app--error">
          <section className="settings-window">
            <span className="section-kicker">Startup error</span>
            <h2>Claude HUD One</h2>
            <p>Settings failed to render instead of showing a blank page.</p>
            <pre>{this.state.error.message}</pre>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(root).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
