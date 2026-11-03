import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Shell from '../components/Shell'
import { toUserMessage } from '../lib/errors'

export default function NewGroup() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data: groupId, error: groupError } = await supabase.rpc('create_group', {
        group_name: name.trim(),
      })
      if (groupError) throw groupError
      if (!groupId) throw new Error('Missing group id')
      nav(`/groups/${groupId}`)
    } catch (submitError) {
      setError(toUserMessage(submitError, 'No pudimos crear el grupo. Inténtalo de nuevo.'))
      setSaving(false)
    }
  }

  return (
    <Shell>
      <Link className="back" to="/">← Volver</Link>
      <section className="form-page">
        <p className="eyebrow">NUEVO GRUPO</p>
        <h1>Juntar gente<br />empieza aquí.</h1>
        <form onSubmit={submit}>
          <label>
            ¿Cómo se llama el grupo?
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Los del viernes" />
          </label>
          <p className="hint">Podrás invitar a tus amigos con un enlace después.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" disabled={!name.trim() || saving}>
            {saving ? 'Creando grupo…' : 'Crear grupo'}
          </button>
        </form>
      </section>
    </Shell>
  )
}
