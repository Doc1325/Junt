import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../lib/queries'

export default function Onboarding() {
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim() || saving || !user) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: name.trim(), onboarded: true }, { onConflict: 'id' })
    if (err) {
      setError('No pudimos guardar tu nombre. Inténtalo de nuevo.')
      setSaving(false)
      return
    }
    // Update both possible query keys used for profile (generic and per-user)
    queryClient.setQueryData(['profile'], (old: any) => ({ ...old, onboarded: true }))
    if (user.id) queryClient.setQueryData(['profile', user.id], (old: any) => ({ ...old, onboarded: true }))
    await queryClient.invalidateQueries({ queryKey: ['profile'] })
    // Navigation is handled declaratively by AppContent switching from onboarding stack to main stack
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>junt<Text style={styles.dot}>·</Text></Text>
        <Text style={styles.eyebrow}>BIENVENIDO A JUNTAPP</Text>
        <Text style={styles.title}>¿Cómo te llamas?</Text>
        <Text style={styles.subtitle}>
          Este nombre lo verán tus amigos cuando te unes a grupos y planes.
        </Text>
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          placeholderTextColor="#69746d"
          maxLength={40}
          style={styles.input}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={[styles.button, (!name.trim() || saving) && styles.disabled]}
          disabled={!name.trim() || saving}
          onPress={submit}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 24 },
  content: { width: '100%', maxWidth: 400 },
  brand: { fontFamily: 'Fraunces_700Bold', fontSize: 48, letterSpacing: -2, color: '#fff', marginBottom: 40 },
  dot: { color: '#65a838' },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#a0aec0', marginBottom: 9 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 42, lineHeight: 44, color: '#fff', marginBottom: 10 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#a0aec0', lineHeight: 22, marginBottom: 36 },
  input: { width: '100%', padding: 16, borderWidth: 1, borderColor: '#4a5568', borderRadius: 8, backgroundColor: '#2d3748', color: '#fff', fontSize: 16, fontFamily: 'DMSans_400Regular' },
  error: { color: '#fc8181', fontSize: 13, marginTop: 8, fontFamily: 'DMSans_400Regular' },
  button: { backgroundColor: '#28533a', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 20 },
  disabled: { opacity: 0.35 },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
})
