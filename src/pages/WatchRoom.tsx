import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Room, RoomEvent, Track } from 'livekit-client'
import { supabase } from '../lib/supabase'
import { useCurrentUser, useWatchMessages } from '../lib/queries'
import WatchChat from '../components/WatchChat'
import {
  Maximize2, Minimize2, Volume2, VolumeX, PictureInPicture2,
  Monitor, MonitorStop, ChevronLeft, MessageCircle, X,
} from 'lucide-react'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export default function WatchRoom() {
  const { roomId = '' } = useParams()
  const { data: user } = useCurrentUser()
  const { data: messages = [] } = useWatchMessages(roomId)
  const roomRef = useRef<Room | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const volumeRef = useRef(1)
  const mutedRef = useRef(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [isSharing, setIsSharing] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  const { data: room, isLoading } = useQuery({
    queryKey: ['virtualRoomById', roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_rooms')
        .select('*, plan:plan_id(id, title, group_id)')
        .eq('id', roomId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!roomId,
  })

  const isHost = user?.id === room?.host_id

  useEffect(() => {
    if (connectionStatus !== 'connected') { setElapsed(0); return }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [connectionStatus])

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No session')
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) throw new Error('Supabase not configured')
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-livekit-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({ room_id: roomId }),
    })
    if (!res.ok) throw new Error('Failed to get token')
    return res.json() as Promise<{ token: string; url: string }>
  }, [roomId])

  useEffect(() => {
    if (!room || !user) return

    const livekitRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    })
    roomRef.current = livekitRoom

    livekitRoom.on(RoomEvent.Connected, () => {
      setConnectionStatus('connected')
      setElapsed(0)
      setParticipants(Array.from(livekitRoom.remoteParticipants.keys()))
    })

    livekitRoom.on(RoomEvent.Disconnected, () => {
      setConnectionStatus('disconnected')
      setParticipants([])
    })

    livekitRoom.on(RoomEvent.Reconnecting, () => {
      setConnectionStatus('connecting')
    })

    livekitRoom.on(RoomEvent.Reconnected, () => {
      setConnectionStatus('connected')
    })

    livekitRoom.on(RoomEvent.ParticipantConnected, (p) => {
      setParticipants((prev) => [...prev, p.identity])
    })

    livekitRoom.on(RoomEvent.ParticipantDisconnected, (p) => {
      setParticipants((prev) => prev.filter((id) => id !== p.identity))
    })

    livekitRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === 'video' && videoRef.current) {
        track.attach(videoRef.current)
        videoRef.current.volume = volumeRef.current
        videoRef.current.muted = mutedRef.current
      }
      if (track.kind === 'audio') {
        const audioEl = document.createElement('audio')
        audioEl.setAttribute('playsinline', '')
        audioEl.autoplay = true
        audioEl.style.display = 'none'
        containerRef.current?.appendChild(audioEl)
        track.attach(audioEl)
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const src = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]))
          src.connect(ctx.destination)
        } catch {}
      }
    })

    livekitRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach()
    })

    ;(async () => {
      try {
        setConnectionStatus('connecting')
        const { token, url } = await getToken()
        await livekitRoom.connect(url, token)
      } catch {
        setError('No pudimos conectar a la sala.')
        setConnectionStatus('error')
      }
    })()

    return () => {
      livekitRoom.disconnect()
      roomRef.current = null
    }
  }, [room, user, getToken])

  useEffect(() => {
    volumeRef.current = volume
    mutedRef.current = isMuted
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = isMuted
    }
  }, [volume, isMuted])

  async function startScreenShare() {
    if (!roomRef.current) return
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]
      videoTrack.onended = () => {
        setIsSharing(false)
        roomRef.current?.localParticipant.unpublishTrack(videoTrack)
        if (audioTrack) roomRef.current?.localParticipant.unpublishTrack(audioTrack)
      }
      await roomRef.current.localParticipant.publishTrack(videoTrack, { source: Track.Source.ScreenShare })
      if (audioTrack) {
        await roomRef.current.localParticipant.publishTrack(audioTrack, { source: Track.Source.ScreenShareAudio })
      }
      setIsSharing(true)
    } catch {
      setError('No pudimos iniciar la compartición de pantalla.')
    }
  }

  async function stopScreenShare() {
    if (!roomRef.current) return
    roomRef.current.localParticipant.trackPublications.forEach((pub) => {
      if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
        roomRef.current?.localParticipant.unpublishTrack(pub.track!)
      }
    })
    setIsSharing(false)
  }

  function toggleFullscreen() {
    if (!containerRef.current) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    }
  }

  async function togglePip() {
    if (!videoRef.current) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    } catch {}
  }

  function formatElapsed(s: number) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  if (isLoading) return <div className="virtual-room" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><p>Cargando sala…</p></div>
  if (!room) return <div className="virtual-room" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><Link className="back" to="/" style={{ position: 'absolute', top: 20, left: 20 }}>← Volver</Link><p>No pudimos cargar la sala.</p></div>

  const planId = room.plan?.id || ''
  const hasVideo = isSharing || participants.some((id) => id === room.host_id)

  return (
    <div className={`virtual-room ${chatOpen ? '' : 'chat-closed'}`}>
      <div className="virtual-room-main">
          <div className="virtual-room-player"
          ref={containerRef}
          onMouseMove={resetControlsTimer}
          onMouseLeave={() => setShowControls(false)}
          onTouchStart={() => {
            setShowControls(true)
            clearTimeout(controlsTimer.current)
            controlsTimer.current = setTimeout(() => setShowControls(false), 5000)
          }}
        >
          <div className="virtual-room-video">
            <video ref={videoRef} autoPlay playsInline className="video-player" />
            {connectionStatus === 'connecting' && (
              <div className="virtual-room-empty">
                <div className="connecting-spinner" />
                <p>Conectando a la sala…</p>
              </div>
            )}
            {connectionStatus === 'connected' && !hasVideo && (
              <div className="virtual-room-empty">
                <Monitor size={40} strokeWidth={1.5} />
                <p>Esperando a que el host comparta su pantalla…</p>
              </div>
            )}
            {connectionStatus === 'error' && (
              <div className="virtual-room-empty" style={{ opacity: 1 }}>
                <p style={{ color: '#fee2e2' }}>Error de conexión</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Intentando reconectar…</p>
              </div>
            )}
          </div>

          <div className={`player-overlay ${showControls ? 'visible' : ''}`}>
            <div className="player-top-bar">
              <Link to={`/plans/${planId}`} className="player-back">
                <ChevronLeft size={18} />
                <span>{room.plan?.title || 'Volver'}</span>
              </Link>
              <div className="player-status">
                {connectionStatus === 'connecting' && <span className="status-badge" style={{ background: '#fef3c7', color: '#b45309' }}>Conectando…</span>}
                {connectionStatus === 'connected' && (
                  <span className="status-badge live-badge">
                    <span className="live-dot" />
                    EN VIVO · {formatElapsed(elapsed)}
                  </span>
                )}
                {connectionStatus === 'disconnected' && <span className="status-badge" style={{ background: '#f3f4f6', color: '#374151' }}>Desconectado</span>}
                {connectionStatus === 'error' && <span className="status-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Error</span>}
                {isHost && <span className="status-badge host-badge">Anfitrión</span>}
              </div>
            </div>
          </div>

          <div className={`player-controls ${showControls ? 'visible' : ''}`}>
            <div className="controls-row">
              <div className="controls-left">
                <button
                  className="ctrl-btn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                >
                  {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button className="ctrl-btn" onClick={togglePip} title="Picture in picture">
                  <PictureInPicture2 size={18} />
                </button>
                <div className="volume-control">
                  <button className="ctrl-btn" onClick={() => setIsMuted(!isMuted)} title={isMuted ? 'Activar sonido' : 'Silenciar'}>
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setVolume(v)
                      setIsMuted(v === 0)
                    }}
                    className="volume-slider"
                  />
                </div>
              </div>
              <div className="controls-right">
                {isHost && (
                  <>
                    {isSharing ? (
                      <button className="ctrl-btn share-active" onClick={stopScreenShare} title="Dejar de compartir">
                        <MonitorStop size={18} />
                        <span>Dejar de compartir</span>
                      </button>
                    ) : (
                      <button className="ctrl-btn" onClick={startScreenShare} disabled={connectionStatus !== 'connected'} title="Compartir pantalla">
                        <Monitor size={18} />
                        <span>Compartir</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  className={`ctrl-btn chat-toggle ${chatOpen ? 'active' : ''}`}
                  onClick={() => setChatOpen(!chatOpen)}
                  title="Chat"
                >
                  <MessageCircle size={18} />
                  <span>{chatOpen ? 'Ocultar chat' : 'Chat'}</span>
                </button>
              </div>
            </div>
            <div className="controls-info">
              <span className="participant-count">
                {participants.length + 1} {participants.length + 1 === 1 ? 'conectado' : 'conectados'}
              </span>
            </div>
          </div>
        </div>

        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
      </div>

      <div className={`virtual-room-side ${chatOpen ? '' : 'closed'}`}>
        <div className="chat-header">
          <span className="eyebrow">CHAT</span>
          <button className="ctrl-btn" onClick={() => setChatOpen(false)} title="Cerrar chat">
            <X size={16} />
          </button>
        </div>
        <WatchChat roomId={roomId} messages={messages} />
      </div>
    </div>
  )
}
