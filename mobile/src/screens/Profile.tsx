import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/queries'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function Profile() {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useProfile()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name)
  }, [profile?.full_name])

  async function submit() {
    if (!name.trim() || saving || !profile) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', profile.id)
    if (err) {
      setError('No pudimos guardar tu nombre.')
      setSaving(false)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['profile'] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    queryClient.clear()
    await supabase.auth.signOut()
  }

  function confirmLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: handleLogout },
    ])
  }

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#28533a" /></View>

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formPage}>
        <Text style={styles.eyebrow}>TU PERFIL</Text>
        <Text style={styles.title}>Configura tu{"\n"}nombre.</Text>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile?.full_name)}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.full_name || 'Sin nombre'}</Text>
            <Text style={styles.profileHint}>Tu nombre visible para el grupo</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nombre de usuario</Text>
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
          {saved && <Text style={styles.success}>Nombre actualizado.</Text>}
          <TouchableOpacity
            style={[styles.button, (!name.trim() || saving) && styles.disabled]}
            disabled={!name.trim() || saving}
            onPress={submit}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Guardar nombre</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: insets.bottom + 100 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0' },
  formPage: { padding: 20 },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 9 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 42, lineHeight: 44, letterSpacing: -2.5, color: '#18261f', marginBottom: 36 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 36, gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#e8efdf', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'DMSans_700Bold', fontSize: 24, color: '#28533a' },
  profileName: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: '#18261f' },
  profileHint: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#69746d', marginTop: 4 },
  form: { gap: 21 },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#18261f', marginBottom: 4 },
  input: { width: '100%', padding: 16, borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 8, backgroundColor: '#fff', color: '#18261f', fontSize: 16, fontFamily: 'DMSans_400Regular' },
  error: { color: '#fc8181', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  success: { color: '#166534', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  button: { backgroundColor: '#28533a', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const },
  disabled: { opacity: 0.35 },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
  logoutButton: { marginTop: 40, paddingVertical: 14, borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 10, alignItems: 'center' as const },
  logoutText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#a22c20' },
})
