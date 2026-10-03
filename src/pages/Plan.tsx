import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCurrentUser, useVirtualRoom } from '../lib/queries'
import Shell from '../components/Shell'
import BottomNav from '../components/BottomNav'
import AttendancePills from '../components/AttendancePills'

function formatDateShort(dateStr: string) {
  return new Intl.DateTimeFormat('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(dateStr)).toUpperCase()
}

export default function Plan() {
  const { planId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null)
  const currentUserId = user?.id
  const { data: virtualRoom } = useVirtualRoom(planId)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['plan', planId],
    queryFn: async () => {
      const { data: plan, error: pe } = await supabase.from('plans').select('*, group:group_id(id, name, created_by)').eq('id', planId).single()
      if (pe) throw pe
      const { data: options, error: oe } = await supabase.from('plan_options').select('*, votes(*)').eq('plan_id', planId)
      if (oe) throw oe
      const { data: participants, error: ppe } = await supabase
        .from('plan_participants').select('*, profiles(id, full_name, avatar_url)').eq('plan_id', planId)
      if (ppe) throw ppe
      const { data: members, error: me } = await supabase
        .from('group_members').select('user_id, profiles(id, full_name, avatar_url)').eq('group_id', plan.group_id)
      if (me) throw me
      return {
        plan,
        options: options || [],
        participants: participants || [],
        members: members || [],
      }
    },
  })

  const myVotes = data?.options?.flatMap(o => o.votes?.filter((v: any) => v.user_id === currentUserId) || []) || []
  const totalVotes = data?.options?.reduce((sum: number, o: any) => sum + (o.votes?.length || 0), 0) || 0
  const myAttendance = data?.participants?.find((p: any) => p.user_id === currentUserId)?.attendance_status
  const isCreator = data?.plan?.created_by === currentUserId
  const isGroupCreator = data?.plan?.group?.created_by === currentUserId

  const voteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      setError(null)
      if (myVotes.some((v: any) => v.option_id === optionId)) {
        const { error } = await supabase.from('votes').delete().match({ option_id: optionId, user_id: currentUserId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('votes').insert({ option_id: optionId, user_id: currentUserId })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  const attendanceMutation = useMutation({
    mutationFn: async (status: string) => {
      setError(null)
      if (myAttendance === status) return
      const { error } = await supabase.from('plan_participants').upsert({ plan_id: planId, user_id: currentUserId, attendance_status: status })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  const closeVoteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      setError(null)
      const { error } = await supabase.rpc('close_vote', { target_plan_id: planId, selected_option: optionId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  function handleCloseVote() {
    if (!selectedWinner) return
    closeVoteMutation.mutate(selectedWinner)
    setConfirming(false)
    setSelectedWinner(null)
  }

  const cancelMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      const { error } = await supabase.rpc('cancel_plan', { target_plan_id: planId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      const { error } = await supabase.rpc('delete_plan', { target_plan_id: planId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['plan', planId] })
      queryClient.removeQueries({ queryKey: ['group', plan.group_id] })
      navigate('/groups/' + plan.group_id)
    },
    onError: (e: Error) => setError(e.message),
  })

  if (isLoading) return <Shell><p className='empty-state'>Cargando plan…</p></Shell>
  if (isError || !data?.plan) return <Shell><Link className='back' to='/'>← Todos los planes</Link><p className='empty-state'>No pudimos cargar este plan.</p></Shell>

  const { plan, options, participants, members } = data
  const going = participants.filter((p: any) => p.attendance_status === 'going')
  const maybe = participants.filter((p: any) => p.attendance_status === 'maybe')
  const notGoing = participants.filter((p: any) => p.attendance_status === 'not_going')
  const respondedIds = new Set(participants.map((p: any) => p.user_id))
  const pending = members
    .filter((m: any) => !respondedIds.has(m.user_id))
    .map((m: any) => ({
      user_id: m.user_id,
      profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
    }))
  const statusLabel: Record<string, string> = { voting: 'VOTACIÓN ABIERTA', confirmed: 'CONFIRMADO', completed: 'COMPLETADO', cancelled: 'CANCELADO' }

  return (
    <Shell>
      <Link className='back' to={'/groups/' + plan.group_id}>{'←'} {plan.group?.name || 'Volver'}</Link>
      <section className='plan-header'>
        <p className='eyebrow'>{statusLabel[plan.status]} · {formatDateShort(plan.scheduled_at)}</p>
        <h1>{plan.title}</h1>
        {plan.plan_type === 'watch_party' ? (
          <p>Watch Party coordinada por el grupo.</p>
        ) : (
          <p>{plan.description || 'Elijan una o varias opciones. Puedes cambiar tu voto.'}</p>
        )}
      </section>

      {plan.plan_type === 'watch_party' && (
        <div style={{ marginTop: 28, marginBottom: 28 }}>
          {virtualRoom ? (
            <Link to={'/watch/' + virtualRoom.id} className="primary-action" style={{ textAlign: 'center', textDecoration: 'none' }}>
              🖥️ Entrar a la sala
            </Link>
          ) : (
            <p className="empty-state">Cargando sala…</p>
          )}
        </div>
      )}

      {plan.plan_type !== 'watch_party' && plan.status === 'voting' && (
        <>
          <section className='votes'>
            {options.map((option: any) => {
              const voteCount = option.votes?.length || 0
              const pct = totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0
              const isSelected = myVotes.some((v: any) => v.option_id === option.id)
              const isWinnerPick = confirming && selectedWinner === option.id
              return (
                <button
                  onClick={() => confirming ? setSelectedWinner(option.id) : voteMutation.mutate(option.id)}
                  className={(confirming && isWinnerPick) ? 'vote selected winner-pick' : isSelected ? 'vote selected' : 'vote'}
                  key={option.id}
                  disabled={voteMutation.isPending}
                >
                  <span className='check'>{isSelected || isWinnerPick ? '✓' : ''}</span>
                  <div className='vote-info'>
                    <strong>{option.title}</strong>
                    <small>{voteCount} {voteCount === 1 ? 'voto' : 'votos'}</small>
                    <div className='vote-progress'>
                      <div className='vote-progress-fill' style={{ width: pct + '%' }}></div>
                    </div>
                  </div>
                  <b className='vote-pct'>{pct}%</b>
                </button>
              )
            })}
          </section>

          {isCreator && !confirming && (
            <button className='primary-action' style={{ marginTop: 20, background: '#5d6d62' }} onClick={() => setConfirming(true)}>
              Cerrar votación
            </button>
          )}

          {confirming && (
            <div className='confirm-vote'>
              <p className='eyebrow'>
                Selecciona la opción ganadora y confirma
              </p>
              <div className='confirm-vote-row'>
                <button className='primary-action' style={{ background: '#5d6d62' }} onClick={() => { setConfirming(false); setSelectedWinner(null) }}>
                  Cancelar
                </button>
                <button className='primary-action' disabled={!selectedWinner || closeVoteMutation.isPending} onClick={handleCloseVote}>
                  {closeVoteMutation.isPending ? 'Cerrando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {plan.plan_type !== 'watch_party' && plan.status === 'confirmed' && plan.selected_option_id && (
        <section className='votes'>
          {options.map((option: any) => {
            const isWinner = option.id === plan.selected_option_id
            return (
              <div className={isWinner ? 'vote selected' : 'vote'} key={option.id} style={{ cursor: 'default', opacity: isWinner ? 1 : 0.5 }}>
                <span className='check'>{isWinner ? '✓' : ''}</span>
                <div className='vote-info'>
                  <strong>{option.title}</strong>
                  {isWinner && <small>Ganadora</small>}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {plan.plan_type !== 'watch_party' && plan.status === 'confirmed' && options.length === 0 && (
        <div className='empty-state' style={{ borderStyle: 'solid', borderColor: '#bcd49d', background: '#f1f8e7' }}>
          <strong>Plan confirmado</strong>
          <span>Este plan no requiere votación.</span>
        </div>
      )}

      {plan.plan_type !== 'watch_party' && (plan.status === 'completed' || plan.status === 'cancelled') && options.length > 0 && (
        <section className='votes'>
          {options.map((option: any) => {
            const isWinner = option.id === plan.selected_option_id
            return (
              <div className={isWinner ? 'vote selected' : 'vote'} key={option.id} style={{ cursor: 'default', opacity: 0.5 }}>
                <span className='check'>{isWinner ? '✓' : ''}</span>
                <div className='vote-info'>
                  <strong>{option.title}</strong>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {plan.plan_type !== 'watch_party' && (
        <div className='attendance'>
          <p className='eyebrow'>¿Vas a poder?</p>
          <h2>Confirma tu asistencia</h2>
          <div>
            {(['going', 'maybe', 'not_going'] as const).map((status) => {
              const labels: Record<string, string> = { going: 'Voy', maybe: 'Tal vez', not_going: 'No voy' }
              return (
                <button key={status} className={myAttendance === status ? 'going' : ''} onClick={() => attendanceMutation.mutate(status)} disabled={attendanceMutation.isPending}>
                  {labels[status]}
                </button>
              )
            })}
          </div>

          <AttendancePills going={going} maybe={maybe} notGoing={notGoing} pending={pending} />
        </div>
      )}

      {plan.plan_type !== 'watch_party' && isCreator && plan.status !== 'completed' && plan.status !== 'cancelled' && (
        <div className="delete-section">
          <button
            disabled={cancelMutation.isPending}
            onClick={() => { if (confirm('¿Estás seguro? El plan se marcará como cancelado.')) cancelMutation.mutate() }}
          >
            {cancelMutation.isPending ? 'Cancelando…' : 'Cancelar plan'}
          </button>
        </div>
      )}

      {isGroupCreator && (
        <div className="delete-section">
          <button
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm('¿Estás seguro? Esta acción eliminará el plan permanentemente.'))
                deleteMutation.mutate()
            }}
          >
            {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar plan'}
          </button>
        </div>
      )}

      {plan.plan_type !== 'watch_party' && plan.status !== 'voting' && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a
            href={'https://wa.me/?text=' + encodeURIComponent('📍 Nuevo plan en JuntApp: ' + plan.title + '\n\n' + window.location.origin + '/plans/' + plan.id)}
            target='_blank' rel='noopener'
            className='invite-whatsapp'
          >
            Compartir en WhatsApp
          </a>
        </div>
      )}

      {error && <p className='form-error' style={{ marginTop: 16 }}>{error}</p>}

      <BottomNav active="home" />
    </Shell>
  )
}
