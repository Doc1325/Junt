import { useRef, useEffect, useCallback } from 'react'

function isGoogleDrive(url: string) {
  return /\/file\/d\//.test(url)
}

function getEmbedUrl(url: string): string {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  return url
}

type VideoProps = {
  url: string
  isPlaying: boolean
  currentTime: number
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onTimeUpdate: (time: number) => void
  isHost: boolean
}

function Html5Video({ url, isPlaying, currentTime, onPlay, onPause, onSeek, onTimeUpdate, isHost }: VideoProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const seeking = useRef(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (isPlaying && video.paused) {
      video.play().catch(() => {})
    } else if (!isPlaying && !video.paused) {
      video.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    const video = ref.current
    if (!video || seeking.current) return
    if (Math.abs(video.currentTime - currentTime) > 2) {
      video.currentTime = currentTime
    }
  }, [currentTime])

  const handlePlay = useCallback(() => { if (isHost) onPlay() }, [isHost, onPlay])
  const handlePause = useCallback(() => { if (isHost) onPause() }, [isHost, onPause])
  const handleSeeked = useCallback(() => {
    seeking.current = false
    if (isHost && ref.current) onSeek(ref.current.currentTime)
  }, [isHost, onSeek])
  const handleTimeUpdate = useCallback(() => {
    if (isHost && ref.current && !seeking.current) onTimeUpdate(ref.current.currentTime)
  }, [isHost, onTimeUpdate])

  return (
    <div className="video-wrapper">
      <video
        ref={ref} src={url} controls className="video-player" playsInline
        onPlay={handlePlay} onPause={handlePause}
        onSeeked={handleSeeked} onTimeUpdate={handleTimeUpdate}
        onSeeking={() => { seeking.current = true }}
      />
    </div>
  )
}

function GoogleDriveEmbed({ url }: { url: string }) {
  return (
    <div className="video-wrapper">
      <iframe
        src={getEmbedUrl(url)}
        className="video-player"
        style={{ height: 400, border: 0 }}
        allow="autoplay"
        allowFullScreen
      />
      <p className="drive-note">Google Drive — sincronización no disponible en este proveedor. Usa una URL MP4 directa para reproducción sincronizada.</p>
    </div>
  )
}

type Props = {
  url: string
  isPlaying: boolean
  currentTime: number
  onPlay: () => void
  onPause: () => void
  onSeek: (time: number) => void
  onTimeUpdate: (time: number) => void
  isHost: boolean
}

export default function VideoPlayer(props: Props) {
  if (isGoogleDrive(props.url)) return <GoogleDriveEmbed url={props.url} />
  return <Html5Video {...props} url={props.url} />
}
