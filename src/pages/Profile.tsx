import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/queries'
import Shell from '../components/Shell'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
}

export default function Profile() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useProfile()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name)
  }, [profile?.full_name])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving || !profile) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', profile.id)
    if (error) {
      setError('No pudimos guardar tu nombre.')
      setSaving(false)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['profile'] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    sessionStorage.clear()
    queryClient.clear()
    await supabase.auth.signOut()
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-') || k.startsWith('supabase')) localStorage.removeItem(k)
    })
    window.location.href = '/login'
  }

  if (isLoading) return <Shell><p className="empty-state">Cargando perfil…</p></Shell>

  return (
    <Shell>
      <Link className="back" to="/">← Volver</Link>
      <section className="form-page">
        <p className="eyebrow">TU PERFIL</p>
        <h1>Configura tu<br />nombre.</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
          <span className="group-icon large" style={{ width: 72, height: 72, fontSize: 24 }}>
            {initials(profile?.full_name)}
          </span>
          <div>
            <p style={{ fontWeight: 600, fontSize: 18, margin: 0 }}>{profile?.full_name || 'Sin nombre'}</p>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 0' }}>Tu nombre visible para el grupo</p>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 21 }}>
          <label>
            Nombre de usuario
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              maxLength={40}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && <p style={{ color: '#166534', fontSize: 13, margin: 0 }}>Nombre actualizado.</p>}
          <button className="primary-action" disabled={!name.trim() || saving}>
            {saving ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </form>

        <button
          onClick={handleLogout}
          style={{
            marginTop: 40, width: '100%', padding: 14, border: '1px solid var(--line)',
            borderRadius: 10, background: '#fff', fontSize: 14, fontWeight: 600,
            color: '#a22c20', cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </section>
    </Shell>
  )
}