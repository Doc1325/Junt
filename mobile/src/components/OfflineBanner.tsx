import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNetInfo } from '@react-native-community/netinfo'

export default function OfflineBanner() {
  const network = useNetInfo()
  const insets = useSafeAreaInsets()
  if (network.isConnected !== false) return null

  return (
    <View style={[styles.banner, { paddingTop: Math.max(insets.top, 8) }]}>
      <Text style={styles.text}>Sin conexión. Reintentaremos cuando vuelva el internet.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#8a4b08', paddingHorizontal: 16, paddingBottom: 8 },
  text: { color: '#fff', textAlign: 'center', fontFamily: 'DMSans_700Bold', fontSize: 12 },
})

