import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import ScalePressable from '../components/ScalePressable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../lib/queries'
import type { RootStackParamList } from '../../App'
import InviteSection from '../components/InviteSection'

type Nav = NativeStackNavigationProp<RootStackParamList>
type GroupRoute = RouteProp<RootStackParamList, 'Group'>

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
}

function relativeTime(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays > 0) return diffDays === 1 ? 'Mañana' : 'En ' + diffDays + ' día' + (diffDays > 1 ? 's' : '')
  if (diffDays === 0) {
    if (diffHours > 0) return 'En ' + diffHours + 'h'
    if (diffMins > 0) return 'En ' + diffMins + 'min'
    return 'Ahora'
  }
  if (diffDays === -1) return 'Ayer'
  return 'Hace ' + Math.abs(diffDays) + ' día' + (Math.abs(diffDays) > 1 ? 's' : '')
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
  return date.toLocaleDateString('es-DO', options)
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  voting: { label: 'Votación', color: '#b45309', bg: '#fef3c7' },
  confirmed: { label: 'Confirmado', color: '#166534', bg: '#dcfce7' },
  completed: { label: 'Listo', color: '#374151', bg: '#f3f4f6' },
  cancelled: { label: 'Cancelado', color: '#991b1b', bg: '#fee2e2' },
}

