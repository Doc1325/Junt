import type { ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useProfile } from '../lib/queries'
import type { RootStackParamList, MainTabParamList } from '../../App'

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function Shell({ children }: { children: ReactNode }) {
  const nav = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const { data: profile } = useProfile()

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.brand}>junt<Text style={styles.dot}>·</Text></Text>
        <TouchableOpacity style={styles.avatar} onPress={() => nav.navigate('MainTabs', { screen: 'Profile' })}>
          <Text style={styles.avatarText}>{initials(profile?.full_name)}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f5f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  brand: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 35,
    letterSpacing: -2,
    color: '#18261f',
  },
  dot: {
    color: '#65a838',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#d8eabb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 12,
    color: '#28533a',
  },
  content: {
    flex: 1,
  },
})
