import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px', color: '#fff', fontFamily: 'monospace', background: '#0D1321', minHeight: '100vh' }}>
          <h2 style={{ color: '#FF3621' }}>Something went wrong</h2>
          <pre style={{ color: '#aaa', whiteSpace: 'pre-wrap', marginTop: 16 }}>
            {(this.state.error as Error).message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 24, padding: '8px 20px', background: '#FF3621', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
