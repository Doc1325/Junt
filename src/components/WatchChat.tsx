import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../lib/queries'
import type { WatchMessage } from '../types'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
}

type Props = {
  roomId: string
  messages: WatchMessage[]
}

export default function WatchChat({ roomId, messages }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { data: user } = useCurrentUser()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || sending || !user) return
    setSending(true)
    const { error } = await supabase.from('watch_messages').insert({
      room_id: roomId,
      user_id: user.id,
      message: text.trim(),
    })
    if (!error) {
      setText('')
      queryClient.invalidateQueries({ queryKey: ['watchMessages', roomId] })
    }
    setSending(false)
  }

  return (
    <div className="watch-chat">
      <div className="watch-chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="watch-chat-msg">
            <span className="watch-chat-avatar">{initials(msg.profiles?.full_name)}</span>
            <div>
              <strong>{msg.profiles?.full_name || 'Usuario'}</strong>
              <p>{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="watch-chat-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje…"
          disabled={sending}
        />
        <button type="submit" disabled={!text.trim() || sending}>Enviar</button>
      </form>
    </div>
  )
}
