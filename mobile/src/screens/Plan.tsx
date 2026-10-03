import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native'
import ScalePressable from '../components/ScalePressable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useCurrentUser, useVirtualRoom } from '../lib/queries'
import type { RootStackParamList } from '../../App'
import AttendancePills from '../components/AttendancePills'

type Nav = NativeStackNavigationProp<RootStackParamList>
type PlanRoute = RouteProp<RootStackParamList, 'Plan'>

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
  return date.toLocaleDateString('es-DO', options).toUpperCase()
}

export default function Plan() {
  const nav = useNavigation<Nav>()
  const route = useRoute<PlanRoute>()
  const insets = useSafeAreaInsets()
  const { planId } = route.params
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null)
  const currentUserId = user?.id
  const { data: virtualRoom } = useVirtualRoom(planId)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['plan', planId],
    queryFn: async () => {
      const { data: plan, error: pe } = await supabase.from('plans').select('*, group:group_id(id, name, created_by)').eq('id', planId).single()
      if (pe) throw pe
      const { data: options, error: oe } = await supabase.from('plan_options').select('*, votes(*)').eq('plan_id', planId)
      if (oe) throw oe
      const { data: participants, error: ppe } = await supabase
        .from('plan_participants').select('*, profiles(id, full_name, avatar_url)').eq('plan_id', planId)
      if (ppe) throw ppe
      const { data: members, error: me } = await supabase
        .from('group_members').select('user_id, profiles(id, full_name, avatar_url)').eq('group_id', plan.group_id)
      if (me) throw me
      return { plan, options: options || [], participants: participants || [], members: members || [] }
    },
  })

  const myVotes = data?.options?.flatMap((o: any) => o.votes?.filter((v: any) => v.user_id === currentUserId) || []) || []
  const totalVotes = data?.options?.reduce((sum: number, o: any) => sum + (o.votes?.length || 0), 0) || 0
  const myAttendance = data?.participants?.find((p: any) => p.user_id === currentUserId)?.attendance_status
  const isCreator = data?.plan?.created_by === currentUserId
  const isGroupCreator = data?.plan?.group?.created_by === currentUserId

  const voteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      setError(null)
      if (myVotes.some((v: any) => v.option_id === optionId)) {
        const { error } = await supabase.from('votes').delete().match({ option_id: optionId, user_id: currentUserId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('votes').insert({ option_id: optionId, user_id: currentUserId })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  const attendanceMutation = useMutation({
    mutationFn: async (status: string) => {
      setError(null)
      if (myAttendance === status) return
      const { error } = await supabase.from('plan_participants').upsert({ plan_id: planId, user_id: currentUserId, attendance_status: status })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  const closeVoteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      setError(null)
      const { error } = await supabase.rpc('close_vote', { target_plan_id: planId, selected_option: optionId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  function handleCloseVote() {
    if (!selectedWinner) return
    closeVoteMutation.mutate(selectedWinner)
    setConfirming(false)
    setSelectedWinner(null)
  }

  const cancelMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      const { error } = await supabase.rpc('cancel_plan', { target_plan_id: planId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      const { error } = await supabase.rpc('delete_plan', { target_plan_id: planId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['plan', planId] })
      nav.goBack()
    },
    onError: (e: Error) => setError(e.message),
  })

  useEffect(() => {
    if (data?.plan) nav.setOptions({ headerTitle: data.plan.title })
  }, [data, nav])

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#28533a" /></View>
  if (isError || !data?.plan) return (
    <View style={styles.container}>
      <Text style={styles.emptyState}>No pudimos cargar este plan.</Text>
    </View>
  )

  const { plan, options, participants, members } = data
  const going = participants.filter((p: any) => p.attendance_status === 'going')
  const maybe = participants.filter((p: any) => p.attendance_status === 'maybe')
  const notGoing = participants.filter((p: any) => p.attendance_status === 'not_going')
  const respondedIds = new Set(participants.map((p: any) => p.user_id))
  const pending = members.filter((m: any) => !respondedIds.has(m.user_id))
  const statusLabel: Record<string, string> = { voting: 'VOTACIÓN ABIERTA', confirmed: 'CONFIRMADO', completed: 'COMPLETADO', cancelled: 'CANCELADO' }

  function shareWhatsApp() {
    const text = '📍 Nuevo plan en JuntApp: ' + plan.title + '\n\nhttps://junte.netlify.app/plans/' + plan.id
    Linking.openURL('https://wa.me/?text=' + encodeURIComponent(text))
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.planHeader}>
          <Text style={styles.eyebrow}>{statusLabel[plan.status]} · {formatDateShort(plan.scheduled_at)}</Text>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <Text style={styles.planDesc}>
            {plan.plan_type === 'watch_party' ? 'Watch Party coordinada por el grupo.' : (plan.description || 'Elijan una o varias opciones. Puedes cambiar tu voto.')}
          </Text>
        </View>

        {plan.plan_type === 'watch_party' && (
          <View style={{ marginTop: 20, marginBottom: 20 }}>
            {virtualRoom ? (
              <TouchableOpacity
                style={styles.enterRoomBtn}
                onPress={() => nav.navigate('WatchRoom', { roomId: virtualRoom.id })}
              >
                <Text style={styles.enterRoomBtnText}>🖥️ Entrar a la sala</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#69746d', textAlign: 'center' }}>Cargando sala…</Text>
            )}
          </View>
        )}

        {plan.plan_type !== 'watch_party' && plan.status === 'voting' && (
          <>
            <View style={styles.votesSection}>
              {options.map((option: any) => {
                const voteCount = option.votes?.length || 0
                const pct = totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0
                const isSelected = myVotes.some((v: any) => v.option_id === option.id)
                const isWinnerPick = confirming && selectedWinner === option.id
                return (
                  <ScalePressable
                    key={option.id}
                    style={[styles.voteCard, (isSelected || isWinnerPick) && styles.voteSelected]}
                    onPress={() => confirming ? setSelectedWinner(option.id) : voteMutation.mutate(option.id)}
                    disabled={voteMutation.isPending}
                  >
                    <View style={[styles.check, (isSelected || isWinnerPick) && styles.checkFilled]}>
                      <Text style={[styles.checkText, (isSelected || isWinnerPick) && styles.checkTextActive]}>{(isSelected || isWinnerPick) ? '✓' : ''}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.voteTitle}>{option.title}</Text>
                      <Text style={styles.voteCount}>{voteCount} {voteCount === 1 ? 'voto' : 'votos'}</Text>
                      <View style={styles.voteProgress}>
                        <View style={[styles.voteProgressFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.votePct}>{pct}%</Text>
                  </ScalePressable>
                )
              })}
            </View>

            {isCreator && !confirming && (
              <TouchableOpacity style={styles.closeVoteButton} onPress={() => setConfirming(true)}>
                <Text style={styles.closeVoteText}>Cerrar votación</Text>
              </TouchableOpacity>
            )}

            {confirming && (
              <View style={styles.confirmSection}>
                <Text style={styles.confirmHint}>
                  Selecciona la opción ganadora y confirma
                </Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.cancelBtn]}
                    onPress={() => { setConfirming(false); setSelectedWinner(null) }}
                  >
                    <Text style={styles.confirmButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, (!selectedWinner || closeVoteMutation.isPending) && styles.disabled]}
                    disabled={!selectedWinner || closeVoteMutation.isPending}
                    onPress={handleCloseVote}
                  >
                    <Text style={styles.confirmButtonText}>
                      {closeVoteMutation.isPending ? 'Cerrando…' : 'Confirmar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {plan.plan_type !== 'watch_party' && plan.status === 'confirmed' && plan.selected_option_id && (
          <View style={styles.votesSection}>
            {options.map((option: any) => {
              const isWinner = option.id === plan.selected_option_id
              return (
                <View key={option.id} style={[styles.voteCard, isWinner && styles.voteSelected, { opacity: isWinner ? 1 : 0.5 }]}>
                  <View style={[styles.check, isWinner && styles.checkFilled]}>
                    <Text style={[styles.checkText, isWinner && styles.checkTextActive]}>{isWinner ? '✓' : ''}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voteTitle}>{option.title}</Text>
                    {isWinner && <Text style={styles.winnerLabel}>Ganadora</Text>}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {plan.plan_type !== 'watch_party' && plan.status === 'confirmed' && options.length === 0 && (
          <View style={styles.confirmedBanner}>
            <Text style={styles.confirmedBannerTitle}>Plan confirmado</Text>
            <Text style={styles.confirmedBannerSub}>Este plan no requiere votación.</Text>
          </View>
        )}

        {plan.plan_type !== 'watch_party' && (plan.status === 'completed' || plan.status === 'cancelled') && options.length > 0 && (
          <View style={styles.votesSection}>
            {options.map((option: any) => {
              const isWinner = option.id === plan.selected_option_id
              return (
                <View key={option.id} style={[styles.voteCard, isWinner && styles.voteSelected, { opacity: 0.5 }]}>
                  <View style={[styles.check, isWinner && styles.checkFilled]}>
                    <Text style={[styles.checkText, isWinner && styles.checkTextActive]}>{isWinner ? '✓' : ''}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voteTitle}>{option.title}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {plan.plan_type !== 'watch_party' && (
        <View style={styles.attendance}>
          <Text style={styles.eyebrow}>¿Vas a poder?</Text>
          <Text style={styles.attendanceTitle}>Confirma tu asistencia</Text>
          <View style={styles.attendanceRow}>
            {(['going', 'maybe', 'not_going'] as const).map((status) => {
              const labels: Record<string, string> = { going: 'Voy', maybe: 'Tal vez', not_going: 'No voy' }
              return (
                <TouchableOpacity
                  key={status}
                  style={[styles.attendanceBtn, myAttendance === status && styles.attendanceBtnActive]}
                  onPress={() => attendanceMutation.mutate(status)}
                  disabled={attendanceMutation.isPending}
                >
                  <Text style={[styles.attendanceBtnText, myAttendance === status && styles.attendanceBtnTextActive]}>
                    {labels[status]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <AttendancePills going={going} maybe={maybe} notGoing={notGoing} pending={pending} />
        </View>
        )}

        {plan.plan_type !== 'watch_party' && isCreator && plan.status !== 'completed' && plan.status !== 'cancelled' && (
          <TouchableOpacity
            style={styles.cancelPlanButton}
            disabled={cancelMutation.isPending}
            onPress={() => {
              Alert.alert('Cancelar plan', '¿Estás seguro? El plan se marcará como cancelado.', [
                { text: 'No', style: 'cancel' },
                { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelMutation.mutate() },
              ])
            }}
          >
            <Text style={styles.cancelPlanText}>
              {cancelMutation.isPending ? 'Cancelando…' : 'Cancelar plan'}
            </Text>
          </TouchableOpacity>
        )}

        {isGroupCreator && (
          <TouchableOpacity
            style={styles.deletePlanButton}
            disabled={deleteMutation.isPending}
            onPress={() => {
              Alert.alert('Eliminar plan', '¿Estás seguro? Esta acción eliminará el plan permanentemente.', [
                { text: 'No', style: 'cancel' },
                { text: 'Sí, eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
              ])
            }}
          >
            <Text style={styles.deletePlanText}>
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar plan'}
            </Text>
          </TouchableOpacity>
        )}

        {plan.plan_type !== 'watch_party' && plan.status !== 'voting' && (
          <TouchableOpacity style={styles.whatsappShare} onPress={shareWhatsApp}>
            <Text style={styles.whatsappShareText}>Compartir en WhatsApp</Text>
          </TouchableOpacity>
        )}

        {error && <Text style={styles.formError}>{error}</Text>}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  emptyState: { textAlign: 'center' as const, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#69746d', marginTop: 40 },
  planHeader: { marginBottom: 24 },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 9 },
  planTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 36, letterSpacing: -2, color: '#18261f', marginBottom: 12 },
  planDesc: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#69746d', lineHeight: 22 },
  votesSection: { gap: 10 },
  voteCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 12, gap: 12 },
  voteSelected: { borderWidth: 2, borderColor: '#28533a', backgroundColor: '#f0f7f0' },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#a9b5aa', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  checkFilled: { backgroundColor: '#28533a', borderColor: '#28533a' },
  checkText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: 'transparent' },
  checkTextActive: { color: '#fff' },
  voteTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f' },
  voteCount: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d', marginTop: 3 },
  votePct: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#69746d' },
  voteProgress: { marginTop: 6, height: 4, backgroundColor: '#d9ddd4', borderRadius: 2, overflow: 'hidden' },
  voteProgressFill: { height: '100%', backgroundColor: '#28533a', borderRadius: 2 },
  closeVoteButton: { backgroundColor: '#5d6d62', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 20 },
  closeVoteText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  confirmSection: { marginTop: 16 },
  confirmHint: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#a22c20', marginBottom: 10 },
  confirmRow: { flexDirection: 'row', gap: 8 },
  confirmButton: { flex: 1, backgroundColor: '#28533a', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const },
  cancelBtn: { backgroundColor: '#5d6d62' },
  disabled: { opacity: 0.35 },
  confirmButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  winnerLabel: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#28533a', marginTop: 2 },
  confirmedBanner: { borderWidth: 1, borderColor: '#bcd49d', backgroundColor: '#f1f8e7', borderRadius: 12, padding: 20, alignItems: 'center' as const },
  confirmedBannerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f', marginBottom: 4 },
  confirmedBannerSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#69746d' },
  attendance: { marginTop: 32 },
  attendanceTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25, letterSpacing: -1, color: '#18261f', marginBottom: 16 },
  attendanceRow: { flexDirection: 'row', gap: 8 },
  attendanceBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d9ddd4', alignItems: 'center' as const, backgroundColor: '#fff' },
  attendanceBtnActive: { backgroundColor: '#28533a', borderColor: '#28533a' },
  attendanceBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f' },
  attendanceBtnTextActive: { color: '#fff' },

  cancelPlanButton: { backgroundColor: '#a22c20', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 24 },
  cancelPlanText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  deletePlanButton: { backgroundColor: '#8b0000', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 12 },
  deletePlanText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  whatsappShare: { backgroundColor: '#25D366', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const, marginTop: 24 },
  whatsappShareText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  formError: { color: '#fc8181', fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 16, textAlign: 'center' as const },
  enterRoomBtn: { backgroundColor: '#28533a', paddingVertical: 17, borderRadius: 10, alignItems: 'center' as const },
  enterRoomBtnText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16 },
})
