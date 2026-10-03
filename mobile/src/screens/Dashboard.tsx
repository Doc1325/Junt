import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useGroups, useFriendsCount, usePendingPlansCount } from '../lib/queries'
import type { RootStackParamList, MainTabParamList } from '../../App'
import Shell from '../components/Shell'
import StatsCards from '../components/StatsCards'
import ScalePressable from '../components/ScalePressable'

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function Dashboard() {
  const nav = useNavigation<Nav>()
  const { data: groups = [], isLoading, isError } = useGroups()
  const { data: friendsCount = 0 } = useFriendsCount()
  const { data: pendingCount = 0 } = usePendingPlansCount()

  return (
    <Shell>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>TUS PLANES</Text>
            <Text style={styles.heroTitle}>¿Qué hacemos{"\n"}esta vez?</Text>
            <Text style={styles.heroSub}>Decidan sin el eterno "¿qué quieren hacer?".</Text>
          </View>
        </View>

        <StatsCards cards={[
          { icon: 'people', value: groups.length, label: 'Grupos' },
          { icon: 'calendar-outline', value: pendingCount, label: 'Pendientes' },
          { icon: 'heart-outline', value: friendsCount, label: 'Amigos' },
        ]} />

        <View style={[styles.sectionHeader, groups.length === 0 && { marginTop: 0 }]}>
          <View>
            <Text style={styles.eyebrow}>TUS GRUPOS</Text>
            <Text style={styles.sectionTitle}>Donde ocurre el plan</Text>
          </View>
        </View>

        {isLoading && <Text style={styles.emptyState}>Cargando tus grupos…</Text>}
        {isError && <Text style={styles.emptyState}>No pudimos cargar los grupos. Reinténtalo en un momento.</Text>}
        {!isLoading && !isError && groups.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStrong}>Aún no tienes grupos.</Text>
            <Text style={styles.emptySpan}>Crea uno para empezar a decidir planes.</Text>
          </View>
        )}

        {groups.map((group) => (
          <ScalePressable
            key={group.id}
            style={styles.groupCard}
            onPress={() => nav.navigate('Group', { groupId: group.id })}
          >
            <View style={styles.groupIcon}>
              <Text style={styles.groupIconText}>{initials(group.name)}</Text>
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupHint}>Abre el grupo para crear su primer plan</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </ScalePressable>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>
    </Shell>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 20 },
  heroSection: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 40, paddingHorizontal: 2, gap: 20 },
  heroCopy: { flex: 1 },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 9 },
  heroTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 47, lineHeight: 48, letterSpacing: -2.5, color: '#18261f', marginBottom: 15 },
  heroSub: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#69746d', lineHeight: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24, marginBottom: 15 },
  sectionTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25, letterSpacing: -1, color: '#18261f' },
  emptyState: { alignItems: 'center' as const, paddingVertical: 40 },
  emptyStrong: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f', marginBottom: 4 },
  emptySpan: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#69746d' },
  groupCard: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 12, marginBottom: 10 },
  groupIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e8efdf', justifyContent: 'center', alignItems: 'center', marginRight: 13 },
  groupIconText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#28533a' },
  groupInfo: { flex: 1 },
  groupName: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#18261f' },
  groupHint: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#69746d', marginTop: 3 },
  chevron: { fontSize: 25, color: '#69746d', fontFamily: 'DMSans_400Regular', marginLeft: 'auto' as const },
})
