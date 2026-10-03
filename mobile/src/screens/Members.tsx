import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoute } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import type { RouteProp } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../../App'

type MembersRoute = RouteProp<RootStackParamList, 'Members'>

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
}

export default function Members() {
  const route = useRoute<MembersRoute>()
  const insets = useSafeAreaInsets()
  const { groupId } = route.params

  const { data, isLoading } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data: g, error: ge } = await supabase
        .from('groups').select('id, name').eq('id', groupId).single()
      if (ge) throw ge
      const { data: members, error: me } = await supabase
        .from('group_members').select('user_id, role, joined_at, profiles(id, full_name, avatar_url)')
        .eq('group_id', groupId).order('role', { ascending: false })
      if (me) throw me
      return { ...g, members: members || [] }
    },
  })

  if (isLoading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#28533a" />
    </View>
  )
  if (!data) return (
    <View style={styles.container}>
      <Text style={styles.empty}>No pudimos cargar los miembros.</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.count}>
          {data.members.length} {data.members.length === 1 ? 'persona' : 'personas'}
        </Text>
        {data.members.map((m: any) => (
          <View style={styles.card} key={m.user_id}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(m.profiles?.full_name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{m.profiles?.full_name || 'Usuario'}</Text>
              <Text style={styles.role}>{m.role === 'owner' ? 'Creador' : 'Miembro'}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f5f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  empty: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#69746d', textAlign: 'center', marginTop: 40 },
  count: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25, letterSpacing: -1, color: '#18261f', marginBottom: 16, marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e8efdf', justifyContent: 'center', alignItems: 'center', marginRight: 13 },
  avatarText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#28533a' },
  name: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f' },
  role: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d', marginTop: 2 },
})
