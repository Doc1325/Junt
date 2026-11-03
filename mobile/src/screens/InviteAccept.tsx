import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../../App'
import { toUserMessage } from '../lib/errors'
import { clearPendingInvite, savePendingInvite } from '../lib/invites'

type Nav = NativeStackNavigationProp<RootStackParamList>
type InviteRoute = RouteProp<RootStackParamList, 'InviteAccept'>
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

export default function InviteAccept() {
  const nav = useNavigation<Nav>()
  const route = useRoute<InviteRoute>()
  const { token } = route.params

  const previewQuery = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invite_preview', { invite_token: token })
      if (error) throw error
      const preview = Array.isArray(data) ? data[0] : data
      if (!preview) throw new Error('INVITE_INVALID')
      return preview as InvitePreview
    },
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        await savePendingInvite(token)
        return null
      }
      const { data: groupId, error } = await supabase.rpc('accept_invite', { invite_token: token })
      if (error) throw error
      if (!groupId) throw new Error('INVITE_INVALID')
      return groupId as string
    },
    onSuccess: async (groupId) => {
      if (!groupId) {
        nav.navigate('Login')
        return
      }
      await clearPendingInvite()
      nav.replace('Group', { groupId })
    },
  })

  async function goHome() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) nav.navigate('MainTabs', { screen: 'Dashboard' })
    else nav.navigate('Login')
  }

  if (previewQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size='large' color='#28533a' /><Text style={styles.loadingText}>Comprobando invitación…</Text></View>
  }

  if (previewQuery.isError) {
    return (
      <View style={styles.container}><View style={styles.content}>
        <Text style={styles.title}>No pudimos comprobar el enlace</Text>
        <Text style={styles.subtitle}>{toUserMessage(previewQuery.error)}</Text>
        <TouchableOpacity style={styles.button} onPress={() => void previewQuery.refetch()}><Text style={styles.buttonText}>Reintentar</Text></TouchableOpacity>
      </View></View>
    )
  }

  const preview = previewQuery.data
  if (!preview || preview.invite_status !== 'active') {
    return (
      <View style={styles.container}><View style={styles.content}>
        <Text style={styles.brand}>junt<Text style={styles.dot}>·</Text></Text>
        <Text style={styles.title}>Este enlace no está disponible.</Text>
        <Text style={styles.subtitle}>{preview ? statusMessage[preview.invite_status] : statusMessage.invalid}</Text>
        <TouchableOpacity style={styles.button} onPress={() => void goHome()}><Text style={styles.buttonText}>Ir al inicio</Text></TouchableOpacity>
      </View></View>
    )
  }

  const inviter = preview.inviter_name || 'Alguien'
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>junt<Text style={styles.dot}>·</Text></Text>
        {preview.inviter_avatar ? (
          <Image source={{ uri: preview.inviter_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{inviter.slice(0, 1).toUpperCase()}</Text></View>
        )}
        <Text style={styles.eyebrow}>INVITACIÓN PRIVADA</Text>
        <Text style={styles.title}>{inviter} te invitó a “{preview.group_name}”.</Text>
        <Text style={styles.subtitle}>Únete al grupo en JuntApp. Verás su contenido únicamente después de aceptar.</Text>
        {acceptMutation.error && <Text style={styles.error}>{toUserMessage(acceptMutation.error, 'No pudimos aceptar la invitación.')}</Text>}
        <TouchableOpacity style={[styles.button, acceptMutation.isPending && styles.disabled]} disabled={acceptMutation.isPending} onPress={() => acceptMutation.mutate()}>
          {acceptMutation.isPending ? <ActivityIndicator size='small' color='#fff' /> : <Text style={styles.buttonText}>Unirme al grupo</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void goHome()}><Text style={styles.secondary}>Ahora no</Text></TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0' },
  content: { width: '100%', maxWidth: 420, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 18, padding: 28 },
  brand: { fontFamily: 'Fraunces_700Bold', fontSize: 42, letterSpacing: -2, color: '#18261f', marginBottom: 30 },
  dot: { color: '#65a838' },
  avatar: { width: 68, height: 68, borderRadius: 34, marginBottom: 18 },
  avatarFallback: { backgroundColor: '#e8efdf', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#28533a', fontFamily: 'Fraunces_700Bold', fontSize: 25 },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 10 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 32, lineHeight: 35, letterSpacing: -1.5, color: '#18261f', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#69746d', lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#28533a', paddingVertical: 17, paddingHorizontal: 32, borderRadius: 10, width: '100%', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
  secondary: { color: '#69746d', fontFamily: 'DMSans_500Medium', fontSize: 14, marginTop: 18 },
  error: { color: '#a22c20', fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginBottom: 6 },
  disabled: { opacity: 0.5 },
  loadingText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#69746d', marginTop: 16 },
})
