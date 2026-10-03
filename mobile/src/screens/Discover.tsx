import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import Recommendations from '../components/Recommendations'
import type { RecommendItem } from '../lib/recommendations'
import type { RootStackParamList } from '../../App'
import { colors, fonts } from '../theme'

type Nav = NativeStackNavigationProp<RootStackParamList>
type DiscoverRoute = RouteProp<RootStackParamList, 'Discover'>

export default function Discover() {
  const nav = useNavigation<Nav>()
  const route = useRoute<DiscoverRoute>()
  const insets = useSafeAreaInsets()
  const { groupId } = route.params

  function handleSelect(item: RecommendItem) {
    const isMovie = item.kind === 'cine'
    const slug = String(item.slug ?? item.external_id ?? '')
    nav.navigate('EventDetail', {
      kind: isMovie ? 'cine' : 'evento',
      slug,
      groupId,
      item: JSON.stringify(item),
    })
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.page}>
        <TouchableOpacity onPress={() => nav.navigate('Group', { groupId })}>
          <Text style={styles.back}>← Volver al grupo</Text>
        </TouchableOpacity>
        <Recommendations onSelect={handleSelect} groupId={groupId} />
      </View>
      <View style={{ height: insets.bottom + 20 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  page: { padding: 16, gap: 12 },
  back: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.muted },
})
