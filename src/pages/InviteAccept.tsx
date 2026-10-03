import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function InviteAccept() {
  const { token = '' } = useParams()
  const nav = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    async function accept() {
      const { data: groupId, error } = await supabase.rpc('accept_invite', { invite_token: token })
      if (error || !groupId) { setError(true); return }
      nav('/groups/' + groupId, { replace: true })
    }
    accept()
  }, [token, nav])

  if (error) {
    return (
      <div className='login'>
        <div className='login-content'>
          <p className='brand'>junt<span>·</span></p>
          <h1>Enlace no válido</h1>
          <p>El enlace de invitación ha expirado o no es válido.</p>
          <Link to='/' className='primary-action' style={{ display: 'block', marginTop: 24 }}>Ir al inicio</Link>
        </div>
      </div>
    )
  }

  return <div className='loading'>Uniéndote al grupo…</div>
}