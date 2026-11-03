import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { isRetryableError } from './lib/errors.ts'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => failureCount < 2 && isRetryableError(error),
      retryDelay: (attempt) => Math.min(750 * (2 ** attempt), 5000),
      refetchOnReconnect: true,
    },
    // Mutations are not retried globally: votes and destructive actions are not
    // guaranteed to be idempotent. Their screens expose an explicit retry.
    mutations: { retry: false },
  },
})
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>)
