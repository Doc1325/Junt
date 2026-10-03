import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  })
}

export type NotificationData = {
  planId?: string
  groupId?: string
}

export function useNotificationNavigation(onNavigate: (data: NotificationData) => void) {
  useEffect(() => {
    const response = Notifications.getLastNotificationResponse()
    handleNotificationResponse(response, onNavigate)
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, onNavigate)
    })
    return () => sub.remove()
  }, [onNavigate])
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
  onNavigate: (data: NotificationData) => void,
) {
  if (!response) return
  const data = response.notification.request.content.data as NotificationData
  if (data.planId || data.groupId) onNavigate(data)
}

export async function registerForPushNotificationsAsync(userId?: string) {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const result = await Notifications.requestPermissionsAsync()
      status = result.status
    }
    if (status !== 'granted') return

    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession()
      userId = session?.user?.id
    }
    if (!userId) return

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'ad41da45-25ed-4fd4-aebd-1690bc61d612',
    })
    const token = tokenData.data

    const { error } = await supabase.from('user_push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      { onConflict: 'token', ignoreDuplicates: false },
    )
    if (error) {
      console.log('[push] Upsert error:', error.message)
    }
  } catch (e: any) {
    console.log('[push] Error:', e.message)
  }
}
