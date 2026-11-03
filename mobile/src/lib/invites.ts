import * as SecureStore from 'expo-secure-store'

const PENDING_INVITE_KEY = 'juntapp.pending-invite'

export const publicAppUrl = (process.env.EXPO_PUBLIC_WEB_URL || 'https://junte.netlify.app').replace(/\/$/, '')

export function invitationUrl(token: string) {
  return `${publicAppUrl}/invite/${token}`
}

export async function savePendingInvite(token: string) {
  await SecureStore.setItemAsync(PENDING_INVITE_KEY, token)
}

export async function getPendingInvite() {
  return SecureStore.getItemAsync(PENDING_INVITE_KEY)
}

export async function clearPendingInvite() {
  await SecureStore.deleteItemAsync(PENDING_INVITE_KEY)
}
