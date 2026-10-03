import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCurrentUser, useProfile } from '../lib/queries'

export default function Onboarding() {
  const nav = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (profileLoading) return <div className='loading'>Cargando JuntApp…</div>
  if (profile?.onboarded) {
    const pending = sessionStorage.getItem('pendingRedirect')
    sessionStorage.removeItem('pendingRedirect')
    return <Navigate to={pending || '/'} replace />
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving || !user) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: name.trim(), onboarded: true }, { onConflict: 'id' })
    if (error) {
      setError('No pudimos guardar tu nombre. Inténtalo de nuevo.')
      setSaving(false)
      return
    }
    queryClient.setQueryData(['profile'], (old: any) => ({ ...old, onboarded: true }))
    await queryClient.invalidateQueries({ queryKey: ['profile'] })
    const pending = sessionStorage.getItem('pendingRedirect')
    sessionStorage.removeItem('pendingRedirect')
    nav(pending || '/', { replace: true })
  }

  return (
    <div className="login" style={{ background: '#1a1a2e' }}>
      <div className="login-content" style={{ maxWidth: 400 }}>
        <p className="brand" style={{ fontSize: 48, margin: '0 0 40px' }}>junt<span style={{ color: '#65a838' }}>·</span></p>
        <p className="eyebrow" style={{ color: '#a0aec0' }}>BIENVENIDO A JUNTAPP</p>
        <h1 style={{ fontSize: '42px', margin: '0 0 10px' }}>¿Cómo te llamas?</h1>
        <p style={{ color: '#a0aec0', marginBottom: 36, lineHeight: 1.5 }}>
          Este nombre lo verán tus amigos cuando te unes a grupos y planes.
        </p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 20 }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            maxLength={40}
            style={{
              width: '100%', padding: '16px 14px', border: '1px solid #4a5568',
              borderRadius: 8, background: '#2d3748', color: '#fff', fontSize: 16,
              outlineColor: '#65a838',
            }}
          />
          {error && <p style={{ color: '#fc8181', fontSize: 13, margin: 0 }}>{error}</p>}
          <button
            className="primary-action"
            disabled={!name.trim() || saving}
            style={{ fontSize: 16 }}
          >
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}