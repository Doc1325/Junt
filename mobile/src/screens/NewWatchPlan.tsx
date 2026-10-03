import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../../App'

type Nav = NativeStackNavigationProp<RootStackParamList>
type PlanRoute = RouteProp<RootStackParamList, 'NewWatchPlan'>

export default function NewWatchPlan() {
  const nav = useNavigation<Nav>()
  const route = useRoute<PlanRoute>()
  const insets = useSafeAreaInsets()
  const { groupId } = route.params
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!title.trim() || !scheduledAt || saving) return
    setSaving(true)
    setError(null)
    const { data: planId, error: rpcError } = await supabase.rpc('create_virtual_plan', {
      target_group_id: groupId,
      plan_title: title.trim(),
      plan_scheduled_at: scheduledAt.toISOString(),
    })
    if (rpcError || !planId) {
      setError('No pudimos crear la sala virtual. Inténtalo de nuevo.')
      setSaving(false)
      return
    }
    nav.replace('Plan', { planId: planId as string })
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formPage}>
        <Text style={styles.eyebrow}>SALA VIRTUAL</Text>
        <Text style={styles.title}>Comparte pantalla{"\n"}con tu grupo.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Título</Text>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="Ej. Movie Night"
            placeholderTextColor="#69746d"
            style={styles.input}
          />
          <Text style={styles.label}>¿Cuándo?</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <Text style={[styles.input, !scheduledAt && styles.placeholder]}>
              {scheduledAt
                ? scheduledAt.toLocaleDateString('es-DO', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  }) + (scheduledAt.getHours() !== 0 || scheduledAt.getMinutes() !== 0
                    ? `, ${scheduledAt.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}`
                    : '')
                : 'Elige fecha y hora'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={scheduledAt || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(e: DateTimePickerEvent, selected?: Date) => {
                setShowDatePicker(false)
                if (e.type === 'set' && selected) {
                  const d = new Date(scheduledAt || new Date())
                  d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
                  setScheduledAt(d)
                  if (Platform.OS !== 'ios') setShowTimePicker(true)
                }
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={scheduledAt || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(e: DateTimePickerEvent, selected?: Date) => {
                setShowTimePicker(false)
                if (e.type === 'set' && selected) {
                  const d = new Date(scheduledAt || new Date())
                  d.setHours(selected.getHours(), selected.getMinutes())
                  setScheduledAt(d)
                }
              }}
            />
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.button, (!title.trim() || !scheduledAt || saving) && styles.disabled]}
            disabled={!title.trim() || !scheduledAt || saving}
            onPress={submit}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Crear sala virtual</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: insets.bottom + 20 }} />
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
  placeholder: { color: '#69746d' },
  error: { color: '#fc8181', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  button: { backgroundColor: '#28533a', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 4 },
  disabled: { opacity: 0.35 },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
})
