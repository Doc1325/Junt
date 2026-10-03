import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../../App'

type Nav = NativeStackNavigationProp<RootStackParamList>
type PlanRoute = RouteProp<RootStackParamList, 'NewPlan'>

export default function NewPlan() {
  const nav = useNavigation<Nav>()
  const route = useRoute<PlanRoute>()
  const insets = useSafeAreaInsets()
  const { groupId, prefillTitle, prefillDescription, prefillScheduledAt } = route.params
  const [planType, setPlanType] = useState<'physical' | 'watch_party'>('physical')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null)

  useEffect(() => {
    if (prefillTitle) setTitle(prefillTitle)
    if (prefillDescription) setDescription(prefillDescription)
    if (prefillScheduledAt) {
      const d = new Date(prefillScheduledAt)
      if (!isNaN(d.getTime())) setScheduledAt(d)
    }
  }, [prefillTitle, prefillDescription, prefillScheduledAt])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const pickingRef = useRef(false)
  const [options, setOptions] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function notifyMembers(planId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !anonKey) return
      await fetch(`${supabaseUrl}/functions/v1/notify-new-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({ planId }),
      })
    } catch (e) {
      console.warn('[notify-new-plan] fallo', e)
    }
  }

  async function submit() {
    if (!title.trim() || !scheduledAt || saving) return
    const optionTitles = options.split('\n').map((o) => o.trim()).filter(Boolean)
    setSaving(true)
    setError(null)
    const { data: planId, error: rpcError } = await supabase.rpc('create_plan', {
      target_group_id: groupId,
      plan_title: title.trim(),
      plan_scheduled_at: scheduledAt.toISOString(),
      option_titles: optionTitles,
      plan_type: planType,
    })
    if (rpcError || !planId) {
      setError('No pudimos publicar el plan. Inténtalo de nuevo.')
      setSaving(false)
      return
    }
    notifyMembers(planId as string)
    nav.replace('Plan', { planId: planId as string })
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formPage}>
        <Text style={styles.eyebrow}>NUEVO PLAN</Text>
        <Text style={styles.title}>Que empiece{"\n"}la decisión.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Tipo de plan</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPlanType('physical')}
              style={[styles.typeCard, planType === 'physical' && styles.typeCardActive]}
            >
              <Text style={styles.typeIcon}>📍</Text>
              <Text style={[styles.typeTitle, planType === 'physical' && styles.typeTitleActive]}>Salida presencial</Text>
              <Text style={styles.typeDesc}>Cena, tragos, cine, playa, deportes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setPlanType('watch_party')}
              style={[styles.typeCard, planType === 'watch_party' && styles.typeCardActive]}
            >
              <Text style={styles.typeIcon}>🎬</Text>
              <Text style={[styles.typeTitle, planType === 'watch_party' && styles.typeTitleActive]}>Watch Party</Text>
              <Text style={styles.typeDesc}>Compartan pantalla, vean videos o hagan streaming juntos</Text>
            </TouchableOpacity>
          </View>

          {planType === 'physical' ? (
            <>
              <Text style={styles.label}>¿Qué quieren hacer?</Text>
              <TextInput
                autoFocus
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Cena o tragos"
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
                    if (pickingRef.current) return
                    pickingRef.current = true
                    setShowDatePicker(false)
                    if (e.type === 'set' && selected) {
                      const d = new Date(scheduledAt || new Date())
                      d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
                      setScheduledAt(d)
                      if (Platform.OS !== 'ios') {
                        setShowTimePicker(true)
                      }
                    }
                    pickingRef.current = false
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={scheduledAt || new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e: DateTimePickerEvent, selected?: Date) => {
                    if (pickingRef.current) return
                    pickingRef.current = true
                    setShowTimePicker(false)
                    if (e.type === 'set' && selected) {
                      const d = new Date(scheduledAt || new Date())
                      d.setHours(selected.getHours(), selected.getMinutes())
                      setScheduledAt(d)
                    }
                    pickingRef.current = false
                  }}
                />
              )}
              <Text style={styles.label}>Opciones (opcional)</Text>
              <TextInput
                value={options}
                onChangeText={setOptions}
                placeholder={'Restaurante\nBar\nCafé'}
                placeholderTextColor="#69746d"
                multiline
                numberOfLines={4}
                style={[styles.input, styles.textarea]}
              />
              <Text style={styles.hint}>
                Si no añades opciones, el plan queda confirmado directo. Si añades opciones, el grupo vota.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Nombre de la actividad</Text>
              <TextInput
                autoFocus
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Ver Spiderman"
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
                    if (pickingRef.current) return
                    pickingRef.current = true
                    setShowDatePicker(false)
                    if (e.type === 'set' && selected) {
                      const d = new Date(scheduledAt || new Date())
                      d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate())
                      setScheduledAt(d)
                      if (Platform.OS !== 'ios') {
                        setShowTimePicker(true)
                      }
                    }
                    pickingRef.current = false
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={scheduledAt || new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e: DateTimePickerEvent, selected?: Date) => {
                    if (pickingRef.current) return
                    pickingRef.current = true
                    setShowTimePicker(false)
                    if (e.type === 'set' && selected) {
                      const d = new Date(scheduledAt || new Date())
                      d.setHours(selected.getHours(), selected.getMinutes())
                      setScheduledAt(d)
                    }
                    pickingRef.current = false
                  }}
                />
              )}
              <Text style={styles.label}>Descripción (opcional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Qué van a ver o hacer…"
                placeholderTextColor="#69746d"
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textarea]}
              />
              <View style={styles.infoBox}>
                <Text style={styles.infoIcon}>🎬</Text>
                <Text style={styles.infoText}>
                  Se creará automáticamente una sala virtual para compartir pantalla, audio y chat durante el evento.
                </Text>
              </View>
            </>
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
              <Text style={styles.buttonText}>Publicar plan</Text>
            )}
          </TouchableOpacity>
        </View>
        {/* <View style={styles.recoBlock}>
          <Recommendations
            groupId={groupId}
            onSelect={(item: RecommendItem) => {
              const isMovie = item.kind === 'cine'
              const slug = String(item.slug ?? item.external_id ?? '')
              nav.navigate('EventDetail', {
                kind: isMovie ? 'cine' : 'evento',
                slug,
                groupId,
                item: JSON.stringify(item),
              })
            }}
          />
          <Text style={styles.hint}>Tocando una tarjeta verás dirección y descripción completa.</Text>
        </View> */}
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
  textarea: { minHeight: 100, textAlignVertical: 'top' as const },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d', lineHeight: 18 },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: { flex: 1, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#d9ddd4', backgroundColor: '#fff' },
  typeCardActive: { borderColor: '#28533a', backgroundColor: '#f0f7f0' },
  typeIcon: { fontSize: 22 },
  typeTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f', marginTop: 8 },
  typeTitleActive: { color: '#28533a' },
  typeDesc: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d', marginTop: 3, lineHeight: 16 },

  infoBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#eef6ee', borderRadius: 10, padding: 14 },
  infoIcon: { fontSize: 18 },
  infoText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#28533a', lineHeight: 19, flex: 1 },

  recoBlock: { marginTop: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 14, padding: 16 },
  error: { color: '#fc8181', fontSize: 13, fontFamily: 'DMSans_400Regular' },
  button: { backgroundColor: '#28533a', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 4 },
  disabled: { opacity: 0.35 },
  buttonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
})
