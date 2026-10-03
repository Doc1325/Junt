import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
export const supabaseConfigured = Boolean(url && key)

const supabaseUrl = url || 'https://placeholder.supabase.co'
const supabaseKey = key || 'placeholder-key'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { apikey: supabaseKey } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: ExpoSecureStoreAdapter,
  },
})
