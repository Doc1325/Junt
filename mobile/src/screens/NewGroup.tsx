import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../../App'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function NewGroup() {
  const nav = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    const { data: groupId, error: groupError } = await supabase.rpc('create_group', {
      group_name: name.trim(),
    })
    if (groupError || !groupId) {
      setError('No pudimos crear el grupo. Inténtalo de nuevo.')
      setSaving(false)
      return
    }
    nav.navigate('Group', { groupId: groupId as string })
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formPage}>
        <Text style={styles.eyebrow}>NUEVO GRUPO</Text>
        <Text style={styles.title}>Juntar gente{"\n"}empieza aquí.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>¿Cómo se llama el grupo?</Text>
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Ej. Los del viernes"
            placeholderTextColor="#69746d"
            style={styles.input}
          />
          <Text style={styles.hint}>Podrás invitar a tus amigos con un enlace después.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, (!name.trim() || saving) && styles.disabled]}
            disabled={!name.trim() || saving}
            onPress={submit}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Crear grupo</Text>
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
