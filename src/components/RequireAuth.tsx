import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'

export default function RequireAuth({ session, children }: { session: Session | null, children: ReactNode }) {
  const location = useLocation()
  if (session) return <>{children}</>
  if (location.pathname !== '/login' && location.pathname !== '/onboarding') {
    sessionStorage.setItem('pendingRedirect', location.pathname)
  }
  return <Navigate to="/login" replace />
}