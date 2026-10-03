import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

export default function Login({ session }: { session: Session | null }) {
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const pending = sessionStorage.getItem('pendingRedirect')
    if (pending) {
      nav(pending, { replace: true })
    }
  }, [session, nav])

  async function signIn() {
    if (!supabaseConfigured) return
    setError(null)
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (authError) setError('No pudimos iniciar sesión. Inténtalo de nuevo.')
  }

  const pending = sessionStorage.getItem('pendingRedirect')
  if (session && !pending) return <Navigate to="/" replace />
  if (session) return null
  return (
    <div className="login">
      <div className="login-content">
        <p className="brand">junt<span>·</span></p>
        <p className="eyebrow">MENOS MENSAJES. MÁS PLANES.</p>
        <h1>Junta a tu gente.</h1>
        <p>Decidan qué hacer, quién va y dónde se ven. Sin perder el hilo del grupo.</p>
        <button className="google" onClick={signIn} disabled={!supabaseConfigured}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg> <span>Continuar con Google</span>
        </button>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {!supabaseConfigured && (
          <p className="demo-note">
            Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local para activar Google.
          </p>
        )}
      </div>
    </div>
  )
}
