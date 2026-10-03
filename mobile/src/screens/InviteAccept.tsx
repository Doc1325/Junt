import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../../App'

type Nav = NativeStackNavigationProp<RootStackParamList>
type InviteRoute = RouteProp<RootStackParamList, 'InviteAccept'>

export default function InviteAccept() {
  const nav = useNavigation<Nav>()
  const route = useRoute<InviteRoute>()
  const { token } = route.params
  const [error, setError] = useState(false)

  useEffect(() => {
    async function accept() {
      const { data: groupId, error } = await supabase.rpc('accept_invite', { invite_token: token })
      if (error || !groupId) { setError(true); return }
      nav.replace('Group', { groupId: groupId as string })
    }
    accept()
  }, [token, nav])

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.brand}>junt<Text style={styles.dot}>·</Text></Text>
          <Text style={styles.title}>Enlace no válido</Text>
          <Text style={styles.subtitle}>El enlace de invitación ha expirado o no es válido.</Text>
          <TouchableOpacity style={styles.button} onPress={() => nav.navigate('MainTabs', { screen: 'Dashboard' })}>
            <Text style={styles.buttonText}>Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#28533a" />
      <Text style={styles.loadingText}>Uniéndote al grupo…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0', padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0' },
  content: { width: '100%', maxWidth: 400, alignItems: 'center' as const },
  brand: { fontFamily: 'Fraunces_700Bold', fontSize: 48, letterSpacing: -2, color: '#18261f', marginBottom: 24 },
  dot: { color: '#65a838' },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 32, letterSpacing: -1.5, color: '#18261f', marginBottom: 12, textAlign: 'center' as const },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#69746d', lineHeight: 22, textAlign: 'center' as const, marginBottom: 24 },
  button: { backgroundColor: '#28533a', paddingVertical: 17, paddingHorizontal: 32, borderRadius: 10, width: '100%' as const, alignItems: 'center' as const },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
  loadingText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#69746d', marginTop: 16 },
})
