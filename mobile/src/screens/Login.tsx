import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { supabase, supabaseConfigured } from '../lib/supabase'

function parseTokensFromUrl(url: string) {
  const fragment = url.split('#')[1] || ''
  const params = new URLSearchParams(fragment)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  return { access_token, refresh_token }
}

export default function Login() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function signIn() {
    if (!supabaseConfigured) {
      Alert.alert('Error', 'Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env')
      return
    }
    setError(null)
    setLoading(true)
    const redirectUrl = Linking.createURL('auth-callback')
    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    })
    if (authError) {
      setError('No pudimos iniciar sesión. Inténtalo de nuevo.')
      setLoading(false)
      return
    }
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      if (result.type === 'success') {
        const tokens = parseTokensFromUrl(result.url)
        if (tokens.access_token && tokens.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          })
          if (sessionError) setError('No pudimos iniciar sesión. Inténtalo de nuevo.')
        } else {
          setError('No pudimos iniciar sesión. Inténtalo de nuevo.')
        }
      } else if (result.type === 'cancel') {
        setError(null)
      }
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>junt<Text style={styles.dot}>·</Text></Text>
        <Text style={styles.eyebrow}>MENOS MENSAJES. MÁS PLANES.</Text>
        <Text style={styles.title}>Junta a tu gente.</Text>
        <Text style={styles.subtitle}>
          Decidan qué hacer, quién va y dónde se ven. Sin perder el hilo del grupo.
        </Text>
        <TouchableOpacity
          style={[styles.googleButton, !supabaseConfigured && styles.disabled]}
          onPress={signIn}
          disabled={!supabaseConfigured || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.googleButtonText}>
              <Text style={styles.googleG}>G</Text>
              {' '}Continuar con Google
            </Text>
          )}
        </TouchableOpacity>
        {error && <Text style={styles.error} role="alert">{error}</Text>}
        {!supabaseConfigured && (
          <Text style={styles.demoNote}>
            Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f5f0', padding: 24 },
  content: { width: '100%', maxWidth: 400, alignItems: 'center' as const },
  brand: { fontFamily: 'Fraunces_700Bold', fontSize: 48, letterSpacing: -2, color: '#18261f', marginBottom: 12 },
  dot: { color: '#65a838' },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, letterSpacing: 1, color: '#5d6d62', marginBottom: 12 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 42, lineHeight: 52, color: '#18261f', textAlign: 'center' as const, marginBottom: 8 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#69746d', lineHeight: 22, textAlign: 'center' as const, marginBottom: 36 },
  googleButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: '#28533a', paddingVertical: 17, paddingHorizontal: 24, borderRadius: 10, width: '100%' },
  disabled: { opacity: 0.35 },
  googleG: { fontWeight: '700', fontSize: 18 },
  googleButtonText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 16, textAlign: 'center' as const },
  error: { color: '#fc8181', fontSize: 13, marginTop: 16, fontFamily: 'DMSans_400Regular' },
  demoNote: { color: '#69746d', fontSize: 12, marginTop: 20, textAlign: 'center' as const, fontFamily: 'DMSans_400Regular', lineHeight: 18 },
})
