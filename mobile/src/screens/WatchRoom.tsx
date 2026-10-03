import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useCurrentUser, useWatchMessages } from '../lib/queries'
import type { RootStackParamList } from '../../App'
import {
  LiveKitRoom,
  VideoTrack,
  useRemoteParticipants,
  useTracks,
  useLocalParticipant,
  useConnectionState,
  registerGlobals,
} from '@livekit/react-native'
import { Room, Track, ConnectionState } from 'livekit-client'
import WatchChat from '../components/WatchChat'
import { Ionicons } from '@expo/vector-icons'

registerGlobals()

type Nav = NativeStackNavigationProp<RootStackParamList>
type WatchRoute = RouteProp<RootStackParamList, 'WatchRoom'>

function formatElapsed(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function RoomView({
  roomId, isHost: initialIsHost, onError,
}: {
  roomId: string
  isHost: boolean
  onError: (msg: string) => void
}) {
  const { data: messages = [] } = useWatchMessages(roomId)
  const { localParticipant } = useLocalParticipant()
  const connectionState = useConnectionState(undefined)
  const remoteParticipants = useRemoteParticipants({})
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera])
  const [showControls, setShowControls] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const controlsRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()

  useEffect(() => {
    if (connectionState === ConnectionState.Connected) {
      setElapsed(0)
      const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
      return () => clearInterval(interval)
    }
  }, [connectionState])

  useEffect(() => {
    if (showControls) {
      clearTimeout(controlsRef.current)
      controlsRef.current = setTimeout(() => setShowControls(false), 4000)
    }
    return () => clearTimeout(controlsRef.current)
  }, [showControls])

  async function toggleScreenShare() {
    if (!localParticipant) return
    if (isSharing) {
      await localParticipant.setScreenShareEnabled(false)
      setIsSharing(false)
    } else {
      try {
        await localParticipant.setScreenShareEnabled(true)
        setIsSharing(true)
      } catch { onError('No pudimos iniciar la compartición de pantalla') }
    }
  }

  const screenShareTrack = tracks.find((t) => t.source === Track.Source.ScreenShare)
  const cameraTrack = tracks.find((t) => t.source === Track.Source.Camera)
  const displayTrack = screenShareTrack || cameraTrack

  return (
    <View style={styles.player}>
      {displayTrack ? (
        <VideoTrack trackRef={displayTrack} style={styles.video} objectFit="contain" />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="tv-outline" size={48} color="rgba(255,255,255,.4)" />
          <Text style={styles.emptyText}>
            {initialIsHost ? 'Toca "Compartir" para empezar' : 'Esperando al host…'}
          </Text>
        </View>
      )}

      {showControls && (
        <SafeAreaView style={styles.controlsOverlay} pointerEvents="box-none">
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => nav.goBack()}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
              <Text style={styles.headerBtnText}>Salir</Text>
            </TouchableOpacity>
            <View style={styles.statusRow}>
              {connectionState === ConnectionState.Connected && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>EN VIVO · {formatElapsed(elapsed)}</Text>
                </View>
              )}
              {connectionState === ConnectionState.Connecting && (
                <Text style={styles.statusText}>Conectando…</Text>
              )}
              {connectionState === ConnectionState.Disconnected && (
                <Text style={styles.statusText}>Desconectado</Text>
              )}
              {initialIsHost && <Text style={styles.hostBadge}>Anfitrión</Text>}
            </View>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => setIsMuted(!isMuted)}>
                <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.ctrlBtn} onPress={() => setChatOpen(!chatOpen)}>
                <Ionicons name={chatOpen ? 'chatbox' : 'chatbox-outline'} size={22} color={chatOpen ? '#d8ff62' : '#fff'} />
              </TouchableOpacity>
              {initialIsHost && (
                <TouchableOpacity style={[styles.ctrlBtn, isSharing && styles.sharingBtn]} onPress={toggleScreenShare}>
                  <Ionicons name={isSharing ? 'stop-circle' : 'radio-outline'} size={22} color={isSharing ? '#d8ff62' : '#fff'} />
                  <Text style={styles.ctrlLabel}>{isSharing ? 'Dejar' : 'Compartir'}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.participantCount}>
              {remoteParticipants.length + 1} {(remoteParticipants.length + 1) === 1 ? 'conectado' : 'conectados'}
            </Text>
          </View>
        </SafeAreaView>
      )}

      {chatOpen && (
        <View style={[styles.chatOverlay, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Chat</Text>
            <TouchableOpacity onPress={() => setChatOpen(false)}>
              <Ionicons name="close" size={24} color="#18261f" />
            </TouchableOpacity>
          </View>
          <WatchChat roomId={roomId} messages={messages} />
        </View>
      )}

      <TouchableOpacity
        style={styles.tapArea}
        activeOpacity={1}
        onPress={() => setShowControls((s) => !s)}
      />
    </View>
  )
}

