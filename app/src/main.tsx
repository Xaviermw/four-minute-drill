import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initMonitoring } from './analytics/sentry.ts'

// No-ops locally; reports once Analytics is enabled in the Vercel dashboard.
inject()
// No-op unless VITE_SENTRY_DSN is set; lazy-loads Sentry off the initial bundle.
initMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
