import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useCurrentUser } from '../lib/queries'
import type { WatchMessage } from '../types'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

type Props = {
  roomId: string
  messages: WatchMessage[]
}

export default function WatchChat({ roomId, messages }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { data: user } = useCurrentUser()
  const queryClient = useQueryClient()
  const flatRef = useRef<FlatList>(null)

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  async function send() {
    if (!text.trim() || sending || !user) return
    setSending(true)
    const { error } = await supabase.from('watch_messages').insert({
      room_id: roomId,
      user_id: user.id,
      message: text.trim(),
    })
    if (!error) {
      setText('')
      queryClient.invalidateQueries({ queryKey: ['watchMessages', roomId] })
    }
    setSending(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.msg}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item.profiles?.full_name)}</Text>
            </View>
            <View style={styles.msgBody}>
              <Text style={styles.msgName}>{item.profiles?.full_name || 'Usuario'}</Text>
              <Text style={styles.msgText}>{item.message}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.form}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Escribe un mensaje…"
          placeholderTextColor="#69746d"
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendDisabled]}
          disabled={!text.trim() || sending}
          onPress={send}
        >
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 10 },
  msg: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e8efdf', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'DMSans_700Bold', fontSize: 9, color: '#28533a' },
  msgBody: { flex: 1 },
  msgName: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#18261f' },
  msgText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#18261f', marginTop: 2 },
  form: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#d9ddd4' },
  input: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#d9ddd4', borderRadius: 8, fontSize: 13, fontFamily: 'DMSans_400Regular', color: '#18261f' },
  sendBtn: { paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#28533a', borderRadius: 8, minHeight: 44 },
  sendDisabled: { opacity: 0.35 },
  sendText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#fff' },
})
