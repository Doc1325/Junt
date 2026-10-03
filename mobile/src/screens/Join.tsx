import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../../App'

type Nav = NativeStackNavigationProp<RootStackParamList>

function extractToken(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const urlMatch = trimmed.match(/\/invite\/([a-zA-Z0-9]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-f0-9]+$/i.test(trimmed)) return trimmed
  return null
}

export default function Join() {
  const nav = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const [input, setInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
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
    nav.navigate('Group', { groupId: groupId as string })
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formPage}>
        <Text style={styles.eyebrow}>UNIRSE A GRUPO</Text>
        <Text style={styles.title}>Pega el enlace{"\n"}de invitación.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Enlace o código</Text>
          <TextInput
            autoFocus
            value={input}
            onChangeText={(t) => { setInput(t); setError(null) }}
            placeholder="https://junte.netlify.app/invite/abc123"
            placeholderTextColor="#69746d"
            style={styles.input}
          />
          <Text style={styles.hint}>Copia el enlace que te compartieron y pégalo aquí.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, (!input.trim() || joining) && styles.disabled]}
            disabled={!input.trim() || joining}
            onPress={submit}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Unirse al grupo</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: insets.bottom + 100 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f5f0' },
  formPage: { padding: 20 },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 9 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 42, lineHeight: 44, letterSpacing: -2.5, color: '#18261f', marginBottom: 36 },
  form: { gap: 16 },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#18261f' },
  input: { width: '100%', padding: 16, borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 8, backgroundColor: '#fff', color: '#18261f', fontSize: 16, fontFamily: 'DMSans_400Regular' },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d', lineHeight: 18 },
  error: { color: '#fc8181', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  button: { backgroundColor: '#28533a', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 4 },
  disabled: { opacity: 0.35 },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
})
