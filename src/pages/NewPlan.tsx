import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Shell from '../components/Shell'

async function notifyMembers(planId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) return
    await fetch(`${supabaseUrl}/functions/v1/notify-new-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({ planId }),
    })
  } catch (e) {
    console.warn('[notify-new-plan] fallo', e)
  }
}

const cardBase: React.CSSProperties = {
  flex: 1, padding: '16px 14px', borderRadius: 10, cursor: 'pointer', userSelect: 'none',
  border: '1px solid #d9ddd4', background: '#fff', transition: 'all .15s',
}

const cardActive: React.CSSProperties = {
  border: '1px solid #28533a', background: '#f0f7f0',
}

export default function NewPlan() {
  const nav = useNavigate()
  const { groupId = '' } = useParams()
  const [planType, setPlanType] = useState<'physical' | 'watch_party'>('physical')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [options, setOptions] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('junte_prefill')
    if (raw) {
      try {
        const p = JSON.parse(raw) as { title: string; description: string; scheduledAt?: string }
        if (p.title) setTitle(p.title)
        if (p.description) setDescription(p.description)
        if (p.scheduledAt) setScheduledAt(p.scheduledAt)
        sessionStorage.removeItem('junte_prefill')
      } catch { /* ignore */ }
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !scheduledAt || saving) return
    const optionTitles = options.split('\n').map((o) => o.trim()).filter(Boolean)
    setSaving(true)
    setError(null)
    const { data: planId, error: rpcError } = await supabase.rpc('create_plan', {
      target_group_id: groupId,
      plan_title: title.trim(),
      plan_scheduled_at: new Date(scheduledAt).toISOString(),
      option_titles: optionTitles,
      plan_type: planType,
    })
    if (rpcError || !planId) {
      setError('No pudimos publicar el plan. Inténtalo de nuevo.')
      setSaving(false)
      return
    }
    notifyMembers(planId as string)
    nav(`/plans/${planId}`)
  }

  return (
    <Shell>
      <Link className="back" to={`/groups/${groupId}`}>← Volver al grupo</Link>
      <section className="form-page">
        <p className="eyebrow">NUEVO PLAN</p>
        <h1>Que empiece<br />la decisión.</h1>
        <form onSubmit={submit}>
          <label>Tipo de plan</label>
          <div style={{ display: 'flex', gap: 10, marginTop: -5 }}>
            <div
              onClick={() => setPlanType('physical')}
              style={planType === 'physical' ? { ...cardBase, ...cardActive } : cardBase}
            >
              <span style={{ fontSize: 22 }}>📍</span>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#18261f' }}>Salida presencial</strong>
              <small style={{ display: 'block', marginTop: 3, color: '#69746d', fontSize: 12, lineHeight: 1.4 }}>
                Cena, tragos, cine, playa, deportes
              </small>
            </div>
            <div
              onClick={() => setPlanType('watch_party')}
              style={planType === 'watch_party' ? { ...cardBase, ...cardActive } : cardBase}
            >
              <span style={{ fontSize: 22 }}>🎬</span>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#18261f' }}>Watch Party</strong>
              <small style={{ display: 'block', marginTop: 3, color: '#69746d', fontSize: 12, lineHeight: 1.4 }}>
                Compartan pantalla, vean videos o hagan streaming juntos
              </small>
            </div>
          </div>

          {planType === 'physical' ? (
            <>
              <label>
                ¿Qué quieren hacer?
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Cena o tragos" />
              </label>
              <label>
                ¿Cuándo?
                <input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </label>
              <label>
                Opciones (opcional)
                <textarea value={options} onChange={(e) => setOptions(e.target.value)} placeholder={'Restaurante\nBar\nCafé'} />
              </label>
              <p className="hint">Si no añades opciones, el plan queda confirmado directo. Si añades opciones, el grupo vota.</p>
            </>
          ) : (
            <>
              <label>
                Nombre de la actividad
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Ver Spiderman" />
              </label>
              <label>
                ¿Cuándo?
                <input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </label>
              <label>
                Descripción (opcional)
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué van a ver o hacer…" />
              </label>
              <div style={{ background: '#eef6ee', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🎬</span>
                <small style={{ color: '#28533a', fontSize: 13, lineHeight: 1.5 }}>
                  Se creará automáticamente una sala virtual para compartir pantalla, audio y chat durante el evento.
                </small>
              </div>
            </>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" disabled={!title.trim() || !scheduledAt || saving}>
            {saving ? 'Publicando…' : 'Publicar plan'}
          </button>
        </form>
        {/* <div style={{ marginTop: 24 }}>
          <Recommendations
            groupId={groupId}
            onSelect={(item) => {
              const isMovie = (item as { kind: string }).kind === 'cine'
              const slug = (item as { slug: string }).slug || (item as { external_id: string }).external_id
              nav(`/detalle/${isMovie ? 'cine' : 'evento'}/${slug}`, { state: { item, groupId } })
            }}
          />
          <p className="hint" style={{ marginTop: 8 }}>
            Tocando una tarjeta verás dirección y descripción completa. También puedes <Link to={`/groups/${groupId}/discover`}>abrir el descubridor completo</Link>.
          </p>
        </div> */}
      </section>
    </Shell>
  )
}
