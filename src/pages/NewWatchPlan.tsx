import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Shell from '../components/Shell'
import { toUserMessage } from '../lib/errors'
import { requestPlanNotification } from '../lib/notifications'

export default function NewWatchPlan() {
  const nav = useNavigate()
  const { groupId = '' } = useParams()
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !scheduledAt || saving) return
    setSaving(true)
    setError(null)
    try {
      const { data: planId, error: rpcError } = await supabase.rpc('create_virtual_plan', {
        target_group_id: groupId,
        plan_title: title.trim(),
        plan_scheduled_at: new Date(scheduledAt).toISOString(),
      })
      if (rpcError) throw rpcError
      if (!planId) throw new Error('Missing plan id')
      void requestPlanNotification(planId as string)
      nav(`/plans/${planId}`)
    } catch (submitError) {
      setError(toUserMessage(submitError, 'No pudimos crear la sala virtual. Inténtalo de nuevo.'))
      setSaving(false)
    }
  }

  return (
    <Shell>
      <Link className="back" to={`/groups/${groupId}`}>← Volver al grupo</Link>
      <section className="form-page">
        <p className="eyebrow">SALA VIRTUAL</p>
        <h1>Comparte pantalla<br />con tu grupo.</h1>
        <form onSubmit={submit}>
          <label>
            Título
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Movie Night" />
          </label>
          <label>
            ¿Cuándo?
            <input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" disabled={!title.trim() || !scheduledAt || saving}>
            {saving ? 'Creando…' : 'Crear sala virtual'}
          </button>
        </form>
      </section>
    </Shell>
  )
}
