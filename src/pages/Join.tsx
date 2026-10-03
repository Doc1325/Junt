import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Shell from '../components/Shell'

function extractToken(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  // Full URL: https://domain.com/invite/TOKEN
  const urlMatch = trimmed.match(/\/invite\/([a-zA-Z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  // Raw token (hex string)
  if (/^[a-f0-9]+$/i.test(trimmed)) return trimmed
  return null
}

export default function Join() {
  const nav = useNavigate()
  const [input, setInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const token = extractToken(input)
    if (!token) {
      setError('Pega un enlace de invitación válido o un código de grupo.')
      return
    }
    setJoining(true)
    setError(null)
    const { data: groupId, error: rpcError } = await supabase.rpc('accept_invite', { invite_token: token })
    if (rpcError || !groupId) {
      setError('Este enlace no es válido o ya expiró.')
      setJoining(false)
      return
    }
    nav('/groups/' + groupId, { replace: true })
  }

  return (
    <Shell>
      <Link className="back" to="/">← Volver</Link>
      <section className="form-page">
        <p className="eyebrow">UNIRSE A GRUPO</p>
        <h1>Pega el enlace<br />de invitación.</h1>
        <form onSubmit={submit}>
          <label>
            Enlace o código
            <input
              autoFocus
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null) }}
              placeholder="https://junte.netlify.app/invite/abc123"
            />
          </label>
          <p className="hint">Copia el enlace que te compartieron y pégalo aquí.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" disabled={!input.trim() || joining}>
            {joining ? 'Uniéndote…' : 'Unirse al grupo'}
          </button>
        </form>
      </section>
    </Shell>
  )
}