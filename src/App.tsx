import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from './lib/supabase'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import NewGroup from './pages/NewGroup'
import Group from './pages/Group'
import NewPlan from './pages/NewPlan'
import NewWatchPlan from './pages/NewWatchPlan'
import Discover from './pages/Discover'
import EventDetail from './pages/EventDetail'
import Members from './pages/Members'
import Plan from './pages/Plan'
import WatchRoom from './pages/WatchRoom'
import InviteAccept from './pages/InviteAccept'
import Join from './pages/Join'
import './App.css'

function RequireOnboarding({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase.from('profiles').select('onboarded').eq('id', user.id).single()
      return data
    },
    staleTime: 300000,
  })
  if (isLoading) return <div className='loading'>Cargando JuntApp…</div>
  if (profile && !profile.onboarded) return <Navigate to='/onboarding' replace />
  return <>{children}</>
}

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => subscription.unsubscribe()
  }, [])
  if (loading) return <div className='loading'>Cargando JuntApp…</div>
  return (
    <Routes>
      <Route path='/login' element={<Login session={session} />} />
      <Route path='/onboarding' element={<RequireAuth session={session}><Onboarding /></RequireAuth>} />
      <Route path='/profile' element={<RequireAuth session={session}><RequireOnboarding><Profile /></RequireOnboarding></RequireAuth>} />
      <Route path='/' element={<RequireAuth session={session}><RequireOnboarding><Dashboard /></RequireOnboarding></RequireAuth>} />
      <Route path='/groups/new' element={<RequireAuth session={session}><RequireOnboarding><NewGroup /></RequireOnboarding></RequireAuth>} />
        <Route path='/groups/:groupId' element={<RequireAuth session={session}><RequireOnboarding><Group /></RequireOnboarding></RequireAuth>} />
        <Route path='/groups/:groupId/members' element={<RequireAuth session={session}><RequireOnboarding><Members /></RequireOnboarding></RequireAuth>} />
        <Route path='/groups/:groupId/plans/new' element={<RequireAuth session={session}><RequireOnboarding><NewPlan /></RequireOnboarding></RequireAuth>} />
        <Route path='/groups/:groupId/discover' element={<RequireAuth session={session}><RequireOnboarding><Discover /></RequireOnboarding></RequireAuth>} />
        <Route path='/detalle/:kind/:slug' element={<RequireAuth session={session}><RequireOnboarding><EventDetail /></RequireOnboarding></RequireAuth>} />
        <Route path='/groups/:groupId/watch/new' element={<RequireAuth session={session}><RequireOnboarding><NewWatchPlan /></RequireOnboarding></RequireAuth>} />
        <Route path='/plans/:planId' element={<RequireAuth session={session}><RequireOnboarding><Plan /></RequireOnboarding></RequireAuth>} />
        <Route path='/watch/:roomId' element={<RequireAuth session={session}><RequireOnboarding><WatchRoom /></RequireOnboarding></RequireAuth>} />
      <Route path='/invite/:token' element={<RequireAuth session={session}><InviteAccept /></RequireAuth>} />
      <Route path='/join' element={<RequireAuth session={session}><RequireOnboarding><Join /></RequireOnboarding></RequireAuth>} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}