export default function Group() {
  const nav = useNavigation<Nav>()
  const route = useRoute<GroupRoute>()
  const { groupId } = route.params
  const { data: user } = useCurrentUser()
  const insets = useSafeAreaInsets()
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data: group, error: ge } = await supabase
        .from('groups').select('id, name, created_by').eq('id', groupId).single()
      if (ge) throw ge
      const { data: members, error: me } = await supabase
        .from('group_members').select('user_id, role, joined_at, profiles(id, full_name, avatar_url)')
        .eq('group_id', groupId)
      if (me) throw me
      const { data: plans, error: pe } = await supabase
        .from('plans').select('id, title, scheduled_at, status, created_by, selected_option_id, plan_type')
        .eq('group_id', groupId).order('scheduled_at')
      if (pe) throw pe
      const planIds = (plans || []).map((p: any) => p.id)
      let participantCounts: Record<string, number> = {}
      if (planIds.length > 0) {
        const { data: participants } = await supabase
          .from('plan_participants').select('plan_id').in('plan_id', planIds).eq('attendance_status', 'going')
        if (participants) {
          participants.forEach((p: any) => {
            participantCounts[p.plan_id] = (participantCounts[p.plan_id] || 0) + 1
          })
        }
      }
      return { group, members: members || [], plans: plans || [], participantCounts }
    },
  })

  const genInvite = useMutation({
    mutationFn: async () => {
      const { data: token, error } = await supabase.rpc('create_invite', { target_group_id: groupId })
      if (error) throw error
      return token as string
    },
    onSuccess: (token) => setInviteLink('juntapp://invite/' + token),
  })

  useEffect(() => {
    if (data?.group?.name) nav.setOptions({ headerTitle: data.group.name })
  }, [data, nav])

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#28533a" /></View>
  if (isError || !data?.group) return (
    <View style={styles.container}>
      <Text style={styles.emptyState}>No pudimos abrir este grupo.</Text>
    </View>
  )

  const { group, members, plans, participantCounts } = data
  const isOwner = user?.id === group.created_by
  const now = new Date()
  const upcoming = plans.filter((p: any) => new Date(p.scheduled_at) >= now)
  const past = plans.filter((p: any) => new Date(p.scheduled_at) < now)
  const nextPlan = upcoming[0]

  function leaveGroup() {
    Alert.alert('Salir del grupo', '¿Seguro que quieres salir del grupo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('leave_group', { target_group_id: groupId })
        if (!error) nav.navigate('MainTabs', { screen: 'Dashboard' })
      }},
    ])
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.groupTitle}>
          <View style={styles.groupIconLarge}>
            <Text style={styles.groupIconLargeText}>{initials(group.name)}</Text>
          </View>
          <View>
            <Text style={styles.eyebrow}>TU GRUPO</Text>
            <Text style={styles.groupNameTitle}>{group.name}</Text>
          </View>
        </View>

        <View style={styles.statsLine}>
          <Text style={styles.statsIcon}>{upcoming.length > 0 ? '🔥' : '😴'}</Text>
          <Text style={styles.statsText}>
            <Text style={styles.statsBold}>{members.length} miembro{members.length !== 1 ? 's' : ''}</Text>
            <Text style={styles.statsBold}>{' · '}{upcoming.length} plan{upcoming.length !== 1 ? 'es' : ''} pendiente{upcoming.length !== 1 ? 's' : ''}</Text>
          </Text>
        </View>

        {nextPlan && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => nav.navigate('Plan', { planId: nextPlan.id })}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>🎯 PRÓXIMO JUNTE</Text>
            <Text style={styles.heroTitle}>{nextPlan.title}</Text>
            <Text style={styles.heroMeta}>
              {formatDateShort(nextPlan.scheduled_at)} · {formatTime(nextPlan.scheduled_at)}
            </Text>
            {(participantCounts[nextPlan.id] || 0) > 0 && (
              <Text style={styles.heroAssistants}>
                {participantCounts[nextPlan.id]} asistente{participantCounts[nextPlan.id] !== 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>CRONOGRAMA</Text>
            <Text style={styles.sectionTitle}>Planes</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.discoverBtn} onPress={() => nav.navigate('Discover', { groupId })}>
              <Text style={styles.discoverBtnText}>✨ Descubrir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addPlanBtn} onPress={() => nav.navigate('NewPlan', { groupId })}>
              <Text style={styles.addPlanBtnText}>+ Plan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStrong}>Aún no hay planes.</Text>
            <Text style={styles.emptySpan}>Crea el primero para que el grupo empiece a coordinar.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {upcoming.length > 0 && (
              <View style={styles.timelineSection}>
                {upcoming.map((plan: any, idx: number) => {
                  const st = statusConfig[plan.status] || statusConfig.voting
                  const going = participantCounts[plan.id] || 0
                  const isLast = idx === upcoming.length - 1 && past.length === 0
                  return (
                    <View key={plan.id} style={styles.timelineItem}>
                      <View style={styles.timelineCol}>
                        <View style={[styles.timelineDot, { backgroundColor: st.bg, borderColor: st.color }]} />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                      <ScalePressable
                        style={styles.timelineCard}
                        onPress={() => nav.navigate('Plan', { planId: plan.id })}
                      >
                        <View style={styles.timelineTop}>
                          <Text style={styles.timelineDate}>{formatDateTime(plan.scheduled_at)}</Text>
                          <Text style={styles.timelineRelative}>{relativeTime(plan.scheduled_at)}</Text>
                        </View>
                        <Text style={styles.timelineTitle}>{plan.title}</Text>
                        <View style={styles.timelineBottom}>
                          <View style={[styles.timelineBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.timelineBadgeText, { color: st.color }]}>{st.label}</Text>
                          </View>
                          {plan.plan_type === 'watch_party' && (
                            <View style={[styles.timelineBadge, { backgroundColor: '#dbeafe' }]}>
                              <Text style={[styles.timelineBadgeText, { color: '#1e40af' }]}>🎬 Watch</Text>
                            </View>
                          )}
                          {going > 0 && <Text style={styles.timelineGoing}>{going} {going === 1 ? 'asiste' : 'asisten'}</Text>}
                        </View>
                      </ScalePressable>
                    </View>
                  )
                })}
              </View>
            )}
            {past.length > 0 && (
              <View style={styles.timelineSection}>
                <Text style={styles.timelineLabel}>Anteriores</Text>
                {past.slice(0, 5).map((plan: any, idx: number) => {
                  const st = statusConfig[plan.status] || statusConfig.completed
                  const going = participantCounts[plan.id] || 0
                  const isLast = idx === past.slice(0, 5).length - 1
                  return (
                    <View key={plan.id} style={styles.timelineItem}>
                      <View style={styles.timelineCol}>
                        <View style={[styles.timelineDot, { backgroundColor: st.bg, borderColor: st.color }]} />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                      <ScalePressable
                        style={[styles.timelineCard, { opacity: 0.55 }]}
                        onPress={() => nav.navigate('Plan', { planId: plan.id })}
                      >
                        <View style={styles.timelineTop}>
                          <Text style={styles.timelineDate}>{formatDateTime(plan.scheduled_at)}</Text>
                          <Text style={styles.timelineRelative}>{relativeTime(plan.scheduled_at)}</Text>
                        </View>
                        <Text style={styles.timelineTitle}>{plan.title}</Text>
                        <View style={styles.timelineBottom}>
                          <View style={[styles.timelineBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.timelineBadgeText, { color: st.color }]}>{st.label}</Text>
                          </View>
                          {plan.plan_type === 'watch_party' && (
                            <View style={[styles.timelineBadge, { backgroundColor: '#dbeafe' }]}>
                              <Text style={[styles.timelineBadgeText, { color: '#1e40af' }]}>🎬 Watch</Text>
                            </View>
                          )}
                          {going > 0 && <Text style={styles.timelineGoing}>{going} {going === 1 ? 'asiste' : 'asisten'}</Text>}
                        </View>
                      </ScalePressable>
                    </View>
                  )
                })}
                {past.length > 5 && (
                  <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#69746d', textAlign: 'center', marginTop: 8 }}>
                    +{past.length - 5} planes anteriores
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        <InviteSection
          inviteLink={inviteLink}
          groupName={group.name}
          isOwner={isOwner}
          onGenerate={() => genInvite.mutate()}
          isPending={genInvite.isPending}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.eyebrow}>MIEMBROS</Text>
          <Text style={styles.sectionTitle}>{members.length} {members.length === 1 ? 'persona' : 'personas'}</Text>
        </View>

        {members.slice(0, 3).map((m: any) => (
          <View style={styles.memberCard} key={m.user_id}>
            <View style={styles.groupIconSmall}>
              <Text style={styles.groupIconSmallText}>{initials(m.profiles?.full_name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.profiles?.full_name || 'Usuario'}</Text>
              <Text style={styles.memberRole}>{m.role === 'owner' ? 'Creador' : 'Miembro'}</Text>
            </View>
          </View>
        ))}
        {members.length > 3 && (
          <TouchableOpacity onPress={() => nav.navigate('Members', { groupId })}>
            <Text style={styles.moreMembers}>+{members.length - 3} miembros más</Text>
          </TouchableOpacity>
        )}

        {!isOwner ? (
          <TouchableOpacity style={styles.leaveButton} onPress={leaveGroup}>
            <Text style={styles.leaveButtonText}>Salir del grupo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={() => Alert.alert('Eliminar grupo', '¿Seguro que quieres eliminar este grupo? Todos los planes y miembros se eliminarán.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: async () => {
                const { error } = await supabase.rpc('delete_group', { target_group_id: groupId })
                if (!error) nav.navigate('MainTabs', { screen: 'Dashboard' })
              }},
            ])}
          >
            <Text style={styles.leaveButtonText}>Eliminar grupo</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0' },
  scroll: { flex: 1, paddingHorizontal: 20 },

  groupTitle: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 20 },
  groupIconLarge: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#e8efdf', justifyContent: 'center', alignItems: 'center' },
  groupIconLargeText: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#28533a' },
  groupIconSmall: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e8efdf', justifyContent: 'center', alignItems: 'center', marginRight: 13 },
  groupIconSmallText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#28533a' },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 9 },
  groupNameTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 28, letterSpacing: -1, color: '#18261f' },

  statsLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  statsIcon: { fontSize: 14 },
  statsText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#69746d' },
  statsBold: { fontFamily: 'DMSans_700Bold', color: '#18261f' },

  heroCard: {
    backgroundColor: '#f0f7f0', borderRadius: 14, padding: 20, marginBottom: 8,
    borderWidth: 1, borderColor: '#d0dfc0',
  },
  heroLabel: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#28533a', marginBottom: 8 },
  heroTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 24, lineHeight: 28, letterSpacing: -1, color: '#18261f', marginBottom: 6 },
  heroMeta: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#28533a' },
  heroAssistants: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#69746d', marginTop: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28, marginBottom: 15 },
  sectionTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25, letterSpacing: -1, color: '#18261f' },
  addPlanBtn: { backgroundColor: '#28533a', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  addPlanBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#fff' },
  discoverBtn: { backgroundColor: '#f0f7f0', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#d9ddd4' },
  discoverBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#28533a' },
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 12, marginBottom: 10 },
  memberName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f' },
  memberRole: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d', marginTop: 2 },
  moreMembers: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#69746d', textAlign: 'center', marginTop: 4 },

  emptyState: { alignItems: 'center' as const, paddingVertical: 40 },
  emptyStrong: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f', marginBottom: 4, textAlign: 'center' as const },
  emptySpan: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#69746d', textAlign: 'center' as const },
  timeline: { paddingLeft: 24 },
  timelineSection: { marginBottom: 24 },
  timelineLabel: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 14 },
  timelineItem: { flexDirection: 'row', gap: 14, position: 'relative' },
  timelineCol: { alignItems: 'center', width: 12, flexShrink: 0 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1, marginTop: 18, backgroundColor: '#fff' },
  timelineLine: { position: 'absolute', left: 5, top: 30, bottom: 0, width: 2, backgroundColor: '#d9ddd4' },
  timelineCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 12, padding: 14, marginBottom: 10 },
  timelineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  timelineDate: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#69746d', letterSpacing: 0.3 },
  timelineRelative: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: '#28533a' },
  timelineTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, lineHeight: 24, letterSpacing: -0.5, color: '#18261f', marginBottom: 10 },
  timelineBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  timelineBadgeText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  timelineGoing: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d' },
  leaveButton: { marginTop: 30, paddingVertical: 14, borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 10, alignItems: 'center' as const },
  leaveButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#a22c20' },
})