export default function WatchRoom() {
  const route = useRoute<WatchRoute>()
  const { roomId } = route.params
  const { data: user } = useCurrentUser()
  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roomInstance, setRoomInstance] = useState<Room | null>(null)
  const nav = useNavigation<Nav>()

  const createAndConnect = useCallback(async () => {
    if (!roomId || !user) return
    try {
      const { data: room, error: re } = await supabase
        .from('virtual_rooms')
        .select('*, plan:plan_id(id, title, group_id)')
        .eq('id', roomId)
        .single()
      if (re || !room) { setError('Sala no encontrada'); setLoading(false); return }
      setIsHost(user.id === room.host_id)
      nav.setOptions({ headerTitle: room.plan?.title || 'Sala' })

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('No hay sesión'); setLoading(false); return }

      const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-livekit-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ room_id: roomId }),
      })
      if (!res.ok) { setError('No pudimos conectar a la sala'); setLoading(false); return }
      const data = await res.json()
      setToken(data.token)
      setServerUrl(data.url)
      setRoomInstance(new Room())
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }, [roomId, user, nav])

  useEffect(() => { createAndConnect() }, [createAndConnect])

  useEffect(() => {
    if (!roomInstance) return
    const unsubscribe = nav.addListener('blur', () => {
      roomInstance.disconnect()
    })
    const unsubBefore = nav.addListener('beforeRemove', () => {
      roomInstance.disconnect()
    })
    return () => {
      unsubscribe()
      unsubBefore()
      roomInstance.disconnect()
    }
  }, [nav, roomInstance])

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#28533a" /></View>
  if (error || !token || !serverUrl) return (
    <View style={styles.center}>
      <Text style={styles.errText}>{error || 'Error'}</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => nav.goBack()}>
        <Text style={styles.backBtnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <LiveKitRoom room={roomInstance ?? undefined} serverUrl={serverUrl} token={token} connect={true}>
        <RoomView roomId={roomId} isHost={isHost} onError={setError} />
      </LiveKitRoom>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0', gap: 16 },
  errText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#69746d' },
  backBtn: { backgroundColor: '#28533a', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  backBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#fff' },
  player: { flex: 1, position: 'relative' },
  video: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: 'rgba(255,255,255,.5)', textAlign: 'center', paddingHorizontal: 40 },
  controlsOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  headerBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#fff' },
  statusRow: { flexDirection: 'row', gap: 6, padding: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#a22c20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#fff', fontWeight: '700' },
  statusText: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#fff', backgroundColor: 'rgba(255,255,255,.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  hostBadge: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#fff', backgroundColor: 'rgba(255,255,255,.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  bottomBar: { paddingBottom: 8 },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  ctrlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,.5)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, minHeight: 44 },
  sharingBtn: { backgroundColor: 'rgba(168,34,32,.7)' },
  ctrlLabel: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#fff' },
  participantCount: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', marginTop: 8 },
  chatOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '85%', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: .15, shadowRadius: 12, elevation: 10 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#d9ddd4' },
  chatTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#18261f' },
  tapArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
})
