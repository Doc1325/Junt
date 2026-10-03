import { useEffect, useState, useRef, useCallback } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import * as NavigationBar from 'expo-navigation-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { supabase, supabaseConfigured } from './src/lib/supabase'
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono'
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces'
import type { Session } from '@supabase/supabase-js'
import { useNotificationNavigation } from './src/lib/notifications'
import { registerForPushNotificationsAsync } from './src/lib/notifications'
import type { NotificationData } from './src/lib/notifications'

SystemUI.setBackgroundColorAsync('#f6f5f0')

import Login from './src/screens/Login'
import Onboarding from './src/screens/Onboarding'
import Dashboard from './src/screens/Dashboard'
import Profile from './src/screens/Profile'
import NewGroup from './src/screens/NewGroup'
import Group from './src/screens/Group'
import NewPlan from './src/screens/NewPlan'
import NewWatchPlan from './src/screens/NewWatchPlan'
import Plan from './src/screens/Plan'
import Members from './src/screens/Members'
import WatchRoom from './src/screens/WatchRoom'
import Join from './src/screens/Join'
import InviteAccept from './src/screens/InviteAccept'
import Discover from './src/screens/Discover'
import EventDetail from './src/screens/EventDetail'

export type RootStackParamList = {
  Login: undefined
  MainTabs: NavigatorScreenParams<MainTabParamList>
  Members: { groupId: string }
  Group: { groupId: string }
  NewPlan: { groupId: string; prefillTitle?: string; prefillDescription?: string; prefillScheduledAt?: string }
  NewWatchPlan: { groupId: string }
  Plan: { planId: string }
  WatchRoom: { roomId: string }
  Onboarding: undefined
  InviteAccept: { token: string }
  Discover: { groupId: string }
  EventDetail: { kind: string; slug: string; groupId: string; item?: string }
}

export type MainTabParamList = {
  Dashboard: undefined
  NewGroup: undefined
  Join: undefined
  Profile: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()

const queryClient = new QueryClient()

const tabIcons: Record<keyof MainTabParamList, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { focused: 'home', default: 'home-outline' },
  NewGroup: { focused: 'add-circle', default: 'add-circle-outline' },
  Join: { focused: 'log-in', default: 'log-in-outline' },
  Profile: { focused: 'person', default: 'person-outline' },
}

function MainTabs() {
  const insets = useSafeAreaInsets()
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icon = tabIcons[route.name as keyof MainTabParamList]
          return <Ionicons name={focused ? icon.focused : icon.default} size={size} color={color} />
        },
        tabBarActiveTintColor: '#28533a',
        tabBarInactiveTintColor: '#69746d',
        tabBarLabelStyle: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#d9ddd4',
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          height: insets.bottom + 64,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="NewGroup" component={NewGroup} />
      <Tab.Screen name="Join" component={Join} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  )
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(supabaseConfigured)
  const navigationRef = useRef<any>(null)

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!session) return null
      const { data, error } = await supabase.from('profiles').select('onboarded').eq('id', session.user.id).single()
      if (error) {
        // Si no hay fila aún, tratar como no onboarded para mostrar onboarding sin error
        if ((error as any).code === 'PGRST116') return { onboarded: false } as { onboarded: boolean | null }
        throw error
      }
      return data as { onboarded: boolean | null }
    },
    enabled: !!session,
  })

  const onNotificationNavigate = useCallback((data: NotificationData) => {
    if (data.planId) {
      navigationRef.current?.navigate('Plan', { planId: data.planId })
    } else if (data.groupId) {
      navigationRef.current?.navigate('Group', { groupId: data.groupId })
    }
  }, [])

  useNotificationNavigation(onNotificationNavigate)

  useEffect(() => {
    NavigationBar.setStyle('dark')
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) { setSessionLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setSessionLoading(false)
      if (session) registerForPushNotificationsAsync(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) registerForPushNotificationsAsync(nextSession.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (sessionLoading || (!!session && profileLoading)) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#28533a" /></View>
  }

  // Not logged in
  if (!session) {
    return (
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    )
  }

  // Logged in but not onboarded -> only onboarding stack, no flash of MainTabs
  if (!profile?.onboarded) {
    return (
      <NavigationContainer ref={navigationRef} key="onboarding">
        <Stack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="Onboarding" component={Onboarding} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    )
  }

  // Logged in and onboarded -> main app, Onboarding not in stack at all
  return (
    <NavigationContainer ref={navigationRef} key="main">
      <Stack.Navigator screenOptions={{ animation: 'slide_from_right' }}>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="Group"
              component={Group}
              options={{
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="NewPlan"
              component={NewPlan}
              options={{
                title: 'Nuevo plan',
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="Discover"
              component={Discover}
              options={{
                title: 'Descubrir',
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="EventDetail"
              component={EventDetail}
              options={{
                title: 'Detalle',
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="Plan"
              component={Plan}
              options={{
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="Members"
              component={Members}
              options={{
                title: 'Miembros',
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="NewWatchPlan"
              component={NewWatchPlan}
              options={{
                title: 'Nueva sala',
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            <Stack.Screen
              name="WatchRoom"
              component={WatchRoom}
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="InviteAccept"
              component={InviteAccept}
              options={{
                title: 'Unirse al grupo',
                headerStyle: { backgroundColor: '#f6f5f0' },
                headerTintColor: '#18261f',
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            />
            {/* Onboarding kept but not initial - allows back navigation if needed
                but never shown on launch for onboarded users */}
            <Stack.Screen name="Onboarding" component={Onboarding} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  })

  if (!fontsLoaded) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#28533a" /></View>
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AppContent />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0' },
})
