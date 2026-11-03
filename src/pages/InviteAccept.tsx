import type { Session } from '@supabase/supabase-js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toUserMessage } from '../lib/errors'
import QueryError from '../components/QueryError'

type InvitePreview = {
  invite_status: 'active' | 'invalid' | 'revoked' | 'expired' | 'limit_reached'
  group_name: string | null
  inviter_name: string | null
  inviter_avatar: string | null
}

const statusMessage: Record<InvitePreview['invite_status'], string> = {
  active: '',
  invalid: 'Este enlace de invitación no es válido.',
  revoked: 'El dueño revocó esta invitación.',
  expired: 'Esta invitación venció.',
  limit_reached: 'Esta invitación alcanzó su límite de personas.',
}

export default function InviteAccept({ session }: { session: Session | null }) {
  const { token = '' } = useParams()
  const nav = useNavigate()

  const previewQuery = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invite_preview', { invite_token: token })
      if (error) throw error
      const preview = Array.isArray(data) ? data[0] : data
      if (!preview) throw new Error('INVITE_INVALID')
      return preview as InvitePreview
    },
    enabled: Boolean(token),
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data: groupId, error } = await supabase.rpc('accept_invite', { invite_token: token })
      if (error) throw error
      if (!groupId) throw new Error('INVITE_INVALID')
      return groupId as string
    },
    onSuccess: (groupId) => {
      sessionStorage.removeItem('pendingRedirect')
      nav(`/groups/${groupId}`, { replace: true })
    },
  })

  function continueToLogin() {
    sessionStorage.setItem('pendingRedirect', `/invite/${token}`)
    nav('/login')
  }

  if (previewQuery.isLoading) return <div className='loading'>Comprobando invitación…</div>
  if (previewQuery.isError) {
    return <div className='invite-page'><QueryError error={previewQuery.error} onRetry={() => void previewQuery.refetch()} /></div>
  }

  const preview = previewQuery.data
  if (!preview || preview.invite_status !== 'active') {
    return (
      <div className='invite-page'>
        <div className='invite-preview-card'>
          <p className='brand'>junt<span>·</span></p>
          <p className='eyebrow'>INVITACIÓN</p>
          <h1>Este enlace no está disponible.</h1>
          <p>{preview ? statusMessage[preview.invite_status] : statusMessage.invalid}</p>
          <Link to='/' className='invite-primary'>Ir al inicio</Link>
        </div>
      </div>
    )
  }

  const inviter = preview.inviter_name || 'Alguien'
  return (
    <div className='invite-page'>
      <div className='invite-preview-card'>
        <p className='brand'>junt<span>·</span></p>
        {preview.inviter_avatar ? (
          <img className='invite-preview-avatar' src={preview.inviter_avatar} alt='' referrerPolicy='no-referrer' />
        ) : (
          <div className='invite-preview-avatar invite-preview-avatar-fallback'>{inviter.slice(0, 1).toUpperCase()}</div>
        )}
        <p className='eyebrow'>INVITACIÓN PRIVADA</p>
        <h1>{inviter} te invitó a “{preview.group_name}”.</h1>
        <p>Únete al grupo en JuntApp. Verás su contenido únicamente después de aceptar.</p>
        {acceptMutation.error && (
          <p className='invite-error' role='alert'>{toUserMessage(acceptMutation.error, 'No pudimos aceptar la invitación.')}</p>
        )}
        {session ? (
          <button className='invite-primary' onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
            {acceptMutation.isPending ? 'Uniéndote…' : 'Unirme al grupo'}
          </button>
        ) : (
          <button className='invite-primary' onClick={continueToLogin}>Continuar con Google</button>
        )}
        <Link to='/' className='invite-secondary'>Ahora no</Link>
      </div>
    </div>
  )
}
