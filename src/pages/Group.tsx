import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../lib/queries'
import Shell from '../components/Shell'
import BottomNav from '../components/BottomNav'
import InviteSection from '../components/InviteSection'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
}

function relativeTime(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays > 0) return diffDays === 1 ? 'Mañana' : 'En ' + diffDays + ' dí' + (diffDays > 1 ? 'as' : 'a')
  if (diffDays === 0) {
    if (diffHours > 0) return 'En ' + diffHours + 'h'
    if (diffMins > 0) return 'En ' + diffMins + 'min'
    return 'Ahora'
  }
  if (diffDays === -1) return 'Ayer'
  return 'Hace ' + Math.abs(diffDays) + ' dí' + (Math.abs(diffDays) > 1 ? 'as' : 'a')
}

function formatDateTime(dateStr: string) {
  return new Intl.DateTimeFormat('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(dateStr))
}

function formatDateShort(dateStr: string) {
  return new Intl.DateTimeFormat('es-DO', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(dateStr))
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' }).format(new Date(dateStr))
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  voting: { label: 'Votación', color: '#b45309', bg: '#fef3c7' },
  confirmed: { label: 'Confirmado', color: '#166534', bg: '#dcfce7' },
  completed: { label: 'Listo', color: '#374151', bg: '#f3f4f6' },
  cancelled: { label: 'Cancelado', color: '#991b1b', bg: '#fee2e2' },
}

export default function Group() {
  const { groupId = '' } = useParams()
  const nav = useNavigate()
  const { data: user } = useCurrentUser()
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data: group, error: ge } = await supabase
        .from('groups').select('id, name, created_by').eq('id', groupId).single()
      if (ge) throw ge
      const { data: members, error: me } = await supabase
        .from('group_members').select('user_id, role, joined_at, profiles(id, full_name, avatar_url)')
        .eq('group_id', groupId)
      if (me) throw me
      const { data: plans, error: pe } = await supabase
        .from('plans').select('id, title, scheduled_at, status, created_by, selected_option_id, plan_type')
        .eq('group_id', groupId).order('scheduled_at')
      if (pe) throw pe

      const planIds = (plans || []).map((p: any) => p.id)
      let participantCounts: Record<string, number> = {}
      if (planIds.length > 0) {
        const { data: participants } = await supabase
          .from('plan_participants').select('plan_id').in('plan_id', planIds).eq('attendance_status', 'going')
        if (participants) {
          participants.forEach((p: any) => {
            participantCounts[p.plan_id] = (participantCounts[p.plan_id] || 0) + 1
          })
        }
      }

      return { group, members: members || [], plans: plans || [], participantCounts }
    },
  })

  const genInvite = useMutation({
    mutationFn: async () => {
      const { data: token, error } = await supabase.rpc('create_invite', { target_group_id: groupId })
      if (error) throw error
      return token as string
    },
    onSuccess: (token) => setInviteLink(window.location.origin + '/invite/' + token),
  })

  if (isLoading) return <Shell><p className="empty-state">Cargando grupo…</p></Shell>
  if (isError || !data?.group) return (
    <Shell>
      <Link className="back" to="/">← Todos los grupos</Link>
      <p className="empty-state">No pudimos abrir este grupo.</p>
    </Shell>
  )

  const { group, members, plans, participantCounts } = data
  const isOwner = user?.id === group.created_by
  const now = new Date()
  const upcoming = plans.filter((p: any) => new Date(p.scheduled_at) >= now)
  const past = plans.filter((p: any) => new Date(p.scheduled_at) < now)
  const completedCount = plans.filter((p: any) => p.status === 'completed').length
  const nextPlan = upcoming[0]

  return (
    <Shell>
      <Link className="back" to="/">← Todos los grupos</Link>
      <section className="group-title">
        <span className="group-icon large">{initials(group.name)}</span>
        <div>
          <p className="eyebrow">TU GRUPO</p>
          <h1>{group.name}</h1>
        </div>
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, fontSize: 13, color: '#69746d' }}>
        <span>{upcoming.length > 0 ? '🔥' : '😴'}</span>
        <span style={{ fontWeight: 600, color: '#18261f' }}>{members.length} miembro{members.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span style={{ fontWeight: 600, color: '#18261f' }}>{upcoming.length} planes pendientes{upcoming.length !== 1 ? 's' : ''}</span>
        {completedCount > 0 && (
          <><span>·</span><span>{completedCount} completado{completedCount !== 1 ? 's' : ''}</span></>
        )}
      </div>

      {nextPlan && (
        <Link to={'/plans/' + nextPlan.id} style={{ textDecoration: 'none', display: 'block', marginBottom: 32 }}>
          <div style={{
            background: 'linear-gradient(135deg, #f0f7f0 0%, #e8efdf 100%)',
            borderRadius: 14, padding: '20px 22px',
            border: '1px solid #d0dfc0',
          }}>
            <p style={{ font: '11px DM Mono,monospace', letterSpacing: '.08em', color: '#28533a', margin: '0 0 8px' }}>
              🎯 PRÓXIMO JUNTE
            </p>
            <h3 style={{ font: '600 24px/1.1 Fraunces,serif', letterSpacing: '-1px', color: '#18261f', margin: '0 0 6px' }}>
              {nextPlan.title}
            </h3>
            <p style={{ fontSize: 14, color: '#28533a', margin: 0 }}>
              {formatDateShort(nextPlan.scheduled_at)} · {formatTime(nextPlan.scheduled_at)}
            </p>
            {(participantCounts[nextPlan.id] || 0) > 0 && (
              <p style={{ fontSize: 13, color: '#69746d', margin: '4px 0 0' }}>
                {participantCounts[nextPlan.id]} asistente{participantCounts[nextPlan.id] !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </Link>
      )}

      <section className="section-heading" style={{ marginTop: 0 }}>
        <div><p className="eyebrow">CRONOGRAMA</p><h2>Planes</h2></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to={'/groups/' + groupId + '/discover'} style={{ background: '#f0f7f0', color: '#28533a', padding: '10px 14px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', border: '1px solid #d9ddd4' }}>✨ Descubrir</Link>
          <Link to={'/groups/' + groupId + '/plans/new'} style={{ background: '#28533a', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>+ Plan</Link>
        </div>
      </section>

      {plans.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 28 }}>
          <strong>Aún no hay planes.</strong>
          <span>Crea el primero para que el grupo empiece a coordinar.</span>
        </div>
      ) : (
        <div className="timeline" style={{ marginBottom: 32 }}>
          {upcoming.length > 0 && (
            <div className="timeline-section">
              {upcoming.map((plan: any) => {
                const st = statusConfig[plan.status] || statusConfig.voting
                const going = participantCounts[plan.id] || 0
                return (
                  <Link className="timeline-item" to={'/plans/' + plan.id} key={plan.id}>
                    <div className="timeline-dot" style={{ background: st.bg, borderColor: st.color }}></div>
                    <div className="timeline-line"></div>
                    <div className="timeline-card">
                      <div className="timeline-card-top">
                        <span className="timeline-date">{formatDateTime(plan.scheduled_at)}</span>
                        <span className="timeline-relative">{relativeTime(plan.scheduled_at)}</span>
                      </div>
                      <h3 className="timeline-title">{plan.title}</h3>
                      <div className="timeline-card-bottom">
                        <span className="timeline-status" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                        {plan.plan_type === 'watch_party' && <span className="timeline-status" style={{ color: '#1e40af', background: '#dbeafe' }}>🎬 Watch</span>}
                        {going > 0 && <span className="timeline-going">{going} {going === 1 ? 'asiste' : 'asisten'}</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {past.length > 0 && (
            <div className="timeline-section timeline-past">
              <p className="timeline-section-label">Anteriores</p>
              {past.slice(0, 5).map((plan: any) => {
                const st = statusConfig[plan.status] || statusConfig.completed
                const going = participantCounts[plan.id] || 0
                return (
                  <Link className="timeline-item" to={'/plans/' + plan.id} key={plan.id} style={{ opacity: 0.6 }}>
                    <div className="timeline-dot" style={{ background: st.bg, borderColor: st.color }}></div>
                    <div className="timeline-line"></div>
                    <div className="timeline-card">
                      <div className="timeline-card-top">
                        <span className="timeline-date">{formatDateTime(plan.scheduled_at)}</span>
                        <span className="timeline-relative">{relativeTime(plan.scheduled_at)}</span>
                      </div>
                      <h3 className="timeline-title">{plan.title}</h3>
                      <div className="timeline-card-bottom">
                        <span className="timeline-status" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                        {plan.plan_type === 'watch_party' && <span className="timeline-status" style={{ color: '#1e40af', background: '#dbeafe' }}>🎬 Watch</span>}
                        {going > 0 && <span className="timeline-going">{going} {going === 1 ? 'asiste' : 'asisten'}</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
              {past.length > 5 && (
                <p style={{ fontSize: 13, color: '#69746d', textAlign: 'center', marginTop: 8 }}>
                  +{past.length - 5} planes anteriores
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <InviteSection
        inviteLink={inviteLink}
        groupName={group.name}
        isOwner={isOwner}
        onGenerate={() => genInvite.mutate()}
        isPending={genInvite.isPending}
      />

      <section className="section-heading">
        <div>
          <p className="eyebrow">MIEMBROS</p>
          <h2>{members.length} {members.length === 1 ? 'persona' : 'personas'}</h2>
        </div>
      </section>
      <div className="group-list" style={{ marginBottom: 30 }}>
        {members.slice(0, 3).map((m: any) => (
          <div className="group-card" key={m.user_id} style={{ cursor: 'default' }}>
            <span className="group-icon">{initials(m.profiles?.full_name)}</span>
            <div className="group-card-body">
              <strong>{m.profiles?.full_name || 'Usuario'}</strong>
              <div className="group-meta">
                <span>{m.role === 'owner' ? 'Creador' : 'Miembro'}</span>
              </div>
            </div>
          </div>
        ))}
        {members.length > 3 && (
          <Link to={'/groups/' + groupId + '/members'} style={{ textAlign: 'center', fontSize: 13, color: '#69746d', marginTop: 4, display: 'block', textDecoration: 'none' }}>
            +{members.length - 3} miembros más
          </Link>
        )}
      </div>

      <div className="group-actions">
        {!isOwner ? (
          <button
            className="group-leave"
            onClick={() => {
              if (!confirm('¿Seguro que quieres salir del grupo?')) return
              supabase.rpc('leave_group', { target_group_id: groupId }).then(({ error }) => {
                if (!error) nav('/', { replace: true })
              })
            }}
          >
            Salir del grupo
          </button>
        ) : (
          <button
            className="group-delete"
            onClick={() => {
              if (!confirm('¿Seguro que quieres eliminar este grupo? Todos los planes y miembros se eliminarán.')) return
              supabase.rpc('delete_group', { target_group_id: groupId }).then(({ error }) => {
                if (!error) nav('/', { replace: true })
              })
            }}
          >
            Eliminar grupo
          </button>
        )}
      </div>

      <BottomNav active="home" />
    </Shell>
  )
}
