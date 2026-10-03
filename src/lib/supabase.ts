import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigured = Boolean(url && key)
const supabaseUrl = url || 'https://placeholder.supabase.co'
const supabaseKey = key || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { apikey: supabaseKey } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
